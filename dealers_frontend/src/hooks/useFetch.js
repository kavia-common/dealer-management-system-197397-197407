import { useEffect, useMemo, useRef, useState } from "react";
import { getApiBaseUrl } from "./apiConfig";

/**
 * Builds a stable URL string from base + path + optional query params.
 */
function buildUrl(baseUrl, path, query) {
  const full = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  if (!query) return full;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `${full}?${queryString}` : full;
}

/**
 * Small helper to parse JSON safely (backend may return empty bodies).
 */
async function safeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Fetch hook focused on GET requests.
 *
 * - Auto-fetches on mount and whenever `deps` change.
 * - Aborts in-flight request on unmount or re-run.
 * - Handles JSON and non-JSON responses.
 */
// PUBLIC_INTERFACE
export function useFetch(path, options = {}) {
  const {
    enabled = true,
    query,
    headers,
    deps = [],
    // Optional mapper to normalize API responses
    mapData,
  } = options;

  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const url = useMemo(() => buildUrl(apiBase, path, query), [apiBase, path, query]);

  const abortRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);

  const refetch = async () => {
    if (!enabled) return;

    // Abort any previous request before starting a new one.
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(headers || {}),
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await safeJson(res);
        const message =
          (body && body.message) ||
          (typeof body === "string" ? body : "") ||
          `Request failed (${res.status})`;
        throw new Error(message);
      }

      const parsed = await safeJson(res);
      const nextData = mapData ? mapData(parsed) : parsed;
      setData(nextData);
      return nextData;
    } catch (e) {
      // Ignore abort errors as they are expected during unmount/refetch.
      if (e && e.name === "AbortError") return;
      setError(e instanceof Error ? e : new Error("Unknown fetch error"));
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    void refetch();

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, ...deps]);

  return { data, loading, error, refetch, url };
}
