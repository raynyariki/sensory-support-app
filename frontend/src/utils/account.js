const STORAGE_KEY = "sensorySupport.account";
const EMPTY = { name: "", email: "" };

export function loadAccount() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

// The password is never stored here.
export function saveAccount(account) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    return true;
  } catch {
    return false;
  }
}

export function clearAccount() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}