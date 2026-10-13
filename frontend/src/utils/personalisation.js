const RANK = { none: 0, low: 1, medium: 2, high: 3 };

export function getRelevanceMessage(level) {
  switch (level) {
    case "high":
      return "This sound is marked as highly relevant in your sound profile.";
    case "medium":
      return "This sound is marked as moderately relevant in your sound profile.";
    case "low":
      return "This sound is marked as minimally relevant in your sound profile.";
    default:
      return "You marked this sound as not relevant, so no alert is shown.";
  }
}

// An alert is shown only if alerts are on and the sound is rated at or
// above the level the user chose in Settings.
export function shouldAlert(level, settings) {
  if (!settings.alertsEnabled) return false;
  const rank = RANK[level] || 0;
  return rank > 0 && rank >= RANK[settings.alertThreshold];
}

export function getNoAlertMessage(level, settings) {
  if (level === "none") return getRelevanceMessage("none");
  if (!settings.alertsEnabled) return "Alerts are turned off in Settings.";
  return "This sound is below your alert level in Settings, so no alert is shown.";
}