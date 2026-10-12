import { Link } from "react-router-dom";
import { SOUND_CATEGORIES, SENSITIVITY_LEVELS } from "../data/soundCategories";
import { loadSoundProfile } from "../utils/soundProfile";

const RELEVANT_LEVELS = SENSITIVITY_LEVELS.filter(
  (level) => level.value !== "none"
);

function Dashboard() {
  const profile = loadSoundProfile();

  // Group the user's sounds by how relevant they marked them.
  const groups = RELEVANT_LEVELS.map((level) => ({
    ...level,
    sounds: SOUND_CATEGORIES.filter((sound) => profile[sound.id] === level.value),
  })).filter((group) => group.sounds.length > 0);

  return (
    <section className="page">
      <div className="container">
        <h1>Home</h1>

        <div className="status">
          <div>
            <p className="status__label">Monitoring</p>
            <p className="status__value">Off</p>
            <p className="status__note">The microphone is not in use.</p>
          </div>
          <Link to="/monitor" className="btn">
            Start monitoring
          </Link>
        </div>

        <dl className="stats">
          <div>
            <dt>Last detected sound</dt>
            <dd>None yet</dd>
          </div>
          <div>
            <dt>High-relevance events</dt>
            <dd>0</dd>
          </div>
          <div>
            <dt>Events recorded</dt>
            <dd>0</dd>
          </div>
        </dl>

        <div className="home-columns">
          <section>
            <h2>Your sound profile</h2>
            {groups.length > 0 ? (
              groups.map((group) => (
                <div className="level-group" key={group.value}>
                  <h3>{group.label}</h3>
                  <p className="muted">
                    {group.sounds.map((sound) => sound.label).join(", ")}
                  </p>
                </div>
              ))
            ) : (
              <p className="muted">You haven't rated any sounds yet.</p>
            )}
            <p>
              <Link to="/setup">Edit sound profile</Link>
            </p>
          </section>

          <section>
            <h2>Recent events</h2>
            <p className="muted">
              No sounds have been recorded yet. Once you start monitoring,
              detected sounds will appear here.
            </p>
            <p>
              <Link to="/history">Go to history</Link>
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;