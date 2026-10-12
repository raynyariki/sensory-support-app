import { SOUND_CATEGORIES } from "../data/soundCategories";

const STORAGE_KEY = "sensorySupport.soundProfile";

// Every sound starts as "Not relevant".
export function defaultProfile() {
  const profile = {};
  SOUND_CATEGORIES.forEach((sound) => {
    profile[sound.id] = "none";
  });
  return profile;
}

export function loadSoundProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    return { ...defaultProfile(), ...JSON.parse(raw) };
  } catch {
    return defaultProfile();
  }
}

export function saveSoundProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function hasAnyRelevantSound(profile) {
  return Object.values(profile).some((level) => level !== "none");
}