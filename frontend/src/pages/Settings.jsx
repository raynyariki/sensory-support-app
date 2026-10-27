import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ALERT_THRESHOLDS } from "../utils/settings";
import { api, clearToken } from "../api";

function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    alertsEnabled: true,
    alertThreshold: "low",
  });
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null); // "history" | "account" | null
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get("/settings");
        if (cancelled) return;
        setSettings({
          alertsEnabled: data.alerts_enabled,
          alertThreshold: data.alert_threshold,
        });
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateSettings(changes) {
    const next = { ...settings, ...changes };
    try {
      const saved = await api.put("/settings", {
        alerts_enabled: next.alertsEnabled,
        alert_threshold: next.alertThreshold,
      });
      setSettings({
        alertsEnabled: saved.alerts_enabled,
        alertThreshold: saved.alert_threshold,
      });
      setError("");
      setMessage("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteHistory() {
    try {
      await api.delete("/sound-events?confirm=true");
      setError("");
      setConfirming(null);
      setMessage("Your history has been deleted.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteAccount() {
    try {
      await api.delete("/profile?confirm=true");
      clearToken();
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the server cannot be reached, sign out on this device.
    }
    clearToken();
    navigate("/");
  }

  return (
    <section className="page">
      <div className="container settings">
        <h1>Settings</h1>
        <p className="muted">Changes to alert settings are saved automatically.</p>

        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-note" role="status">
            {message}
          </p>
        )}

        <section className="settings__section">
          <h2>Alerts</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.alertsEnabled}
              disabled={loading}
              onChange={(event) =>
                updateSettings({ alertsEnabled: event.target.checked })
              }
            />
            Show alerts when a sound is detected
          </label>

          <fieldset
            className="radio-list"
            disabled={loading || !settings.alertsEnabled}
          >
            <legend>Alert me for</legend>
            {ALERT_THRESHOLDS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="alertThreshold"
                  value={option.value}
                  checked={settings.alertThreshold === option.value}
                  onChange={() =>
                    updateSettings({ alertThreshold: option.value })
                  }
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="settings__section">
          <h2>Sound profile and account</h2>
          <p>
            Change which sounds matter to you, or update your name, email and
            password.
          </p>
          <p>
            <Link to="/profile">Go to profile</Link>
          </p>
        </section>

        <section className="settings__section">
          <h2>Privacy</h2>
          <p>
            The microphone is only used while you have monitoring switched on.
            The app never records you in the background.
          </p>
          <p>
            Only the result of each detection is kept, not the recording
            itself.
          </p>
          <p>
            Your account, sound profile and history are stored on the server
            and are visible only to you. You can delete them at any time below.
          </p>
        </section>

        <section className="settings__section">
          <h2>Your data</h2>

          {confirming === "history" ? (
            <div className="confirm" role="alert">
              <p>
                Delete all of your history entries? This cannot be undone.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteHistory}
                >
                  Delete history
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setConfirming("history");
                  setMessage("");
                }}
              >
                Delete history
              </button>
            </p>
          )}

          {confirming === "account" ? (
            <div className="confirm" role="alert">
              <p>
                Delete your account and all of your data, including your sound
                profile and history? This cannot be undone.
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteAccount}
                >
                  Delete account and data
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setConfirming("account");
                  setMessage("");
                }}
              >
                Delete account and data
              </button>
            </p>
          )}
        </section>

        <section className="settings__section">
          <h2>Log out</h2>
          <button type="button" className="btn" onClick={handleLogout}>
            Log out
          </button>
        </section>
      </div>
    </section>
  );
}

export default Settings;