import { useFetch } from "./useFetch";
import { useMutation } from "./useMutation";

/**
 * Normalize various possible backend list shapes into a stable array.
 * Accepts:
 * - { items: [...] }
 * - { stock: [...] }
 * - { stocks: [...] }
 * - [...]
 * - null/undefined
 */
function normalizeStockList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.stock)) return payload.stock;
  if (Array.isArray(payload.stocks)) return payload.stocks;
  return [];
}

/**
 * Stock entry shape used by UI:
 * {
 *   id,
 *   dealerId,
 *   dealerName,
 *   itemName,
 *   sku,
 *   quantity,
 *   unitCost,
 *   receivedDate,
 *   notes
 * }
 */
function normalizeStockEntry(item) {
  if (!item || typeof item !== "object") return null;

  const quantityRaw = item.quantity ?? item.qty ?? 0;
  const unitCostRaw = item.unitCost ?? item.unit_cost ?? item.price ?? item.unit_price ?? 0;

  return {
    id: item.id ?? item.stock_id ?? item.stockId ?? null,
    dealerId: item.dealerId ?? item.dealer_id ?? item.dealer ?? item.dealerID ?? "",
    dealerName: item.dealerName ?? item.dealer_name ?? item.dealer?.name ?? "",
    itemName: item.itemName ?? item.item_name ?? item.product ?? item.product_name ?? "",
    sku: item.sku ?? item.SKU ?? item.code ?? "",
    quantity: Number.isFinite(Number(quantityRaw)) ? Number(quantityRaw) : 0,
    unitCost: Number.isFinite(Number(unitCostRaw)) ? Number(unitCostRaw) : 0,
    receivedDate:
      item.receivedDate ??
      item.received_date ??
      item.date ??
      item.created_at ??
      null,
    notes: item.notes ?? item.remark ?? item.remarks ?? "",
  };
}

/**
 * Build a query object, omitting empty fields.
 */
function buildQuery({ dealerId, q } = {}) {
  const query = {};
  if (dealerId) query.dealerId = dealerId;
  if (q) query.q = q;
  return query;
}

// PUBLIC_INTERFACE
export function useStockList({ dealerId, q } = {}) {
  // Best-effort endpoint. Backend may evolve; UI should degrade gracefully.
  return useFetch("/stock", {
    query: buildQuery({ dealerId, q }),
    deps: [dealerId || "", q || ""],
    mapData: (payload) =>
      normalizeStockList(payload).map(normalizeStockEntry).filter(Boolean),
  });
}

// PUBLIC_INTERFACE
export function useCreateStockEntry() {
  const base = useMutation("/stock", { method: "POST" });

  return {
    ...base,
    mutate: async (payload) => {
      // Map UI payload -> backend schema.
      const body = {
        dealer_id: payload?.dealerId != null ? Number(payload.dealerId) : payload?.dealer_id,
        item_name: payload?.itemName ?? payload?.item_name ?? "",
        quantity: payload?.quantity,
        unit_cost: payload?.unitCost ?? payload?.unit_cost,
        stock_date: payload?.receivedDate ?? payload?.stock_date ?? null,
        notes: payload?.notes ?? null,
      };
      return base.mutate(body);
    },
  };
}

// PUBLIC_INTERFACE
export function useUpdateStockEntry(stockId) {
  const base = useMutation(`/stock/${encodeURIComponent(String(stockId))}`, {
    method: "PUT",
  });

  return {
    ...base,
    mutate: async (payload) => {
      const body = {
        dealer_id: payload?.dealerId != null ? Number(payload.dealerId) : payload?.dealer_id,
        item_name: payload?.itemName ?? payload?.item_name ?? "",
        quantity: payload?.quantity,
        unit_cost: payload?.unitCost ?? payload?.unit_cost,
        stock_date: payload?.receivedDate ?? payload?.stock_date ?? null,
        notes: payload?.notes ?? null,
      };
      return base.mutate(body);
    },
  };
}

// PUBLIC_INTERFACE
export function useDeleteStockEntry(stockId) {
  return useMutation(`/stock/${encodeURIComponent(String(stockId))}`, {
    method: "DELETE",
  });
}
