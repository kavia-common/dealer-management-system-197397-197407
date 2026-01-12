import { useFetch } from "./useFetch";
import { useMutation } from "./useMutation";

/**
 * Normalize various possible backend list shapes into a stable array.
 * Accepts:
 * - { items: [...] }
 * - { payments: [...] }
 * - [... ]
 * - null/undefined
 */
function normalizePaymentsList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.payments)) return payload.payments;
  return [];
}

/**
 * Payment shape used by UI:
 * {
 *   id,
 *   dealerId,
 *   dealerName,
 *   amount,
 *   method,
 *   notes,
 *   paymentDate,
 *   status  // "PAID" | "UNPAID" | null
 * }
 */
function normalizePayment(item) {
  if (!item || typeof item !== "object") return null;

  const amountRaw = item.amount ?? item.value ?? item.total ?? item.paid_amount ?? 0;

  return {
    id: item.id ?? item.payment_id ?? item.paymentId ?? null,
    dealerId: item.dealerId ?? item.dealer_id ?? item.dealer ?? item.dealerID ?? "",
    dealerName: item.dealerName ?? item.dealer_name ?? item.dealer?.name ?? "",
    amount: Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : 0,
    method: item.method ?? item.payment_method ?? item.mode ?? "",
    notes: item.notes ?? item.note ?? item.remark ?? item.remarks ?? "",
    paymentDate:
      item.paymentDate ??
      item.payment_date ??
      item.date ??
      item.created_at ??
      null,
    status: item.status ?? item.payment_status ?? item.paid_status ?? null,
  };
}

/**
 * Build a query object, omitting empty fields.
 */
function buildQuery({ dealerId, status } = {}) {
  const query = {};
  if (dealerId) query.dealerId = dealerId;
  if (status) query.status = status;
  return query;
}

// PUBLIC_INTERFACE
export function usePaymentsList({ dealerId, status } = {}) {
  return useFetch("/payments", {
    query: buildQuery({ dealerId, status }),
    deps: [dealerId || "", status || ""],
    mapData: (payload) =>
      normalizePaymentsList(payload).map(normalizePayment).filter(Boolean),
  });
}

// PUBLIC_INTERFACE
export function useCreatePayment() {
  return useMutation("/payments", { method: "POST" });
}

// PUBLIC_INTERFACE
export function useUpdatePayment(paymentId) {
  return useMutation(`/payments/${encodeURIComponent(String(paymentId))}`, {
    method: "PUT",
  });
}

// PUBLIC_INTERFACE
export function useDeletePayment(paymentId) {
  return useMutation(`/payments/${encodeURIComponent(String(paymentId))}`, {
    method: "DELETE",
  });
}


