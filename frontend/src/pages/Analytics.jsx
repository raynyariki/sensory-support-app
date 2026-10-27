import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BarChart from "../components/BarChart";
import { fetchAnalytics, dayLabel } from "../utils/analytics";

const DAYS = 14;

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchAnalytics(DAYS)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.detail || "Your analytics could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || loadError) {
    return (
      <section className="page">
        <div className="container">
          <h1>Analytics</h1>
          {loading && <p className="muted">Loading...</p>}
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
        </div>
      </section>
    );
  }

  if (data.total_events === 0) {
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

  // The server's names, reshaped for the charts.
  const bySound = data.by_sound.map((item) => ({
    id: item.sound_category,
    label: item.label,
    count: item.count,
  }));
  const byDay = data.by_day.map((item) => ({
    label: dayLabel(item.date),
    count: item.count,
  }));
  const byResponse = data.by_response.filter((item) => item.count > 0);
  const recurring = bySound.filter((item) => item.count >= 2);

  const soundSummary =
    "Entries per sound: " +
    bySound.map((item) => `${item.label} ${item.count}`).join(", ");
  const daySummary =
    `Entries per day over the last ${DAYS} days: ` +
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
            <dd>{data.total_events}</dd>
          </div>
          <div>
            <dt>Most frequent sound</dt>
            <dd>{data.most_frequent_sound.label}</dd>
          </div>
          <div>
            <dt>High-relevance entries</dt>
            <dd>{data.high_relevance_events}</dd>
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
          <h2>Entries over the last {DAYS} days</h2>
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