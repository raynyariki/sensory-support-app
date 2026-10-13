import { Link } from "react-router-dom";
import BarChart from "../components/BarChart";
import { loadEntries } from "../utils/history";
import { loadSoundProfile } from "../utils/soundProfile";
import {
  countBySound,
  countByDay,
  countByResponse,
  countHighRelevance,
} from "../utils/analytics";

function Analytics() {
  const entries = loadEntries();
  const profile = loadSoundProfile();

  if (entries.length === 0) {
    return (
      <section className="page">
        <div className="container">
          <h1>Analytics</h1>
          <p className="muted">
            There is nothing to show yet. Add entries in your{" "}
            <Link to="/history">history</Link> and the patterns will appear
            here.
          </p>
        </div>
      </section>
    );
  }

  const bySound = countBySound(entries);
  const byDay = countByDay(entries, 14);
  const byResponse = countByResponse(entries).filter((item) => item.count > 0);
  const recurring = bySound.filter((item) => item.count >= 2);
  const highCount = countHighRelevance(entries, profile);

  const soundSummary =
    "Entries per sound: " +
    bySound.map((item) => `${item.label} ${item.count}`).join(", ");
  const daySummary =
    "Entries per day over the last 14 days: " +
    byDay
      .filter((item) => item.count > 0)
      .map((item) => `${item.label} ${item.count}`)
      .join(", ");

  return (
    <section className="page">
      <div className="container analytics">
        <h1>Analytics</h1>
        <p className="muted">
          A simple look at the entries in your sound diary. These figures only
          describe what you have recorded. They are not a medical assessment.
        </p>

        <dl className="stats">
          <div>
            <dt>Entries recorded</dt>
            <dd>{entries.length}</dd>
          </div>
          <div>
            <dt>Most frequent sound</dt>
            <dd>{bySound[0].label}</dd>
          </div>
          <div>
            <dt>High-relevance entries</dt>
            <dd>{highCount}</dd>
          </div>
        </dl>

        <section className="analytics__section">
          <h2>Most frequently recorded sounds</h2>
          <BarChart
            labels={bySound.map((item) => item.label)}
            values={bySound.map((item) => item.count)}
            horizontal
            height={`${Math.max(bySound.length * 3.25, 8)}rem`}
            ariaLabel={soundSummary}
          />
        </section>

        <section className="analytics__section">
          <h2>Entries over the last 14 days</h2>
          <BarChart
            labels={byDay.map((item) => item.label)}
            values={byDay.map((item) => item.count)}
            height="16rem"
            ariaLabel={daySummary}
          />
        </section>

        <div className="analytics__columns">
          <section>
            <h2>Recurring sounds</h2>
            {recurring.length > 0 ? (
              <ul className="plain-list">
                {recurring.map((item) => (
                  <li key={item.id}>
                    {item.label}: {item.count} entries
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                No sound has been recorded more than once yet.
              </p>
            )}
          </section>

          <section>
            <h2>How sounds felt</h2>
            {byResponse.length > 0 ? (
              <ul className="plain-list">
                {byResponse.map((item) => (
                  <li key={item.label}>
                    {item.label}: {item.count}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No feelings have been recorded yet.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

export default Analytics;