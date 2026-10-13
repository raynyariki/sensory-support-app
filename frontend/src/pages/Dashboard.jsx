import { Link } from "react-router-dom";
import { SOUND_CATEGORIES, SENSITIVITY_LEVELS } from "../data/soundCategories";
import { loadSoundProfile } from "../utils/soundProfile";
import {
  loadEntries,
  sortNewestFirst,
  formatTimestamp,
} from "../utils/history";
import { countHighRelevance } from "../utils/analytics";
import { soundLabel } from "../utils/labels";

const RELEVANT_LEVELS = SENSITIVITY_LEVELS.filter(
  (level) => level.value !== "none"
);

function Dashboard() {
  const profile = loadSoundProfile();
  const entries = sortNewestFirst(loadEntries());
  const latest = entries[0];
  const recent = entries.slice(0, 3);
  const highCount = countHighRelevance(entries, profile);

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
            <dt>Last recorded sound</dt>
            <dd>{latest ? soundLabel(latest.soundId) : "None yet"}</dd>
          </div>
          <div>
            <dt>High-relevance entries</dt>
            <dd>{highCount}</dd>
          </div>
          <div>
            <dt>Entries recorded</dt>
            <dd>{entries.length}</dd>
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
              <Link to="/profile">Manage sound profile</Link>
            </p>
          </section>

          <section>
            <h2>Recent entries</h2>
            {recent.length > 0 ? (
              <ul className="recent">
                {recent.map((entry) => (
                  <li key={entry.id}>
                    <strong>{soundLabel(entry.soundId)}</strong>
                    <span className="recent__meta">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No entries yet. Add one in History to start your sound diary.
              </p>
            )}
            <p>
              <Link to="/history">Go to history</Link>
              {" · "}
              <Link to="/analytics">View analytics</Link>
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;