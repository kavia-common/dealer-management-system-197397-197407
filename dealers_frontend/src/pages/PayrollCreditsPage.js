import React, { useEffect, useMemo, useState } from "react";
import "./PayrollCreditsPage.css";
import { useDealersList } from "../hooks/useDealersApi";
import {
  computePayrollCreditsSummary,
  useCreatePayrollCredit,
  useDeletePayrollCredit,
  usePayrollCreditsList,
  useUpdatePayrollCredit,
} from "../hooks/usePayrollCreditsApi";

function formatCurrency(value) {
  const n = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function normalizeDealerId(value) {
  const v = String(value ?? "").trim();
  return v;
}

function toYyyyMmDd(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue).slice(0, 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayYyyyMmDd() {
  return toYyyyMmDd(new Date());
}

function createEmptyForm() {
  return {
    dealerId: "",
    kind: "CREDIT",
    amount: "0",
    effectiveDate: todayYyyyMmDd(),
    status: "UNPAID",
    reference: "",
    notes: "",
  };
}

/**
 * Accessible, dependency-free modal.
 * Uses overlay click + Escape to close.
 */
function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        // Close when clicking the overlay (but not inside modal).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function badgeForKind(kind) {
  const k = String(kind || "").toUpperCase();
  if (k === "PAYROLL") return { text: "Payroll", className: "badge badge--payroll" };
  return { text: "Credit", className: "badge badge--credit" };
}

function badgeForStatus(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PAID") return { text: "Paid", className: "badge badge--paid" };
  if (s === "UNPAID") return { text: "Unpaid", className: "badge badge--unpaid" };
  return { text: "—", className: "badge" };
}

/**
 * Payroll/Credits CRUD page:
 * - list payroll & credit entries
 * - filter by dealer/kind/status/date range/search
 * - add/edit via modal
 * - delete with confirmation
 */
// PUBLIC_INTERFACE
export default function PayrollCreditsPage() {
  const {
    data: dealersData,
    loading: dealersLoading,
    error: dealersError,
    refetch: refetchDealers,
  } = useDealersList();

  const dealers = useMemo(
    () => (Array.isArray(dealersData) ? dealersData : []),
    [dealersData]
  );

  const [filters, setFilters] = useState({
    dealerId: "",
    kind: "",
    status: "",
    from: "",
    to: "",
    q: "",
  });

  const activeDealerId = normalizeDealerId(filters.dealerId);

  const { data, loading, error, refetch, url } = usePayrollCreditsList({
    dealerId: activeDealerId || undefined,
    kind: filters.kind || undefined,
    status: filters.status || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    q: filters.q.trim() || undefined,
  });

  const entries = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const dealerNameById = useMemo(() => {
    const map = new Map();
    dealers.forEach((d) => {
      const id = normalizeDealerId(d?.id);
      if (!id) return;
      map.set(id, d?.name || id);
    });
    return map;
  }, [dealers]);

  const visibleEntries = useMemo(() => {
    return entries.map((e) => {
      const dealerId = normalizeDealerId(e?.dealerId);
      return {
        ...e,
        dealerId,
        dealerName:
          e?.dealerName || (dealerId ? dealerNameById.get(dealerId) || "" : ""),
      };
    });
  }, [entries, dealerNameById]);

  const summary = useMemo(
    () => computePayrollCreditsSummary(visibleEntries),
    [visibleEntries]
  );

  const outstandingVariant = useMemo(() => {
    const v = Number.isFinite(Number(summary.netOutstanding))
      ? Number(summary.netOutstanding)
      : 0;
    if (v > 0) return "pill pill--danger"; // dealer owes you
    if (v < 0) return "pill pill--ok"; // you owe dealer (or overpaid)
    return "pill";
  }, [summary.netOutstanding]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [form, setForm] = useState(createEmptyForm());
  const [formError, setFormError] = useState(null);

  const { mutate: createEntry, loading: creating, error: createError } =
    useCreatePayrollCredit();

  const entryIdForUpdate = editingEntry ? editingEntry.id : null;
  const { mutate: updateEntry, loading: updating, error: updateError } =
    useUpdatePayrollCredit(entryIdForUpdate || "unknown");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const { mutate: deleteEntry, loading: deleting, error: deleteError } =
    useDeletePayrollCredit(deleteTarget ? deleteTarget.id : "unknown");

  const openAdd = () => {
    setFormError(null);
    setEditingEntry(null);
    setForm(createEmptyForm());
    // If user filtered by dealer, prefill dealer for faster data entry.
    if (activeDealerId) {
      setForm((prev) => ({ ...prev, dealerId: activeDealerId }));
    }
    setIsModalOpen(true);
  };

  const openEdit = (entry) => {
    setFormError(null);
    setEditingEntry(entry);

    setForm({
      dealerId: normalizeDealerId(entry?.dealerId || ""),
      kind: String(entry?.kind || "CREDIT").toUpperCase() === "PAYROLL" ? "PAYROLL" : "CREDIT",
      amount: String(Number.isFinite(Number(entry?.amount)) ? Number(entry.amount) : 0),
      effectiveDate: entry?.effectiveDate ? toYyyyMmDd(entry.effectiveDate) : todayYyyyMmDd(),
      status: String(entry?.status || "UNPAID").toUpperCase() === "PAID" ? "PAID" : "UNPAID",
      reference: entry?.reference || "",
      notes: entry?.notes || "",
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (creating || updating) return;
    setIsModalOpen(false);
  };

  const validateForm = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return "Amount must be a valid non-negative number.";
    }

    const kind = String(form.kind || "").toUpperCase();
    if (kind !== "CREDIT" && kind !== "PAYROLL") {
      return "Type must be either Credit or Payroll.";
    }

    // Dealer selection is recommended but optional in early backend stages.
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateForm();
    if (validation) {
      setFormError(validation);
      return;
    }

    const payload = {
      dealerId: normalizeDealerId(form.dealerId) || null,
      kind: String(form.kind || "CREDIT").toUpperCase(),
      amount: Number(form.amount),
      effectiveDate: form.effectiveDate || null,
      status: String(form.status || "").toUpperCase() || null,
      reference: form.reference.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (editingEntry && editingEntry.id != null) {
        await updateEntry(payload);
      } else {
        await createEntry(payload);
      }
      setIsModalOpen(false);
      await refetch();
    } catch {
      // Error state is already set by the mutation hook. Keep modal open.
    }
  };

  const requestDelete = (entry) => {
    setDeleteTarget(entry);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEntry();
      setDeleteTarget(null);
      await refetch();
    } catch {
      // keep confirmation modal open to show error banner
    }
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const mutationError =
    formError ||
    (createError ? createError.message : null) ||
    (updateError ? updateError.message : null);

  return (
    <section className="payrollCreditsPage" aria-label="Payroll and Credits">
      <div className="pcHeader">
        <div className="pcHeader__text">
          <h2 className="pcHeader__title">Payroll / Credits</h2>
          <p className="pcHeader__subtitle">
            Create, update, and track payroll and credit entries per dealer. Use filters to
            find entries and review totals.
          </p>
        </div>

        <div className="pcHeader__actions">
          <button className="btn" type="button" onClick={refetch} disabled={loading}>
            Refresh
          </button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={openAdd}
            disabled={dealersLoading}
          >
            Add entry
          </button>
        </div>
      </div>

      {dealersError ? (
        <div className="banner banner--error" role="status">
          Could not load dealers for the filter dropdown. You can still view and manage entries.
        </div>
      ) : null}

      {error ? (
        <div className="banner banner--error" role="status">
          <div>
            Could not load payroll/credits entries from{" "}
            <span className="cellMuted">{url}</span>.
          </div>
          <div className="cellMuted" style={{ marginTop: 6 }}>
            {error.message ||
              "The backend API may not be running yet. You can still view the UI."}
          </div>
        </div>
      ) : null}

      {deleteError ? (
        <div className="banner banner--error" role="status">
          Delete failed: {deleteError.message}
        </div>
      ) : null}

      <div className="pcCard">
        <div className="pcCard__toolbar">
          <div className="pcCard__meta">
            {loading ? "Loading entries…" : `${visibleEntries.length} entr(y/ies)`}
          </div>

          <div className="pcToolbarRight" aria-label="Payroll/credits summary">
            <span className="pill">Credits: {formatCurrency(summary.totalCredits)}</span>
            <span className="pill">Payroll: {formatCurrency(summary.totalPayroll)}</span>
            <span className={outstandingVariant}>
              Net outstanding: {formatCurrency(summary.netOutstanding)}
            </span>
            <button
              className="btn btn--ghost"
              type="button"
              onClick={refetchDealers}
              disabled={dealersLoading}
            >
              Reload dealers
            </button>
          </div>
        </div>

        <div className="filters" aria-label="Payroll/credits filters">
          <div className="filters__field filters__field--small">
            <label className="label" htmlFor="pcDealerFilter">
              Dealer
            </label>
            <select
              id="pcDealerFilter"
              className="input"
              value={filters.dealerId}
              onChange={(e) => setFilters((prev) => ({ ...prev, dealerId: e.target.value }))}
              disabled={dealersLoading}
            >
              <option value="">All dealers</option>
              {dealers.map((d, idx) => {
                const id = normalizeDealerId(d?.id);
                const name = d?.name || "Unnamed";
                return (
                  <option key={id || `dealer-${idx}`} value={id}>
                    {name}
                  </option>
                );
              })}
            </select>
            <div className="helper">Optional: show entries for a single dealer.</div>
          </div>

          <div className="filters__field filters__field--small">
            <label className="label" htmlFor="pcKindFilter">
              Type
            </label>
            <select
              id="pcKindFilter"
              className="input"
              value={filters.kind}
              onChange={(e) => setFilters((prev) => ({ ...prev, kind: e.target.value }))}
            >
              <option value="">All</option>
              <option value="CREDIT">Credit</option>
              <option value="PAYROLL">Payroll</option>
            </select>
            <div className="helper">Filter by entry type.</div>
          </div>

          <div className="filters__field filters__field--small">
            <label className="label" htmlFor="pcStatusFilter">
              Status
            </label>
            <select
              id="pcStatusFilter"
              className="input"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PAID">Paid</option>
            </select>
            <div className="helper">Best-effort (depends on backend fields).</div>
          </div>

          <div className="filters__field filters__field--small">
            <label className="label" htmlFor="pcFrom">
              From
            </label>
            <input
              id="pcFrom"
              className="input"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
            <div className="helper">Optional date range start.</div>
          </div>

          <div className="filters__field filters__field--small">
            <label className="label" htmlFor="pcTo">
              To
            </label>
            <input
              id="pcTo"
              className="input"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
            <div className="helper">Optional date range end.</div>
          </div>

          <div className="filters__field">
            <label className="label" htmlFor="pcSearch">
              Search
            </label>
            <input
              id="pcSearch"
              className="input"
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              placeholder="Search by reference or notes"
            />
            <div className="helper">Best-effort search (depends on backend).</div>
          </div>
        </div>

        {visibleEntries.length === 0 && !loading ? (
          <div className="emptyState">
            <div className="emptyState__title">No payroll/credit entries yet</div>
            <p className="emptyState__desc">
              Add your first entry to start tracking dealer credits and payroll deductions.
            </p>
          </div>
        ) : (
          <div className="tableWrap">
            <table className="table" aria-label="Payroll/credits table">
              <thead>
                <tr>
                  <th style={{ width: "16%" }}>Dealer</th>
                  <th style={{ width: "10%" }}>Type</th>
                  <th className="cellRight" style={{ width: "12%" }}>
                    Amount
                  </th>
                  <th style={{ width: "12%" }}>Effective</th>
                  <th style={{ width: "10%" }}>Status</th>
                  <th style={{ width: "16%" }}>Reference</th>
                  <th style={{ width: "14%" }}>Notes</th>
                  <th className="cellRight" style={{ width: "10%" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((e, idx) => {
                  const dealerLabel = e.dealerName
                    ? e.dealerName
                    : e.dealerId
                      ? e.dealerId
                      : "";

                  const kindBadge = badgeForKind(e.kind);
                  const statusBadge = badgeForStatus(e.status);

                  return (
                    <tr key={e.id ?? `row-${idx}`}>
                      <td>
                        {dealerLabel ? (
                          dealerLabel
                        ) : (
                          <span className="cellMuted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={kindBadge.className}>{kindBadge.text}</span>
                      </td>
                      <td className="cellRight">{formatCurrency(e.amount)}</td>
                      <td className="cellMuted">{formatDate(e.effectiveDate)}</td>
                      <td>
                        <span className={statusBadge.className}>{statusBadge.text}</span>
                      </td>
                      <td className="cellMuted">
                        {e.reference ? e.reference : <span className="cellMuted">—</span>}
                      </td>
                      <td className="cellMuted">
                        {e.notes ? e.notes : <span className="cellMuted">—</span>}
                      </td>
                      <td className="cellRight">
                        <div className="rowActions">
                          <button className="btn" type="button" onClick={() => openEdit(e)}>
                            Edit
                          </button>
                          <button
                            className="btn btn--danger"
                            type="button"
                            onClick={() => requestDelete(e)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {loading ? (
                  <tr>
                    <td colSpan={8} className="cellMuted">
                      Loading…
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen ? (
        <Modal
          title={editingEntry ? "Edit payroll/credit entry" : "Add payroll/credit entry"}
          onClose={closeModal}
        >
          <form onSubmit={submit}>
            <div className="modal__body">
              {mutationError ? (
                <div className="banner banner--error" role="status" style={{ margin: 0 }}>
                  {mutationError}
                </div>
              ) : null}

              <div className="formGrid" style={{ marginTop: mutationError ? 12 : 0 }}>
                <div className="formField">
                  <label className="label" htmlFor="pcDealer">
                    Dealer
                  </label>
                  <select
                    id="pcDealer"
                    className="input"
                    value={form.dealerId}
                    onChange={(e) => setForm((prev) => ({ ...prev, dealerId: e.target.value }))}
                    disabled={dealersLoading}
                  >
                    <option value="">(Optional) Select dealer</option>
                    {dealers.map((d, idx) => {
                      const id = normalizeDealerId(d?.id);
                      const name = d?.name || "Unnamed";
                      return (
                        <option key={id || `dealer-${idx}`} value={id}>
                          {name}
                        </option>
                      );
                    })}
                  </select>
                  <div className="helper">Choose a dealer if your backend requires it.</div>
                </div>

                <div className="formField">
                  <label className="label" htmlFor="pcEffectiveDate">
                    Effective date
                  </label>
                  <input
                    id="pcEffectiveDate"
                    className="input"
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))
                    }
                  />
                </div>

                <div className="formField">
                  <label className="label" htmlFor="pcKind">
                    Type
                  </label>
                  <select
                    id="pcKind"
                    className="input"
                    value={form.kind}
                    onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
                  >
                    <option value="CREDIT">Credit</option>
                    <option value="PAYROLL">Payroll</option>
                  </select>
                  <div className="helper">
                    Credit increases outstanding; Payroll decreases outstanding.
                  </div>
                </div>

                <div className="formField">
                  <label className="label" htmlFor="pcStatus">
                    Status
                  </label>
                  <select
                    id="pcStatus"
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PAID">Paid</option>
                  </select>
                  <div className="helper">Optional; backend may ignore.</div>
                </div>

                <div className="formField">
                  <label className="label" htmlFor="pcAmount">
                    Amount
                  </label>
                  <input
                    id="pcAmount"
                    className="input"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="0"
                    autoFocus
                  />
                  <div className="helper">Use a positive number (we infer direction by type).</div>
                </div>

                <div className="formField">
                  <label className="label" htmlFor="pcEntryId">
                    Entry ID
                  </label>
                  <input
                    id="pcEntryId"
                    className="input"
                    value={editingEntry?.id ?? "New"}
                    readOnly
                  />
                  <div className="helper">Assigned by backend once saved.</div>
                </div>

                <div className="formField formField--full">
                  <label className="label" htmlFor="pcReference">
                    Reference
                  </label>
                  <input
                    id="pcReference"
                    className="input"
                    value={form.reference}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, reference: e.target.value }))
                    }
                    placeholder="Optional (invoice #, batch, memo)"
                  />
                </div>

                <div className="formField formField--full">
                  <label className="label" htmlFor="pcNotes">
                    Notes
                  </label>
                  <input
                    id="pcNotes"
                    className="input"
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>
              </div>
            </div>

            <div className="modal__footer">
              <button
                className="btn"
                type="button"
                onClick={closeModal}
                disabled={creating || updating}
              >
                Cancel
              </button>
              <button className="btn btn--primary" type="submit" disabled={creating || updating}>
                {editingEntry
                  ? updating
                    ? "Saving…"
                    : "Save changes"
                  : creating
                    ? "Adding…"
                    : "Add entry"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Confirm delete" onClose={cancelDelete}>
          <div className="modal__body">
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              You’re about to delete this entry for{" "}
              <strong>
                {deleteTarget.dealerName ||
                  deleteTarget.dealerId ||
                  "an unknown dealer"}
              </strong>
              . This action cannot be undone.
            </p>
          </div>
          <div className="modal__footer">
            <button className="btn" type="button" onClick={cancelDelete} disabled={deleting}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
