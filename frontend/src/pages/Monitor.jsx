import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SENSITIVITY_LEVELS } from "../data/soundCategories";
import { api } from "../api";

const CLIP_MS = 4000; // length of each recording
const PAUSE_MS = 500; // short rest between recordings
const TARGET_RATE = 22050; // the sample rate the classifier was trained with

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Record one clip from an open microphone stream. Resolves with a Blob.
function recordClip(stream, ms) {
  return new Promise((resolve, reject) => {
    let recorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch (err) {
      reject(err);
      return;
    }
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = (event) => reject(event.error || new Error("Recording failed"));
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    recorder.start();
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, ms);
  });
}

// Turn the recorded Blob into a mono 22,050 Hz WAV file, which is what the server accepts.
async function blobToWav(blob) {
  const raw = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(raw);
  } finally {
    ctx.close();
  }

  const length = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const offline = new OfflineAudioContext(1, length, TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), TARGET_RATE);
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function microphoneErrorMessage(err) {
  if (err && err.name === "NotAllowedError") {
    return "Microphone access was blocked. Allow the microphone in your browser settings and try again.";
  }
  if (err && err.name === "NotFoundError") {
    return "No microphone was found on this device.";
  }
  return "The microphone could not be started. Please try again.";
}

function Monitor() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [sounds, setSounds] = useState([]);

  const runningRef = useRef(false);
  const streamRef = useRef(null);

  // Which sounds the loaded model can actually recognise.
  useEffect(() => {
    let cancelled = false;
    api
      .get("/sounds", { auth: false })
      .then((list) => {
        if (!cancelled) setSounds(list);
      })
      .catch(() => {
        // The list is only informational.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Release the microphone if the user leaves the page.
  useEffect(() => {
    return () => {
      runningRef.current = false;
      releaseMicrophone();
    };
  }, []);

  function releaseMicrophone() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function listenLoop() {
    while (runningRef.current) {
      try {
        const clip = await recordClip(streamRef.current, CLIP_MS);
        if (!runningRef.current) break;

        setAnalysing(true);
        const wav = await blobToWav(clip);
        const form = new FormData();
        form.append("file", wav, "clip.wav");
        const data = await api.upload("/classify", form);
        if (!runningRef.current) break;

        setResult(data);
        setError("");
        if (data.alert && navigator.vibrate) {
          navigator.vibrate(200);
        }
      } catch (err) {
        if (!runningRef.current) break;
        setError(err.message || "Something went wrong while listening.");
        stopMonitoring();
        break;
      } finally {
        setAnalysing(false);
      }
      await sleep(PAUSE_MS);
    }
  }

  async function handleStart() {
    setError("");
    setResult(null);

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setError(
        "This browser cannot record audio here. Use a recent browser and open the app on localhost or over HTTPS."
      );
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Switch off the phone's sound clean-up so the model hears the real sound.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err) {
      setError(microphoneErrorMessage(err));
      return;
    }

    runningRef.current = true;
    setIsMonitoring(true);
    listenLoop();
  }

  function stopMonitoring() {
    runningRef.current = false;
    setIsMonitoring(false);
    setAnalysing(false);
    releaseMicrophone();
  }

  let detection = null;
  if (result && !result.quiet) {
    const levelLabel =
      SENSITIVITY_LEVELS.find((level) => level.value === result.sensitivity)
        ?.label || "Not relevant";
    detection = {
      soundLabel: result.detected ? result.label : null,
      percent:
        result.confidence !== null ? Math.round(result.confidence * 100) : null,
      levelLabel,
      style: result.alert ? result.sensitivity : "none",
    };
  }

  const undetectable = sounds.filter((sound) => !sound.detectable);

  return (
    <section className="page">
      <div className="container monitor">
        <h1>Monitor</h1>

        <p className="notice">
          The microphone is used only while monitoring is on. Each short
          recording is analysed and then discarded. Only the result is kept.
          This is a support tool, not a medical device.
        </p>

        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}

        <div className="status">
          <div>
            <p className="status__label">Monitoring</p>
            <p className="status__value">
              {isMonitoring
                ? analysing
                  ? "Analysing..."
                  : "Listening"
                : "Off"}
            </p>
          </div>
          <div className="monitor__actions">
            {isMonitoring ? (
              <button type="button" className="btn" onClick={stopMonitoring}>
                Stop monitoring
              </button>
            ) : (
              <button type="button" className="btn" onClick={handleStart}>
                Start monitoring
              </button>
            )}
          </div>
        </div>

        <section className="result" aria-live="polite">
          <h2>Detected sound</h2>

          {result && result.quiet && (
            <p className="muted">{result.message}</p>
          )}

          {detection && detection.soundLabel && (
            <>
              <p className="result__sound">{detection.soundLabel}</p>
              <p className="result__confidence">
                Confidence: {detection.percent}%
              </p>
              <p className="muted">
                Confidence is the model's best estimate, not a certainty.
              </p>

              <p className="result__sensitivity">
                Your sensitivity: <strong>{detection.levelLabel}</strong>
              </p>
              <div className={`relevance relevance--${detection.style}`}>
                <p>{result.message}</p>
              </div>
              {result.recorded && (
                <p className="muted">
                  Saved to your <Link to="/history">history</Link>.
                </p>
              )}
              <p>
                <Link to="/settings">Change alert settings</Link>
              </p>
            </>
          )}

          {detection && !detection.soundLabel && (
            <p className="muted">{result.message}</p>
          )}

          {!result && (
            <p className="muted">
              {isMonitoring
                ? "Listening. No sound has been identified yet."
                : "Start monitoring to see detected sounds here."}
            </p>
          )}
        </section>

        {undetectable.length > 0 && (
          <p className="muted">
            Not detectable yet with the current model:{" "}
            {undetectable.map((sound) => sound.label).join(", ")}.
          </p>
        )}
      </div>
    </section>
  );
}

export default Monitor;