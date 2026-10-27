// The only file that talks to the backend.
// Other files import { api } and call api.get / api.post / api.put / api.patch / api.delete / api.upload.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "sensory_token";

export class ApiError extends Error {
  constructor(status, detail, errors = {}, extra = {}) {
    super(detail);
    this.status = status; // 0 means the server could not be reached
    this.detail = detail;
    this.errors = errors; // { fieldName: "message" } for form validation
    this.extra = extra; // any extra fields the server sent, e.g. existing_id
  }
}

// ---- token storage (wrapped in try/catch: storage can be blocked in private windows)

function read(store) {
  try {
    return store.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getToken() {
  return read(localStorage) || read(sessionStorage);
}

export function saveToken(token, remember) {
  clearToken();
  try {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    // If storage is blocked the user simply has to sign in again next time.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function isSignedIn() {
  return Boolean(getToken());
}

// ---- requests

async function request(method, path, { body, form, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // the browser sets the multipart header itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(BASE_URL + path, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // no JSON body
  }

  if (!response.ok) {
    // An expired or revoked token: forget it and tell the app to go to the login page.
    if (response.status === 401 && auth && token) {
      clearToken();
      window.dispatchEvent(new Event("sensory:signed-out"));
    }
    const { detail, errors, ...extra } = data || {};
    throw new ApiError(
      response.status,
      typeof detail === "string" ? detail : "Something went wrong. Please try again.",
      errors || {},
      extra
    );
  }
  return data;
}

export const api = {
  get: (path, options) => request("GET", path, options),
  post: (path, body, options) => request("POST", path, { ...options, body }),
  put: (path, body, options) => request("PUT", path, { ...options, body }),
  patch: (path, body, options) => request("PATCH", path, { ...options, body }),
  delete: (path, options) => request("DELETE", path, options),
  upload: (path, form, options) => request("POST", path, { ...options, form }),
};