import React, { useMemo } from "react";
import "./FinanceDashboardPage.css";
import { useFinanceSummary } from "../hooks/useFinanceApi";

function formatCurrency(value, currency = "USD") {
  const n = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(undefined, { style: "currency", currency });
}

function clamp01(v) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function buildPlaceholderCharts() {
  return {
    cashflow: [
      { label: "Mon", value: 1200 },
      { label: "Tue", value: 900 },
      { label: "Wed", value: 1600 },
      { label: "Thu", value: 1100 },
      { label: "Fri", value: 1900 },
      { label: "Sat", value: 700 },
    ],
    outstandingByBucket: [
      { label: "0-7", value: 2400 },
      { label: "8-14", value: 1800 },
      { label: "15-30", value: 1200 },
      { label: "30+", value: 900 },
      { label: "New", value: 600 },
      { label: "Other", value: 300 },
    ],
  };
}

function normalizeChartInput(items, maxBars = 6) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items
    .slice(0, maxBars)
    .map((it, idx) => ({
      label: String(it?.label ?? `#${idx + 1}`),
      value: Number.isFinite(Number(it?.value)) ? Number(it.value) : 0,
    }));
}

function SimpleBarChart({ title, subtitle, items, legend }) {
  const normalized = useMemo(() => normalizeChartInput(items, 6), [items]);

  const maxValue = useMemo(() => {
    if (normalized.length === 0) return 0;
    return Math.max(...normalized.map((x) => x.value));
  }, [normalized]);

  return (
    <div className="panel" aria-label={title}>
      <div className="panel__header">
        <div>
          <h3 className="panel__title">{title}</h3>
          <p className="panel__meta">{subtitle}</p>
        </div>
        <div className="panel__right">
          {legend ? (
            <div className="miniLegend" aria-label="Legend">
              {legend.map((l) => (
                <span key={l.key}>
                  <span className={`legendDot ${l.dotClass}`} aria-hidden="true" /> {l.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="chartWrap">
        <div className="barChart" role="img" aria-label={`${title} chart`}>
          {normalized.map((b) => {
            const pct = maxValue > 0 ? b.value / maxValue : 0;
            return (
              <div className="bar" key={b.label}>
                <div className="bar__col" aria-label={`${b.label}: ${b.value}`}>
                  <div className="bar__fill" style={{ height: `${clamp01(pct) * 100}%` }} />
                </div>
                <div className="bar__label">{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export default function FinanceDashboardPage() {
  const { summary, loading, error, refetch, url } = useFinanceSummary();

  // If backend isn’t ready, charts still render with placeholders.
  const placeholderCharts = useMemo(() => buildPlaceholderCharts(), []);
  const cashflowItems =
    summary?.charts?.cashflow && summary.charts.cashflow.length > 0
      ? summary.charts.cashflow
      : placeholderCharts.cashflow;

  const outstandingBucketItems =
    summary?.charts?.outstandingByBucket && summary.charts.outstandingByBucket.length > 0
      ? summary.charts.outstandingByBucket
      : placeholderCharts.outstandingByBucket;

  const currency = summary?.currency || "USD";

  // Placeholder-friendly KPIs (API may return zeros until wired).
  const totalAssets = summary?.totals?.totalAssets ?? 0;
  const totalReceivables = summary?.totals?.totalReceivables ?? 0;
  const totalPayables = summary?.totals?.totalPayables ?? 0;
  const netPosition =
    summary?.totals?.netPosition ??
    (Number(totalAssets) + Number(totalReceivables) - Number(totalPayables));

  const unpaidCount = summary?.outstanding?.unpaidCount ?? 0;
  const unpaidAmount = summary?.outstanding?.unpaidAmount ?? 0;
  const paidThisMonth = summary?.outstanding?.paidThisMonth ?? 0;

  const apiStatusText = loading
    ? "Loading summary…"
    : error
      ? "Backend not available (showing placeholders)"
      : "Live";

  return (
    <section className="financeDash" aria-label="Finance Dashboard">
      <div className="financeDashHeader">
        <div className="financeDashHeader__text">
          <h2 className="financeDashHeader__title">Finance Dashboard</h2>
          <p className="financeDashHeader__subtitle">
            Overview of assets, receivables, payables, and outstanding balances.
          </p>
        </div>

        <div className="financeDashHeader__actions">
          <span className="kpiPill" aria-label="API status">
            {apiStatusText}
          </span>
          <button className="btn" type="button" onClick={refetch} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="banner banner--error" role="status">
          <div>
            Could not load finance summary from <span className="cellMuted">{url}</span>.
          </div>
          <div className="cellMuted" style={{ marginTop: 6 }}>
            {error.message ||
              "Finance routes are not implemented yet. Dashboard is showing placeholder values."}
          </div>
        </div>
      ) : null}

      <div className="kpiGrid" aria-label="Summary KPIs">
        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiLabel">Total assets</div>
            <div className="kpiPill">Primary</div>
          </div>
          <div className="kpiValueRow">
            <div className="kpiValue">{formatCurrency(totalAssets, currency)}</div>
            <div className="kpiDelta">All tracked assets</div>
          </div>
          <div className="kpiAccent" aria-hidden="true" />
        </div>

        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiLabel">Receivables</div>
            <div className="kpiPill">#3b82f6</div>
          </div>
          <div className="kpiValueRow">
            <div className="kpiValue">{formatCurrency(totalReceivables, currency)}</div>
            <div className="kpiDelta">Expected inflows</div>
          </div>
          <div className="kpiAccent" aria-hidden="true" />
        </div>

        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiLabel">Payables</div>
            <div className="kpiPill">#64748b</div>
          </div>
          <div className="kpiValueRow">
            <div className="kpiValue">{formatCurrency(totalPayables, currency)}</div>
            <div className="kpiDelta">Expected outflows</div>
          </div>
          <div className="kpiAccent" aria-hidden="true" />
        </div>

        <div className="kpiCard">
          <div className="kpiTop">
            <div className="kpiLabel">Outstanding (unpaid)</div>
            <div className="kpiPill">#06b6d4</div>
          </div>
          <div className="kpiValueRow">
            <div className="kpiValue">{formatCurrency(unpaidAmount, currency)}</div>
            <div className="kpiDelta">{unpaidCount} unpaid</div>
          </div>
          <div className="kpiAccent" aria-hidden="true" />
        </div>

        <div className="kpiCard kpiCard--wide">
          <div className="kpiTop">
            <div className="kpiLabel">Net position</div>
            <div className="kpiPill">Assets + Receivables − Payables</div>
          </div>
          <div className="kpiValueRow">
            <div className="kpiValue">{formatCurrency(netPosition, currency)}</div>
            <div className="kpiDelta">Quick snapshot</div>
          </div>
          <div className="kpiAccent" aria-hidden="true" />
        </div>

        <div className="kpiCard kpiCard--wide">
          <div className="kpiTop">
            <div className="kpiLabel">Paid this month</div>
            <div className="kpiPill">Trend</div>
          </div>
          <div className="kpiValueRow">
            <div className="kpiValue">{formatCurrency(paidThisMonth, currency)}</div>
            <div className="kpiDelta">Settled payments</div>
          </div>
          <div className="kpiAccent" aria-hidden="true" />
        </div>
      </div>

      <div className="panelGrid" aria-label="Charts">
        <SimpleBarChart
          title="Cashflow (last 6 days)"
          subtitle="Simple placeholder chart until backend reporting is available."
          items={cashflowItems}
          legend={[
            { key: "inflow", label: "Inflow", dotClass: "legendDot legendDot--primary" },
            { key: "outflow", label: "Outflow", dotClass: "legendDot legendDot--success" },
          ]}
        />

        <SimpleBarChart
          title="Outstanding by age bucket"
          subtitle="Higher bars indicate more unpaid balance in that bucket."
          items={outstandingBucketItems}
        />
      </div>

      <div className="noteCard" aria-label="Integration note">
        <h3 className="noteTitle">Backend wiring (stub)</h3>
        <p className="noteText">
          This dashboard calls <span className="cellMuted">GET {url}</span>. If the API is not
          implemented yet, the page shows safe placeholders and remains fully functional.
        </p>
      </div>
    </section>
  );
}
