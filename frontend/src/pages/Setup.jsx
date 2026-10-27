import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SensitivityChoice from "../components/SensitivityChoice";
import { SOUND_CATEGORIES } from "../data/soundCategories";
import {
  defaultProfile,
  fetchSoundProfile,
  saveSoundProfile,
  hasAnyRelevantSound,
} from "../utils/soundProfile";

function Setup() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSoundProfile()
      .then((saved) => {
        if (!cancelled) setProfile(saved);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.detail || "Your saved choices could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleChange(soundId, level) {
    setProfile((current) => ({ ...current, [soundId]: level }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!hasAnyRelevantSound(profile)) {
      setError("Choose High, Medium or Low for at least one sound.");
      return;
    }

    setSaving(true);
    try {
      await saveSoundProfile(profile);
      navigate("/dashboard");
    } catch (err) {
      setError(err.detail || "Your choices could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="setup">
      <div className="container setup__inner">
        <h1>Which sounds matter to you?</h1>
        <p className="setup__lead muted">
          Rate how relevant each sound is to you. You can change these choices
          at any time.
        </p>

        {loading && <p className="muted">Loading your choices...</p>}

        {loadError && (
          <>
            <p className="form-alert" role="alert">
              {loadError}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </>
        )}

        {!loading && !loadError && (
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

            <button type="submit" className="btn setup__submit" disabled={saving}>
              {saving ? "Saving..." : "Save and continue"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default Setup;