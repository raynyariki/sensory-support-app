const STORAGE_KEY = "sensorySupport.settings";

export const ALERT_THRESHOLDS = [
  { value: "high", label: "High-relevance sounds only" },
  { value: "medium", label: "High and medium relevance" },
  { value: "low", label: "Every sound I have rated" },
];

export const DEFAULT_SETTINGS = {
  alertsEnabled: true,
  alertThreshold: "low",
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
      : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function clearSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}