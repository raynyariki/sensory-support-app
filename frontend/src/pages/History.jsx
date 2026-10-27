import { useEffect, useState } from "react";
import EntryForm from "../components/EntryForm";
import { SOUND_CATEGORIES } from "../data/soundCategories";
import { RESPONSES } from "../data/responses";
import {
  fetchEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  sortNewestFirst,
  emptyFormValues,
  formValuesFromEntry,
  formatTimestamp,
} from "../utils/history";

function soundLabel(soundId) {
  const sound = SOUND_CATEGORIES.find((s) => s.id === soundId);
  return sound ? sound.label : "Unknown sound";
}

function responseLabel(value) {
  const response = RESPONSES.find((r) => r.value === value);
  return response ? response.label : "";
}

// Prefers the server's field-specific message, then its general one.
function errorMessage(error, fallback) {
  const first = error && error.errors ? Object.values(error.errors)[0] : null;
  return first || (error && error.detail) || fallback;
}

function History() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchEntries()
      .then((loaded) => {
        if (!cancelled) setEntries(loaded);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(errorMessage(error, "Your history could not be loaded."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd(values) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await createEntry(values);
      setEntries((current) => [created, ...current]);
      setSaveError("");
      setShowAddForm(false);
    } catch (error) {
      setSaveError(errorMessage(error, "Your changes could not be saved. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id, values) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateEntry(id, values);
      setEntries((current) => current.map((entry) => (entry.id === id ? updated : entry)));
      setSaveError("");
      setEditingId(null);
    } catch (error) {
      setSaveError(errorMessage(error, "Your changes could not be saved. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (saving) return;
    setSaving(true);
    try {
      await deleteEntry(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
      setSaveError("");
      setDeletingId(null);
    } catch (error) {
      setSaveError(errorMessage(error, "The entry could not be deleted. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  const sorted = sortNewestFirst(entries);

  return (
    <section className="page">
      <div className="container history">
        <div className="history__top">
          <h1>History</h1>
          {!showAddForm && !loading && !loadError && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowAddForm(true);
                setEditingId(null);
                setDeletingId(null);
              }}
            >
              Add an entry
            </button>
          )}
        </div>

        <p className="muted history__lead">
          Your sound diary. Add the sounds you notice, how they felt, and any
          notes you want to keep.
        </p>

        {loading && <p className="muted">Loading your history...</p>}

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

        {saveError && (
          <p className="form-alert" role="alert">
            {saveError}
          </p>
        )}

        {showAddForm && (
          <div className="history__form">
            <h2>New entry</h2>
            <EntryForm
              idPrefix="add"
              initialValues={emptyFormValues()}
              submitLabel="Save entry"
              onSubmit={handleAdd}
              onCancel={() => setShowAddForm(false)}
              submitting={saving}
            />
          </div>
        )}

        {!loading && !loadError && sorted.length === 0 && (
          <p className="muted">
            No entries yet. Add your first entry to start your sound diary.
          </p>
        )}

        {!loading && !loadError && sorted.length > 0 && (
          <ul className="entries">
            {sorted.map((entry) => (
              <li className="entry" key={entry.id}>
                {editingId === entry.id ? (
                  <>
                    <h2>Edit entry</h2>
                    <EntryForm
                      idPrefix={`edit-${entry.id}`}
                      initialValues={formValuesFromEntry(entry)}
                      submitLabel="Save changes"
                      onSubmit={(values) => handleUpdate(entry.id, values)}
                      onCancel={() => setEditingId(null)}
                      submitting={saving}
                    />
                  </>
                ) : (
                  <>
                    <h2 className="entry__sound">{soundLabel(entry.soundId)}</h2>
                    <p className="entry__meta">
                      {formatTimestamp(entry.timestamp)}
                      {entry.response && ` · ${responseLabel(entry.response)}`}
                    </p>
                    {entry.note && <p className="entry__note">{entry.note}</p>}

                    {deletingId === entry.id ? (
                      <div className="entry__confirm" role="alert">
                        <p>Delete this entry? This cannot be undone.</p>
                        <div className="form-actions">
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDelete(entry.id)}
                            disabled={saving}
                          >
                            {saving ? "Deleting..." : "Delete"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setDeletingId(null)}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => {
                            setEditingId(entry.id);
                            setDeletingId(null);
                            setShowAddForm(false);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => setDeletingId(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default History;