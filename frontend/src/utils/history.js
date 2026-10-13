const STORAGE_KEY = "sensorySupport.history";

export const MAX_NOTE_LENGTH = 300;

export function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function sortNewestFirst(entries) {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

// Validation for the entry form. Returns an object of error messages.
export function validateEntry(values) {
  const errors = {};

  if (!values.soundId) {
    errors.soundId = "Sound category must be selected";
  }

  if (!values.timestamp) {
    errors.timestamp = "Date and time cannot be empty";
  } else if (Number.isNaN(new Date(values.timestamp).getTime())) {
    errors.timestamp = "Enter a valid date and time";
  }

  if (values.note.length > MAX_NOTE_LENGTH) {
    errors.note = `Note must be ${MAX_NOTE_LENGTH} characters or fewer`;
  }

  return errors;
}

// The date input needs the format YYYY-MM-DDTHH:mm in local time.
export function toInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function emptyFormValues() {
  return {
    soundId: "",
    timestamp: toInputValue(new Date()),
    response: "",
    note: "",
  };
}

export function formValuesFromEntry(entry) {
  return {
    soundId: entry.soundId,
    timestamp: toInputValue(new Date(entry.timestamp)),
    response: entry.response || "",
    note: entry.note || "",
  };
}

export function entryFromFormValues(values, id) {
  return {
    id: id || crypto.randomUUID(),
    soundId: values.soundId,
    timestamp: new Date(values.timestamp).toISOString(),
    response: values.response,
    note: values.note.trim(),
  };
}

export function formatTimestamp(isoString) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(isoString));
}