const DEFAULT_API_BASE = "http://localhost:8001/api";

/**
 * Returns backend API base URL used by all hooks.
 *
 * The hooks in this app call endpoints like "/dealers", "/stock", etc.
 * To keep those stable, the resolved base URL MUST include the "/api" prefix.
 *
 * Priority:
 * 1) REACT_APP_API_BASE_URL
 * 2) (legacy) REACT_APP_API_BASE
 * 3) (legacy) REACT_APP_BACKEND_URL
 * 4) http://localhost:3001/api
 */
// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  const fromEnv =
    (process.env.REACT_APP_API_BASE_URL || "").trim() ||
    (process.env.REACT_APP_API_BASE || "").trim() ||
    (process.env.REACT_APP_BACKEND_URL || "").trim();

  // Avoid accidental trailing slashes causing double-slash URLs.
  const base = (fromEnv || DEFAULT_API_BASE).replace(/\/+$/, "");
  return base;
}
