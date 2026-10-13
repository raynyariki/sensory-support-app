import { useState } from "react";
import EntryForm from "../components/EntryForm";
import { SOUND_CATEGORIES } from "../data/soundCategories";
import { RESPONSES } from "../data/responses";
import {
  loadEntries,
  saveEntries,
  sortNewestFirst,
  emptyFormValues,
  formValuesFromEntry,
  entryFromFormValues,
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

function History() {
  const [entries, setEntries] = useState(loadEntries);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [saveError, setSaveError] = useState("");

  // Saves the new list. Only updates the screen if saving worked.
  function commit(newEntries) {
    if (!saveEntries(newEntries)) {
      setSaveError("Your changes could not be saved. Please try again.");
      return false;
    }
    setSaveError("");
    setEntries(newEntries);
    return true;
  }

  function handleAdd(values) {
    const newEntry = entryFromFormValues(values);
    if (commit([newEntry, ...entries])) {
      setShowAddForm(false);
    }
  }

  function handleUpdate(id, values) {
    const updated = entries.map((entry) =>
      entry.id === id ? entryFromFormValues(values, id) : entry
    );
    if (commit(updated)) {
      setEditingId(null);
    }
  }

  function handleDelete(id) {
    if (commit(entries.filter((entry) => entry.id !== id))) {
      setDeletingId(null);
    }
  }

  const sorted = sortNewestFirst(entries);

  return (
    <section className="page">
      <div className="container history">
        <div className="history__top">
          <h1>History</h1>
          {!showAddForm && (
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
            />
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="muted">
            No entries yet. Add your first entry to start your sound diary.
          </p>
        ) : (
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
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setDeletingId(null)}
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