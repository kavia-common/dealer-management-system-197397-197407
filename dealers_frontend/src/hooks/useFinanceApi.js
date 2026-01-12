import { useMemo } from "react";
import { useFetch } from "./useFetch";

/**
 * Normalizes a finance summary payload into a stable, UI-friendly shape.
 * If backend is not available (null/unknown payload), returns a placeholder object.
 */
function normalizeFinanceSummary(payload) {
  const safe = payload && typeof payload === "object" ? payload : {};

  const num = (v) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Keep the shape stable so the UI never crashes even when API is missing.
  return {
    currency: typeof safe.currency === "string" ? safe.currency : "USD",

    totals: {
      totalAssets: num(safe?.totals?.totalAssets ?? safe?.totalAssets),
      totalReceivables: num(safe?.totals?.totalReceivables ?? safe?.totalReceivables),
      totalPayables: num(safe?.totals?.totalPayables ?? safe?.totalPayables),
      netPosition: num(safe?.totals?.netPosition ?? safe?.netPosition),
    },

    outstanding: {
      unpaidCount: num(safe?.outstanding?.unpaidCount ?? safe?.unpaidCount),
      unpaidAmount: num(safe?.outstanding?.unpaidAmount ?? safe?.unpaidAmount),
      paidThisMonth: num(safe?.outstanding?.paidThisMonth ?? safe?.paidThisMonth),
    },

    /**
     * For lightweight “sparkline” bar charts.
     * Expected: [{ label: "Mon", value: 1200 }, ...]
     */
    charts: {
      cashflow: Array.isArray(safe?.charts?.cashflow) ? safe.charts.cashflow : [],
      outstandingByBucket: Array.isArray(safe?.charts?.outstandingByBucket)
        ? safe.charts.outstandingByBucket
        : [],
    },

    /**
     * Optional “lastUpdated” string or ISO date; UI can display if present.
     */
    lastUpdated: typeof safe.lastUpdated === "string" ? safe.lastUpdated : "",
  };
}

/**
 * Finance summary API hook.
 *
 * Backend route is expected to be implemented later.
 * For now, this hook safely degrades to placeholder values in the UI.
 */
// PUBLIC_INTERFACE
export function useFinanceSummary() {
  // Route stub (to be wired to backend later).
  // The UI will show placeholders if this fails.
  const path = "/finance/summary";

  const { data, loading, error, refetch, url } = useFetch(path, {
    enabled: true,
    deps: [],
    mapData: (payload) => normalizeFinanceSummary(payload),
  });

  const summary = useMemo(() => normalizeFinanceSummary(data), [data]);

  return { summary, loading, error, refetch, url };
}
