import { useMemo, useState } from "react";
import { getApiBaseUrl } from "./apiConfig";

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
 * Mutation hook for non-GET requests.
 *
 * Usage:
 * const { mutate, loading, error } = useMutation("/dealers", { method: "POST" });
 * await mutate({ name: "A", contact: "B", balance: 0 });
 */
// PUBLIC_INTERFACE
export function useMutation(path, options = {}) {
  const { method = "POST", headers } = options;

  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const url = useMemo(
    () => `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`,
    [apiBase, path]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = async (body) => {
    setLoading(true);
    setError(null);

    try {
      const hasBody = body !== undefined;
      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          ...(headers || {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const parsed = await safeJson(res);
        const message =
          (parsed && parsed.message) ||
          (typeof parsed === "string" ? parsed : "") ||
          `Request failed (${res.status})`;
        throw new Error(message);
      }

      return await safeJson(res);
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Unknown mutation error");
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error, url };
}
