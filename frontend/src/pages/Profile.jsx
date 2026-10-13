import { useState } from "react";
import { Link } from "react-router-dom";
import FormField from "../components/FormField";
import { SOUND_CATEGORIES, SENSITIVITY_LEVELS } from "../data/soundCategories";
import { loadAccount, saveAccount } from "../utils/account";
import { loadSoundProfile, saveSoundProfile } from "../utils/soundProfile";
import {
  MAX_NAME_LENGTH,
  validateName,
  validateEmail,
} from "../utils/validation";

const RATING_LEVELS = SENSITIVITY_LEVELS.filter(
  (level) => level.value !== "none"
);

function Profile() {
  const [account, setAccount] = useState(loadAccount);
  const [accountErrors, setAccountErrors] = useState({});
  const [accountMessage, setAccountMessage] = useState("");

  const [profile, setProfile] = useState(loadSoundProfile);
  const [newSound, setNewSound] = useState({ soundId: "", level: "high" });
  const [addError, setAddError] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [profileError, setProfileError] = useState("");

  const ratedSounds = SOUND_CATEGORIES.filter(
    (sound) => profile[sound.id] !== "none"
  );

  /* Account details */

  function handleAccountChange(event) {
    const { name, value } = event.target;
    setAccount((current) => ({ ...current, [name]: value }));
    setAccountMessage("");
  }

  function handleAccountSubmit(event) {
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

    // Later: send the details to PUT /profile on the backend.
    const saved = saveAccount({
      name: account.name.trim(),
      email: account.email.trim(),
    });
    setAccountMessage(
      saved
        ? "Your details have been saved."
        : "Your details could not be saved. Please try again."
    );
  }

  /* Sound profile */

  function commitProfile(newProfile) {
    if (!saveSoundProfile(newProfile)) {
      setProfileError("Your changes could not be saved. Please try again.");
      return false;
    }
    setProfileError("");
    setProfile(newProfile);
    return true;
  }

  function handleLevelChange(soundId, level) {
    commitProfile({ ...profile, [soundId]: level });
  }

  function handleRemove(soundId) {
    if (commitProfile({ ...profile, [soundId]: "none" })) {
      setRemovingId(null);
    }
  }

  function handleAdd(event) {
    event.preventDefault();

    if (!newSound.soundId) {
      setAddError("Sound category must be selected");
      return;
    }

    // Duplicate check: each sound can only appear once.
    if (profile[newSound.soundId] !== "none") {
      const label = SOUND_CATEGORIES.find((s) => s.id === newSound.soundId).label;
      setAddError(
        `${label} is already in your sound profile. Change its level in the list above.`
      );
      return;
    }

    // Later: send the preference to POST /sound-preferences on the backend.
    if (commitProfile({ ...profile, [newSound.soundId]: newSound.level })) {
      setNewSound({ soundId: "", level: "high" });
      setAddError("");
    }
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
          <p className="muted">
            Password changes will be available once your account is connected
            to the server.
          </p>
          <form onSubmit={handleAccountSubmit} noValidate>
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
            <button type="submit" className="btn">
              Save details
            </button>
            {accountMessage && (
              <p className="form-note" role="status">
                {accountMessage}
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
              {ratedSounds.map((sound) => (
                <li className="pref" key={sound.id}>
                  <span className="pref__name">{sound.label}</span>

                  {removingId === sound.id ? (
                    <div className="pref__confirm" role="alert">
                      <p>Remove {sound.label} from your profile?</p>
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => handleRemove(sound.id)}
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
                        value={profile[sound.id]}
                        onChange={(event) =>
                          handleLevelChange(sound.id, event.target.value)
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
                        onClick={() => setRemovingId(sound.id)}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </li>
              ))}
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