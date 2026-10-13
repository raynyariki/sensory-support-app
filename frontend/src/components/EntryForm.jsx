import { useState } from "react";
import { SOUND_CATEGORIES } from "../data/soundCategories";
import { RESPONSES } from "../data/responses";
import { MAX_NOTE_LENGTH, validateEntry } from "../utils/history";

function EntryForm({ idPrefix, initialValues, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const newErrors = validateEntry(values);
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;
    onSubmit(values);
  }

  const soundId = `${idPrefix}-sound`;
  const timeId = `${idPrefix}-time`;
  const responseId = `${idPrefix}-response`;
  const noteId = `${idPrefix}-note`;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor={soundId}>Sound</label>
        <select
          id={soundId}
          name="soundId"
          value={values.soundId}
          onChange={handleChange}
          aria-invalid={errors.soundId ? "true" : "false"}
          aria-describedby={errors.soundId ? `${soundId}-error` : undefined}
        >
          <option value="">Select a sound</option>
          {SOUND_CATEGORIES.map((sound) => (
            <option key={sound.id} value={sound.id}>
              {sound.label}
            </option>
          ))}
        </select>
        {errors.soundId && (
          <p className="field-error" id={`${soundId}-error`}>
            {errors.soundId}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={timeId}>Date and time</label>
        <input
          id={timeId}
          name="timestamp"
          type="datetime-local"
          value={values.timestamp}
          onChange={handleChange}
          aria-invalid={errors.timestamp ? "true" : "false"}
          aria-describedby={errors.timestamp ? `${timeId}-error` : undefined}
        />
        {errors.timestamp && (
          <p className="field-error" id={`${timeId}-error`}>
            {errors.timestamp}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={responseId}>How did it feel? (optional)</label>
        <select
          id={responseId}
          name="response"
          value={values.response}
          onChange={handleChange}
        >
          <option value="">Not stated</option>
          {RESPONSES.map((response) => (
            <option key={response.value} value={response.value}>
              {response.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={noteId}>Note (optional)</label>
        <textarea
          id={noteId}
          name="note"
          value={values.note}
          onChange={handleChange}
          maxLength={MAX_NOTE_LENGTH + 20}
          aria-invalid={errors.note ? "true" : "false"}
          aria-describedby={errors.note ? `${noteId}-error` : undefined}
        />
        {errors.note && (
          <p className="field-error" id={`${noteId}-error`}>
            {errors.note}
          </p>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn">
          {submitLabel}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default EntryForm;