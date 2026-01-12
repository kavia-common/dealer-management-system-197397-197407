const DEFAULT_API_BASE = "http://localhost:3001";

/**
 * Returns backend API base URL.
 *
 * Uses CRA env vars when present, otherwise falls back to localhost for dev.
 *
 * Priority:
 * 1) REACT_APP_API_BASE
 * 2) REACT_APP_BACKEND_URL
 * 3) http://localhost:3001
 */
// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  const fromEnv =
    (process.env.REACT_APP_API_BASE || "").trim() ||
    (process.env.REACT_APP_BACKEND_URL || "").trim();

  // Avoid accidental trailing slashes causing double-slash URLs.
  const base = (fromEnv || DEFAULT_API_BASE).replace(/\/+$/, "");
  return base;
}
