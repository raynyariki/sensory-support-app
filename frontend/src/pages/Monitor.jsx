import { useState } from "react";
import { SOUND_CATEGORIES, SENSITIVITY_LEVELS } from "../data/soundCategories";
import { loadSoundProfile } from "../utils/soundProfile";
import { getRelevanceMessage } from "../utils/personalisation";

// Example detections for the design preview only. Not real model output.
const SAMPLE_DETECTIONS = [
  { soundId: "siren", confidence: 0.87 },
  { soundId: "car_horn", confidence: 0.74 },
  { soundId: "drilling", confidence: 0.91 },
  { soundId: "jackhammer", confidence: 0.68 },
  { soundId: "dog_barking", confidence: 0.82 },
  { soundId: "alarm", confidence: 0.79 },
];

function Monitor() {
  const profile = loadSoundProfile();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(-1);

  const sample = sampleIndex >= 0 ? SAMPLE_DETECTIONS[sampleIndex] : null;

  let detection = null;
  if (sample) {
    const level = profile[sample.soundId] || "none";
    detection = {
      soundLabel: SOUND_CATEGORIES.find((s) => s.id === sample.soundId).label,
      percent: Math.round(sample.confidence * 100),
      level,
      levelLabel: SENSITIVITY_LEVELS.find((l) => l.value === level).label,
      message: getRelevanceMessage(level),
    };
  }

  function handleStart() {
    setSampleIndex(-1);
    setIsMonitoring(true);
  }

  function handleStop() {
    setIsMonitoring(false);
  }

  function handlePreview() {
    setSampleIndex((current) => (current + 1) % SAMPLE_DETECTIONS.length);
  }

  return (
    <section className="page">
      <div className="container monitor">
        <h1>Monitor</h1>

        <p className="notice">
          Preview only. Sound detection is not connected yet, so the microphone
          is not used and the results below are examples.
        </p>

        <div className="status">
          <div>
            <p className="status__label">Monitoring</p>
            <p className="status__value">
              {isMonitoring ? "Listening" : "Off"}
            </p>
          </div>
          <div className="monitor__actions">
            {isMonitoring ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePreview}
                >
                  Preview a sample result
                </button>
                <button type="button" className="btn" onClick={handleStop}>
                  Stop monitoring
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={handleStart}>
                Start monitoring
              </button>
            )}
          </div>
        </div>

        <section className="result" aria-live="polite">
          <h2>Detected sound</h2>

          {detection ? (
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
              <div className={`relevance relevance--${detection.level}`}>
                <p>{detection.message}</p>
              </div>
            </>
          ) : (
            <p className="muted">
              {isMonitoring
                ? "Listening. No sound has been identified yet."
                : "Start monitoring to see detected sounds here."}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

export default Monitor;