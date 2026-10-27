import { api } from "../api";

export const MAX_NOTE_LENGTH = 300;

// ---- talking to the server

// The server and the app name things slightly differently; these two functions translate.
function entryFromApi(event) {
  return {
    id: event.id,
    soundId: event.sound_category,
    timestamp: event.timestamp,
    response: event.response || "",
    note: event.note || "",
    source: event.source,
  };
}

function payloadFromFormValues(values) {
  return {
    sound_category: values.soundId,
    timestamp: new Date(values.timestamp).toISOString(),
    response: values.response || null,
    note: values.note.trim() || null,
  };
}

// Loads the whole history (the server sends it in pages of 200).
export async function fetchEntries() {
  const all = [];
  const pageSize = 200;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const page = await api.get(`/sound-events?limit=${pageSize}&offset=${offset}`);
    all.push(...page.items.map(entryFromApi));
    if (page.items.length === 0 || all.length >= page.total) break;
  }
  return all;
}

export async function createEntry(values) {
  return entryFromApi(await api.post("/sound-events", payloadFromFormValues(values)));
}

export async function updateEntry(id, values) {
  return entryFromApi(await api.patch(`/sound-events/${id}`, payloadFromFormValues(values)));
}

export async function deleteEntry(id) {
  await api.delete(`/sound-events/${id}`);
}

export async function deleteAllEntries() {
  await api.delete("/sound-events?confirm=true");
}

// ---- helpers used by the pages

export function sortNewestFirst(entries) {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

const CLOCK_DRIFT_MS = 5 * 60 * 1000; // same 5 minutes of tolerance as the server
const EARLIEST = new Date("2000-01-01T00:00:00Z");

// Validation for the entry form. Returns an object of error messages.
export function validateEntry(values) {
  const errors = {};

  if (!values.soundId) {
    errors.soundId = "Sound category must be selected";
  }

  if (!values.timestamp) {
    errors.timestamp = "Date and time cannot be empty";
  } else {
    const time = new Date(values.timestamp);
    if (Number.isNaN(time.getTime()) || time < EARLIEST) {
      errors.timestamp = "Enter a valid date and time";
    } else if (time.getTime() > Date.now() + CLOCK_DRIFT_MS) {
      errors.timestamp = "Date and time cannot be in the future";
    }
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

export function formatTimestamp(isoString) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(isoString));
}