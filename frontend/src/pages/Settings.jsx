import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ALERT_THRESHOLDS,
  loadSettings,
  saveSettings,
  clearSettings,
} from "../utils/settings";
import { saveEntries } from "../utils/history";
import { defaultProfile, saveSoundProfile } from "../utils/soundProfile";
import { clearAccount } from "../utils/account";

function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(loadSettings);
  const [confirming, setConfirming] = useState(null); // "history" | "account" | null
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateSettings(changes) {
    const next = { ...settings, ...changes };
    if (!saveSettings(next)) {
      setError("Your settings could not be saved. Please try again.");
      return;
    }
    setError("");
    setMessage("");
    setSettings(next);
  }

  function handleDeleteHistory() {
    if (!saveEntries([])) {
      setError("Your history could not be deleted. Please try again.");
      return;
    }
    setError("");
    setConfirming(null);
    setMessage("Your history has been deleted.");
  }

  function handleDeleteAccount() {
    // Later: call the backend to delete the account and all stored data.
    saveEntries([]);
    saveSoundProfile(defaultProfile());
    clearAccount();
    clearSettings();
    navigate("/");
  }

  function handleLogout() {
    // Later: clear the saved login token before leaving.
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
              onChange={(event) =>
                updateSettings({ alertsEnabled: event.target.checked })
              }
            />
            Show alerts when a sound is detected
          </label>

          <fieldset className="radio-list" disabled={!settings.alertsEnabled}>
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
            Change which sounds matter to you, or update your name and email.
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
            At the moment, your information is stored in this browser on this
            device only. You can delete it at any time below.
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