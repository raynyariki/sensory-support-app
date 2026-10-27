import { api } from "../api";
import { SOUND_CATEGORIES } from "../data/soundCategories";
import { RESPONSES } from "../data/responses";

// ---- from the server

// The server does the counting. Sending the browser's time zone makes "a day"
// start at the user's midnight instead of UTC's.
export async function fetchAnalytics(days = 14) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return api.get(`/analytics?days=${days}&tz=${encodeURIComponent(timeZone)}`);
}

// "2026-10-15" -> "15 Oct"
export function dayLabel(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

// ---- calculated in the browser from a list of entries

// Entries per sound, most frequent first. Sounds with no entries are left out.
export function countBySound(entries) {
  const counts = {};
  entries.forEach((entry) => {
    counts[entry.soundId] = (counts[entry.soundId] || 0) + 1;
  });
  return SOUND_CATEGORIES.map((sound) => ({
    id: sound.id,
    label: sound.label,
    count: counts[sound.id] || 0,
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

function dayKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Entries per day for the last N days, oldest first.
export function countByDay(entries, days = 14) {
  const counts = {};
  entries.forEach((entry) => {
    const key = dayKey(new Date(entry.timestamp));
    counts[key] = (counts[key] || 0) + 1;
  });

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });
  const today = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - i
    );
    result.push({
      label: formatter.format(date),
      count: counts[dayKey(date)] || 0,
    });
  }
  return result;
}

export function countByResponse(entries) {
  const counts = {};
  entries.forEach((entry) => {
    if (entry.response) {
      counts[entry.response] = (counts[entry.response] || 0) + 1;
    }
  });
  return RESPONSES.map((response) => ({
    label: response.label,
    count: counts[response.value] || 0,
  }));
}

// Entries for sounds the user rated as "high".
export function countHighRelevance(entries, profile) {
  return entries.filter((entry) => profile[entry.soundId] === "high").length;
}