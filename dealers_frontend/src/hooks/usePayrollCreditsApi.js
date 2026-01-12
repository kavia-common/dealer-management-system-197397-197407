import { useFetch } from "./useFetch";
import { useMutation } from "./useMutation";

/**
 * Normalize list payload shapes into a stable array.
 * Accepts:
 * - { items: [...] }
 * - { entries: [...] }
 * - { payrollCredits: [...] }
 * - [...]
 * - null/undefined
 */
function normalizeEntriesList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.entries)) return payload.entries;
  if (Array.isArray(payload.payrollCredits)) return payload.payrollCredits;
  return [];
}

/**
 * Payroll/Credits entry shape used by UI:
 * {
 *   id,
 *   dealerId,
 *   dealerName,
 *   kind,         // "PAYROLL" | "CREDIT"
 *   amount,       // number (positive)
 *   effectiveDate,// ISO-ish string or null
 *   status,       // "PAID" | "UNPAID" | null
 *   reference,    // string
 *   notes         // string
 * }
 */
function normalizePayrollCreditEntry(item) {
  if (!item || typeof item !== "object") return null;

  const amountRaw =
    item.amount ??
    item.value ??
    item.total ??
    item.credit_amount ??
    item.payroll_amount ??
    0;

  const kindRaw = (item.kind ?? item.type ?? item.entryType ?? "").toString();
  const kindUpper = kindRaw.trim().toUpperCase();

  // We treat missing kind as CREDIT by default (non-breaking).
  const kind = kindUpper === "PAYROLL" ? "PAYROLL" : "CREDIT";

  return {
    id: item.id ?? item.entry_id ?? item.payroll_credit_id ?? item.payrollCreditId ?? null,
    dealerId: item.dealerId ?? item.dealer_id ?? item.dealer ?? item.dealerID ?? "",
    dealerName: item.dealerName ?? item.dealer_name ?? item.dealer?.name ?? "",
    kind,
    amount: Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : 0,
    effectiveDate:
      item.effectiveDate ??
      item.effective_date ??
      item.date ??
      item.created_at ??
      null,
    status: item.status ?? item.payment_status ?? item.paid_status ?? null,
    reference: item.reference ?? item.ref ?? item.invoice ?? item.invoice_no ?? "",
    notes: item.notes ?? item.remark ?? item.remarks ?? "",
  };
}

/**
 * Build a query object, omitting empty fields.
 */
function buildQuery({ dealerId, kind, status, from, to, q } = {}) {
  const query = {};
  if (dealerId) query.dealerId = dealerId;
  if (kind) query.kind = kind;
  if (status) query.status = status;
  if (from) query.from = from;
  if (to) query.to = to;
  if (q) query.q = q;
  return query;
}

/**
 * Compute client-side summary totals from normalized entries.
 * This is intentionally UI-side to support placeholder/early backend responses.
 *
 * Conventions:
 * - CREDIT increases what dealer owes (positive)
 * - PAYROLL decreases what dealer owes (positive payroll reduces outstanding)
 *
 * Returns:
 * {
 *   count,
 *   totalCredits,
 *   totalPayroll,
 *   netOutstanding
 * }
 */
// PUBLIC_INTERFACE
export function computePayrollCreditsSummary(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const totals = list.reduce(
    (acc, e) => {
      const amount = Number.isFinite(Number(e?.amount)) ? Number(e.amount) : 0;
      const kind = String(e?.kind || "").toUpperCase();

      if (kind === "PAYROLL") acc.totalPayroll += amount;
      else acc.totalCredits += amount;

      return acc;
    },
    { totalCredits: 0, totalPayroll: 0 }
  );

  return {
    count: list.length,
    totalCredits: totals.totalCredits,
    totalPayroll: totals.totalPayroll,
    netOutstanding: totals.totalCredits - totals.totalPayroll,
  };
}

// PUBLIC_INTERFACE
export function usePayrollCreditsList({ dealerId, kind, status, from, to, q } = {}) {
  // Placeholder-ish endpoint: backend may change; UI should degrade gracefully.
  return useFetch("/payroll-credits", {
    query: buildQuery({
      dealerId,
      kind,
      status,
      from,
      to,
      q,
    }),
    deps: [
      dealerId || "",
      kind || "",
      status || "",
      from || "",
      to || "",
      q || "",
    ],
    mapData: (payload) =>
      normalizeEntriesList(payload)
        .map(normalizePayrollCreditEntry)
        .filter(Boolean),
  });
}

// PUBLIC_INTERFACE
export function useCreatePayrollCredit() {
  const base = useMutation("/payroll-credits", { method: "POST" });

  return {
    ...base,
    mutate: async (payload) => {
      const kind = String(payload?.kind ?? payload?.txn_type ?? "CREDIT").toUpperCase();
      const body = {
        dealer_id: payload?.dealerId != null ? Number(payload.dealerId) : payload?.dealer_id,
        txn_type: kind === "PAYROLL" ? "PAYROLL" : "CREDIT",
        amount: payload?.amount,
        credit_date: payload?.effectiveDate ?? payload?.credit_date ?? null,
        description: payload?.notes ?? payload?.description ?? null,
      };
      return base.mutate(body);
    },
  };
}

// PUBLIC_INTERFACE
export function useUpdatePayrollCredit(entryId) {
  const base = useMutation(`/payroll-credits/${encodeURIComponent(String(entryId))}`, {
    method: "PUT",
  });

  return {
    ...base,
    mutate: async (payload) => {
      const kind = String(payload?.kind ?? payload?.txn_type ?? "CREDIT").toUpperCase();
      const body = {
        dealer_id: payload?.dealerId != null ? Number(payload.dealerId) : payload?.dealer_id,
        txn_type: kind === "PAYROLL" ? "PAYROLL" : "CREDIT",
        amount: payload?.amount,
        credit_date: payload?.effectiveDate ?? payload?.credit_date ?? null,
        description: payload?.notes ?? payload?.description ?? null,
      };
      return base.mutate(body);
    },
  };
}

// PUBLIC_INTERFACE
export function useDeletePayrollCredit(entryId) {
  return useMutation(`/payroll-credits/${encodeURIComponent(String(entryId))}`, {
    method: "DELETE",
  });
}
