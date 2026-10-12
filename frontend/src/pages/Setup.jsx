import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SensitivityChoice from "../components/SensitivityChoice";
import { SOUND_CATEGORIES } from "../data/soundCategories";
import {
  loadSoundProfile,
  saveSoundProfile,
  hasAnyRelevantSound,
} from "../utils/soundProfile";

function Setup() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(loadSoundProfile);
  const [error, setError] = useState("");

  function handleChange(soundId, level) {
    setProfile((current) => ({ ...current, [soundId]: level }));
    setError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!hasAnyRelevantSound(profile)) {
      setError("Choose High, Medium or Low for at least one sound.");
      return;
    }

    // Later: send the profile to POST /sound-preferences on the backend.
    const saved = saveSoundProfile(profile);
    if (!saved) {
      setError("Your choices could not be saved. Please try again.");
      return;
    }
    navigate("/dashboard");
  }

  return (
    <section className="setup">
      <div className="container setup__inner">
        <h1>Which sounds matter to you?</h1>
        <p className="setup__lead muted">
          Rate how relevant each sound is to you. You can change these choices
          at any time.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {SOUND_CATEGORIES.map((sound) => (
            <SensitivityChoice
              key={sound.id}
              name={sound.id}
              label={sound.label}
              value={profile[sound.id]}
              onChange={handleChange}
            />
          ))}

          {error && (
            <p className="form-alert" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn setup__submit">
            Save and continue
          </button>
        </form>
      </div>
    </section>
  );
}

export default Setup;