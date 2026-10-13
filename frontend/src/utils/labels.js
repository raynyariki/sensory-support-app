import { SOUND_CATEGORIES } from "../data/soundCategories";

export function soundLabel(soundId) {
  const sound = SOUND_CATEGORIES.find((s) => s.id === soundId);
  return sound ? sound.label : "Unknown sound";
}