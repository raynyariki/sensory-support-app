import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FormField from "../components/FormField";
import { SOUND_CATEGORIES, SENSITIVITY_LEVELS } from "../data/soundCategories";
import { api, ApiError, saveToken } from "../api";
import {
  MAX_NAME_LENGTH,
  validateName,
  validateEmail,
} from "../utils/validation";

const RATING_LEVELS = SENSITIVITY_LEVELS.filter(
  (level) => level.value !== "none"
);

function Profile() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [account, setAccount] = useState({ name: "", email: "" });
  const [accountErrors, setAccountErrors] = useState({});
  const [accountMessage, setAccountMessage] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);

  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [prefs, setPrefs] = useState([]); // [{ id, sound_category, sensitivity_level }]
  const [newSound, setNewSound] = useState({ soundId: "", level: "high" });
  const [addError, setAddError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [user, list] = await Promise.all([
          api.get("/profile"),
          api.get("/sound-preferences"),
        ]);
        if (cancelled) return;
        setAccount({ name: user.name, email: user.email });
        setPrefs(list);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const byCategory = Object.fromEntries(
    prefs.map((pref) => [pref.sound_category, pref])
  );
  const ratedSounds = SOUND_CATEGORIES.filter(
    (sound) =>
      byCategory[sound.id] && byCategory[sound.id].sensitivity_level !== "none"
  );

  /* Account details */

  function handleAccountChange(event) {
    const { name, value } = event.target;
    setAccount((current) => ({ ...current, [name]: value }));
    setAccountMessage("");
  }

  async function handleAccountSubmit(event) {
    event.preventDefault();

    const errors = {
      name: validateName(account.name),
      email: validateEmail(account.email),
    };
    setAccountErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setAccountMessage("");
      return;
    }

    setAccountSaving(true);
    try {
      const user = await api.put("/profile", {
        name: account.name.trim(),
        email: account.email.trim(),
      });
      setAccount({ name: user.name, email: user.email });
      setAccountMessage("Your details have been saved.");
    } catch (err) {
      setAccountMessage("");
      if (err instanceof ApiError && Object.keys(err.errors).length > 0) {
        setAccountErrors(err.errors);
      } else {
        setAccountErrors({ form: err.message });
      }
    } finally {
      setAccountSaving(false);
    }
  }

  /* Password */

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswords((current) => ({ ...current, [name]: value }));
    setPasswordMessage("");
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    const errors = {};
    if (!passwords.current_password) {
      errors.current_password = "Current password cannot be empty";
    }
    if (passwords.new_password.length < 8) {
      errors.new_password = "Password must be at least 8 characters";
    }
    if (passwords.confirm_password !== passwords.new_password) {
      errors.confirm_password = "Passwords do not match";
    }
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) {
      setPasswordMessage("");
      return;
    }

    setPasswordSaving(true);
    try {
      const data = await api.put("/profile/password", {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
        confirm_password: passwords.confirm_password,
      });
      // The server signs out every other device and gives this one a fresh token.
      saveToken(data.access_token, false);
      setPasswords({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setPasswordMessage(
        "Your password has been changed. Other devices have been signed out."
      );
    } catch (err) {
      setPasswordMessage("");
      if (err instanceof ApiError && Object.keys(err.errors).length > 0) {
        setPasswordErrors(err.errors);
      } else {
        setPasswordErrors({ form: err.message });
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  /* Sound profile */

  async function handleLevelChange(pref, level) {
    try {
      const updated = await api.put(`/sound-preferences/${pref.id}`, {
        sensitivity_level: level,
      });
      setPrefs((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setProfileError("");
    } catch (err) {
      setProfileError(err.message);
    }
  }

  async function handleRemove(pref) {
    try {
      await api.delete(`/sound-preferences/${pref.id}`);
      setPrefs((current) => current.filter((item) => item.id !== pref.id));
      setRemovingId(null);
      setProfileError("");
    } catch (err) {
      setProfileError(err.message);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();

    if (!newSound.soundId) {
      setAddError("Sound category must be selected");
      return;
    }

    const existing = byCategory[newSound.soundId];

    // Each sound can only appear once in the profile.
    if (existing && existing.sensitivity_level !== "none") {
      const label = SOUND_CATEGORIES.find((s) => s.id === newSound.soundId).label;
      setAddError(
        `${label} is already in your sound profile. Change its level in the list above.`
      );
      return;
    }

    try {
      let saved;
      if (existing) {
        // The sound was saved earlier as "not relevant": update that entry.
        saved = await api.put(`/sound-preferences/${existing.id}`, {
          sensitivity_level: newSound.level,
        });
        setPrefs((current) =>
          current.map((item) => (item.id === saved.id ? saved : item))
        );
      } else {
        saved = await api.post("/sound-preferences", {
          sound_category: newSound.soundId,
          sensitivity_level: newSound.level,
        });
        setPrefs((current) => [...current, saved]);
      }
      setNewSound({ soundId: "", level: "high" });
      setAddError("");
      setProfileError("");
    } catch (err) {
      setAddError(err.errors?.sound_category || err.message);
    }
  }

  if (loading) {
    return (
      <section className="page">
        <div className="container profile">
          <h1>Profile</h1>
          <p className="muted">Loading your profile...</p>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page">
        <div className="container profile">
          <h1>Profile</h1>
          <p className="form-alert" role="alert">
            {loadError}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="container profile">
        <div className="profile__top">
          <h1>Profile</h1>
          <Link to="/settings" className="btn btn-secondary btn-small">
            Settings
          </Link>
        </div>

        <section className="profile__section">
          <h2>Your details</h2>
          <form onSubmit={handleAccountSubmit} noValidate>
            {accountErrors.form && (
              <p className="form-alert" role="alert">
                {accountErrors.form}
              </p>
            )}
            <FormField
              id="name"
              label="Name"
              value={account.name}
              onChange={handleAccountChange}
              error={accountErrors.name}
              autoComplete="name"
              maxLength={MAX_NAME_LENGTH + 10}
            />
            <FormField
              id="email"
              label="Email"
              type="email"
              value={account.email}
              onChange={handleAccountChange}
              error={accountErrors.email}
              autoComplete="email"
            />
            <button type="submit" className="btn" disabled={accountSaving}>
              {accountSaving ? "Saving..." : "Save details"}
            </button>
            {accountMessage && (
              <p className="form-note" role="status">
                {accountMessage}
              </p>
            )}
          </form>
        </section>

        <section className="profile__section">
          <h2>Change password</h2>
          <form onSubmit={handlePasswordSubmit} noValidate>
            {passwordErrors.form && (
              <p className="form-alert" role="alert">
                {passwordErrors.form}
              </p>
            )}
            <FormField
              id="current_password"
              label="Current password"
              type="password"
              value={passwords.current_password}
              onChange={handlePasswordChange}
              error={passwordErrors.current_password}
              autoComplete="current-password"
            />
            <FormField
              id="new_password"
              label="New password"
              type="password"
              value={passwords.new_password}
              onChange={handlePasswordChange}
              error={passwordErrors.new_password}
              autoComplete="new-password"
            />
            <FormField
              id="confirm_password"
              label="Confirm new password"
              type="password"
              value={passwords.confirm_password}
              onChange={handlePasswordChange}
              error={passwordErrors.confirm_password}
              autoComplete="new-password"
            />
            <button type="submit" className="btn" disabled={passwordSaving}>
              {passwordSaving ? "Saving..." : "Change password"}
            </button>
            {passwordMessage && (
              <p className="form-note" role="status">
                {passwordMessage}
              </p>
            )}
          </form>
        </section>

        <section className="profile__section">
          <h2>Your sound profile</h2>
          <p className="muted">
            Change how relevant each sound is to you, or remove it. Sounds that
            are not listed are treated as not relevant.
          </p>

          {profileError && (
            <p className="form-alert" role="alert">
              {profileError}
            </p>
          )}

          {ratedSounds.length === 0 ? (
            <p className="muted">
              No sounds in your profile yet. Add one below.
            </p>
          ) : (
            <ul className="prefs">
              {ratedSounds.map((sound) => {
                const pref = byCategory[sound.id];
                return (
                  <li className="pref" key={sound.id}>
                    <span className="pref__name">{sound.label}</span>

                    {removingId === pref.id ? (
                      <div className="pref__confirm" role="alert">
                        <p>Remove {sound.label} from your profile?</p>
                        <div className="form-actions">
                          <button
                            type="button"
                            className="btn btn-danger btn-small"
                            onClick={() => handleRemove(pref)}
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => setRemovingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <select
                          value={pref.sensitivity_level}
                          onChange={(event) =>
                            handleLevelChange(pref, event.target.value)
                          }
                          aria-label={`Relevance of ${sound.label}`}
                        >
                          {RATING_LEVELS.map((level) => (
                            <option key={level.value} value={level.value}>
                              {level.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => setRemovingId(pref.id)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="profile__subheading">Add a sound</h3>
          <form onSubmit={handleAdd} noValidate className="add-pref">
            <div className="field">
              <label htmlFor="new-sound">Sound</label>
              <select
                id="new-sound"
                value={newSound.soundId}
                onChange={(event) => {
                  setNewSound((current) => ({
                    ...current,
                    soundId: event.target.value,
                  }));
                  setAddError("");
                }}
                aria-invalid={addError ? "true" : "false"}
                aria-describedby={addError ? "new-sound-error" : undefined}
              >
                <option value="">Select a sound</option>
                {SOUND_CATEGORIES.map((sound) => (
                  <option key={sound.id} value={sound.id}>
                    {sound.label}
                  </option>
                ))}
              </select>
              {addError && (
                <p className="field-error" id="new-sound-error">
                  {addError}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="new-level">Relevance</label>
              <select
                id="new-level"
                value={newSound.level}
                onChange={(event) =>
                  setNewSound((current) => ({
                    ...current,
                    level: event.target.value,
                  }))
                }
              >
                {RATING_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn">
              Add to profile
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}

export default Profile;