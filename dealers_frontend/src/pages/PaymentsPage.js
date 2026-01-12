import React, { useEffect, useMemo, useState } from "react";
import "./PaymentsPage.css";
import { useDealersList } from "../hooks/useDealersApi";
import {
  useCreatePayment,
  useDeletePayment,
  usePaymentsList,
  useUpdatePayment,
} from "../hooks/usePaymentsApi";

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
  return String(value ?? "").trim();
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
    paymentDate: todayYyyyMmDd(),
    amount: "0",
    method: "",
    notes: "",
    status: "UNPAID",
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

function badgeForStatus(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PAID") return { text: "Paid", className: "badge badge--paid" };
  if (s === "UNPAID") return { text: "Unpaid", className: "badge badge--unpaid" };
  return { text: "—", className: "badge" };
}

/**
 * Payments CRUD page:
 * - list payments
 * - filter by dealer/status
 * - add/edit via modal
 * - delete with confirmation
 */
// PUBLIC_INTERFACE
export default function PaymentsPage() {
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

  const dealerNameById = useMemo(() => {
    const map = new Map();
    dealers.forEach((d) => {
      const id = normalizeDealerId(d?.id);
      if (!id) return;
      map.set(id, d?.name || id);
    });
    return map;
  }, [dealers]);

  const [filters, setFilters] = useState({ dealerId: "", status: "" });
  const activeDealerId = normalizeDealerId(filters.dealerId);

  const { data, loading, error, refetch, url } = usePaymentsList({
    dealerId: activeDealerId || undefined,
    status: filters.status || undefined,
  });

  const payments = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const visiblePayments = useMemo(() => {
    return payments.map((p) => {
      const dealerId = normalizeDealerId(p?.dealerId);
      return {
        ...p,
        dealerId,
        dealerName:
          p?.dealerName || (dealerId ? dealerNameById.get(dealerId) || "" : ""),
      };
    });
  }, [payments, dealerNameById]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const [form, setForm] = useState(createEmptyForm());
  const [formError, setFormError] = useState(null);

  const { mutate: createPayment, loading: creating, error: createError } =
    useCreatePayment();

  const paymentIdForUpdate = editingPayment ? editingPayment.id : null;
  const { mutate: updatePayment, loading: updating, error: updateError } =
    useUpdatePayment(paymentIdForUpdate || "unknown");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const { mutate: deletePayment, loading: deleting, error: deleteError } =
    useDeletePayment(deleteTarget ? deleteTarget.id : "unknown");

  const openAdd = () => {
    setFormError(null);
    setEditingPayment(null);
    setForm(createEmptyForm());
    // Prefill dealer from active filter for faster entry.
    if (activeDealerId) {
      setForm((prev) => ({ ...prev, dealerId: activeDealerId }));
    }
    setIsModalOpen(true);
  };

  const openEdit = (payment) => {
    setFormError(null);
    setEditingPayment(payment);

    setForm({
      dealerId: normalizeDealerId(payment?.dealerId || ""),
      paymentDate: payment?.paymentDate ? toYyyyMmDd(payment.paymentDate) : todayYyyyMmDd(),
      amount: String(Number.isFinite(Number(payment?.amount)) ? Number(payment.amount) : 0),
      method: payment?.method || "",
      notes: payment?.notes || "",
      status: String(payment?.status || "UNPAID").toUpperCase() === "PAID" ? "PAID" : "UNPAID",
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (creating || updating) return;
    setIsModalOpen(false);
  };

  const validateForm = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) return "Amount must be a valid non-negative number.";

    const status = String(form.status || "").toUpperCase();
    if (status !== "PAID" && status !== "UNPAID") return "Status must be Paid or Unpaid.";

    // Dealer is recommended but optional to avoid blocking early backend integration.
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
      paymentDate: form.paymentDate || null,
      amount: Number(form.amount),
      method: form.method.trim(),
      notes: form.notes.trim(),
      status: String(form.status || "").toUpperCase() || null,
    };

    try {
      if (editingPayment && editingPayment.id != null) {
        await updatePayment(payload);
      } else {
        await createPayment(payload);
      }
      setIsModalOpen(false);
      await refetch();
    } catch {
      // keep modal open; hook sets error
    }
  };

  const requestDelete = (payment) => setDeleteTarget(payment);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePayment();
      setDeleteTarget(null);
      await refetch();
    } catch {
      // keep modal open to show error banner
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
    <section className="paymentsPage" aria-label="Payments">
      <div className="paymentsHeader">
        <div className="paymentsHeader__text">
          <h2 className="paymentsHeader__title">Payments</h2>
          <p className="paymentsHeader__subtitle">
            Record payments from dealers, mark them paid/unpaid, and review payment history.
          </p>
        </div>

        <div className="paymentsHeader__actions">
          <button className="btn" type="button" onClick={refetch} disabled={loading}>
            Refresh
          </button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={openAdd}
            disabled={dealersLoading}
          >
            Add payment
          </button>
        </div>
      </div>

      {dealersError ? (
        <div className="banner banner--error" role="status">
          Could not load dealers for dropdowns. You can still view/manage payments.
        </div>
      ) : null}

      {error ? (
        <div className="banner banner--error" role="status">
          <div>
            Could not load payments from <span className="cellMuted">{url}</span>.
          </div>
          <div className="cellMuted" style={{ marginTop: 6 }}>
            {error.message || "The backend API may not be running yet. You can still view the UI."}
          </div>
        </div>
      ) : null}

      {deleteError ? (
        <div className="banner banner--error" role="status">
          Delete failed: {deleteError.message}
        </div>
      ) : null}

      <div className="paymentsCard">
        <div className="paymentsCard__toolbar">
          <div className="paymentsCard__meta">
            {loading ? "Loading payments…" : `${visiblePayments.length} payment(s)`}
          </div>

          <div className="paymentsToolbarRight">
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

        <div className="filters" aria-label="Payments filters">
          <div className="filters__field filters__field--small">
            <label className="label" htmlFor="paymentsDealerFilter">
              Dealer
            </label>
            <select
              id="paymentsDealerFilter"
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
            <div className="helper">Optional: show payments for one dealer.</div>
          </div>

          <div className="filters__field filters__field--small">
            <label className="label" htmlFor="paymentsStatusFilter">
              Status
            </label>
            <select
              id="paymentsStatusFilter"
              className="input"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PAID">Paid</option>
            </select>
            <div className="helper">Paid/unpaid status view.</div>
          </div>
        </div>

        {visiblePayments.length === 0 && !loading ? (
          <div className="emptyState">
            <div className="emptyState__title">No payments yet</div>
            <p className="emptyState__desc">
              Add your first payment to start tracking dealer settlements and status.
            </p>
          </div>
        ) : (
          <div className="tableWrap">
            <table className="table" aria-label="Payments table">
              <thead>
                <tr>
                  <th style={{ width: "14%" }}>Date</th>
                  <th style={{ width: "18%" }}>Dealer</th>
                  <th className="cellRight" style={{ width: "12%" }}>
                    Amount
                  </th>
                  <th style={{ width: "16%" }}>Method</th>
                  <th style={{ width: "24%" }}>Notes</th>
                  <th style={{ width: "10%" }}>Status</th>
                  <th className="cellRight" style={{ width: "6%" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((p, idx) => {
                  const statusBadge = badgeForStatus(p.status);
                  const dealerLabel = p.dealerName
                    ? p.dealerName
                    : p.dealerId
                      ? p.dealerId
                      : "";

                  return (
                    <tr key={p.id ?? `row-${idx}`}>
                      <td className="cellMuted">{formatDate(p.paymentDate)}</td>
                      <td>
                        {dealerLabel ? dealerLabel : <span className="cellMuted">—</span>}
                      </td>
                      <td className="cellRight">{formatCurrency(p.amount)}</td>
                      <td className="cellMuted">
                        {p.method ? p.method : <span className="cellMuted">—</span>}
                      </td>
                      <td className="cellMuted">
                        {p.notes ? p.notes : <span className="cellMuted">—</span>}
                      </td>
                      <td>
                        <span className={statusBadge.className}>{statusBadge.text}</span>
                      </td>
                      <td className="cellRight">
                        <div className="rowActions">
                          <button className="btn" type="button" onClick={() => openEdit(p)}>
                            Edit
                          </button>
                          <button
                            className="btn btn--danger"
                            type="button"
                            onClick={() => requestDelete(p)}
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
                    <td colSpan={7} className="cellMuted">
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
        <Modal title={editingPayment ? "Edit payment" : "Add payment"} onClose={closeModal}>
          <form onSubmit={submit}>
            <div className="modal__body">
              {mutationError ? (
                <div className="banner banner--error" role="status" style={{ margin: 0 }}>
                  {mutationError}
                </div>
              ) : null}

              <div className="formGrid" style={{ marginTop: mutationError ? 12 : 0 }}>
                <div className="formField">
                  <label className="label" htmlFor="paymentDealer">
                    Dealer
                  </label>
                  <select
                    id="paymentDealer"
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
                  <label className="label" htmlFor="paymentDate">
                    Payment date
                  </label>
                  <input
                    id="paymentDate"
                    className="input"
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                  />
                </div>

                <div className="formField">
                  <label className="label" htmlFor="paymentStatus">
                    Status
                  </label>
                  <select
                    id="paymentStatus"
                    className="input"
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PAID">Paid</option>
                  </select>
                  <div className="helper">Shown as status pill in the table.</div>
                </div>

                <div className="formField">
                  <label className="label" htmlFor="paymentAmount">
                    Amount
                  </label>
                  <input
                    id="paymentAmount"
                    className="input"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="0"
                    autoFocus
                  />
                  <div className="helper">Use a positive amount.</div>
                </div>

                <div className="formField formField--full">
                  <label className="label" htmlFor="paymentMethod">
                    Method
                  </label>
                  <input
                    id="paymentMethod"
                    className="input"
                    value={form.method}
                    onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value }))}
                    placeholder="e.g., Cash, Bank transfer, Card"
                  />
                </div>

                <div className="formField formField--full">
                  <label className="label" htmlFor="paymentNotes">
                    Notes
                  </label>
                  <input
                    id="paymentNotes"
                    className="input"
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes"
                  />
                </div>

                <div className="formField">
                  <label className="label" htmlFor="paymentId">
                    Payment ID
                  </label>
                  <input
                    id="paymentId"
                    className="input"
                    value={editingPayment?.id ?? "New"}
                    readOnly
                  />
                  <div className="helper">Assigned by backend once saved.</div>
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
                {editingPayment
                  ? updating
                    ? "Saving…"
                    : "Save changes"
                  : creating
                    ? "Adding…"
                    : "Add payment"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Confirm delete" onClose={cancelDelete}>
          <div className="modal__body">
            <p className="confirmText">
              You’re about to delete this payment{" "}
              <strong>
                {deleteTarget.dealerName ||
                  deleteTarget.dealerId ||
                  "for an unknown dealer"}
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
