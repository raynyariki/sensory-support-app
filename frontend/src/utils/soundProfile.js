import { api } from "../api";
import { SOUND_CATEGORIES } from "../data/soundCategories";

// Every sound starts as "Not relevant".
export function defaultProfile() {
  const profile = {};
  SOUND_CATEGORIES.forEach((sound) => {
    profile[sound.id] = "none";
  });
  return profile;
}

// Reads the signed-in user's sound profile from the server.
// The server returns a list of rows; the app works with { soundId: level }.
export async function fetchSoundProfile() {
  const rows = await api.get("/sound-preferences");
  const profile = defaultProfile();
  rows.forEach((row) => {
    if (row.sound_category in profile) {
      profile[row.sound_category] = row.sensitivity_level;
    }
  });
  return profile;
}

// Saves the whole profile in one request. Throws an ApiError if it fails.
export async function saveSoundProfile(profile) {
  const preferences = SOUND_CATEGORIES.map((sound) => ({
    sound_category: sound.id,
    sensitivity_level: profile[sound.id] || "none",
  }));
  await api.put("/sound-preferences", { preferences });
}

export function hasAnyRelevantSound(profile) {
  return Object.values(profile).some((level) => level !== "none");
}