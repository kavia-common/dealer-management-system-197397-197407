import { useFetch } from "./useFetch";
import { useMutation } from "./useMutation";

/**
 * Normalize various possible backend list shapes into a stable array.
 * Accepts:
 * - { items: [...] }
 * - { dealers: [...] }
 * - [...]
 * - null/undefined
 */
function normalizeDealersList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.dealers)) return payload.dealers;
  return [];
}

/**
 * Dealer shape used by UI:
 * { id, name, contact, balance }
 */
function normalizeDealer(item) {
  if (!item || typeof item !== "object") return null;
  return {
    id: item.id ?? item.dealer_id ?? item.dealerId ?? null,
    name: item.name ?? "",
    contact: item.contact ?? item.phone ?? item.email ?? "",
    balance:
      typeof item.balance === "number"
        ? item.balance
        : Number.isFinite(Number(item.balance))
          ? Number(item.balance)
          : 0,
  };
}

// PUBLIC_INTERFACE
export function useDealersList() {
  return useFetch("/dealers", {
    mapData: (payload) => normalizeDealersList(payload).map(normalizeDealer).filter(Boolean),
  });
}

// PUBLIC_INTERFACE
export function useCreateDealer() {
  return useMutation("/dealers", { method: "POST" });
}

// PUBLIC_INTERFACE
export function useUpdateDealer(dealerId) {
  // We keep a REST-ish convention, but backend may differ; this is a best-effort client.
  return useMutation(`/dealers/${encodeURIComponent(String(dealerId))}`, { method: "PUT" });
}

// PUBLIC_INTERFACE
export function useDeleteDealer(dealerId) {
  return useMutation(`/dealers/${encodeURIComponent(String(dealerId))}`, { method: "DELETE" });
}
