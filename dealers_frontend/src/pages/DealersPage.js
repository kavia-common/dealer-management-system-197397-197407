import React, { useEffect, useMemo, useState } from "react";
import "./DealersPage.css";
import {
  useCreateDealer,
  useDealersList,
  useDeleteDealer,
  useUpdateDealer,
} from "../hooks/useDealersApi";

function formatCurrency(value) {
  const n = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function createEmptyForm() {
  return {
    name: "",
    contact: "",
    balance: "0",
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

/**
 * Dealers CRUD page:
 * - lists dealers (name, contact, balance)
 * - add/edit via modal controlled form
 * - delete with confirmation
 */
// PUBLIC_INTERFACE
export default function DealersPage() {
  const { data, loading, error, refetch, url } = useDealersList();

  // If the backend isn't ready, show empty state (but allow adding locally-like attempts).
  const dealers = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState(null);

  const [form, setForm] = useState(createEmptyForm());
  const [formError, setFormError] = useState(null);

  const { mutate: createDealer, loading: creating, error: createError } =
    useCreateDealer();

  const dealerIdForUpdate = editingDealer ? editingDealer.id : null;
  const { mutate: updateDealer, loading: updating, error: updateError } =
    useUpdateDealer(dealerIdForUpdate || "unknown");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const { mutate: deleteDealer, loading: deleting, error: deleteError } =
    useDeleteDealer(deleteTarget ? deleteTarget.id : "unknown");

  const openAdd = () => {
    setFormError(null);
    setEditingDealer(null);
    setForm(createEmptyForm());
    setIsModalOpen(true);
  };

  const openEdit = (dealer) => {
    setFormError(null);
    setEditingDealer(dealer);
    setForm({
      name: dealer?.name || "",
      contact: dealer?.contact || "",
      balance: String(
        typeof dealer?.balance === "number" ? dealer.balance : dealer?.balance || 0
      ),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (creating || updating) return;
    setIsModalOpen(false);
  };

  const validateForm = () => {
    const name = form.name.trim();
    if (!name) return "Dealer name is required.";

    const balanceNum = Number(form.balance);
    if (!Number.isFinite(balanceNum)) return "Balance must be a valid number.";

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
      name: form.name.trim(),
      contact: form.contact.trim(),
      balance: Number(form.balance),
    };

    try {
      if (editingDealer && editingDealer.id != null) {
        await updateDealer(payload);
      } else {
        await createDealer(payload);
      }
      setIsModalOpen(false);
      await refetch();
    } catch {
      // Error state is already set by the mutation hook. Keep modal open.
    }
  };

  const requestDelete = (dealer) => {
    setDeleteTarget(dealer);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDealer();
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
    <section className="dealersPage" aria-label="Dealers">
      <div className="dealersHeader">
        <div className="dealersHeader__text">
          <h2 className="dealersHeader__title">Dealers</h2>
          <p className="dealersHeader__subtitle">
            Manage your dealer directory. Add dealers, update contact details, and
            track current balances.
          </p>
        </div>

        <div className="dealersHeader__actions">
          <button className="btn" type="button" onClick={refetch} disabled={loading}>
            Refresh
          </button>
          <button className="btn btn--primary" type="button" onClick={openAdd}>
            Add dealer
          </button>
        </div>
      </div>

      {error ? (
        <div className="banner banner--error" role="status">
          <div>
            Could not load dealers from <span className="cellMuted">{url}</span>.
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

      <div className="dealersCard">
        <div className="dealersCard__toolbar">
          <div className="dealersCard__meta">
            {loading ? "Loading dealers…" : `${dealers.length} dealer(s)`}
          </div>
        </div>

        {dealers.length === 0 && !loading ? (
          <div className="emptyState">
            <div className="emptyState__title">No dealers yet</div>
            <p className="emptyState__desc">
              Add your first dealer to start tracking contact information and balances.
            </p>
          </div>
        ) : (
          <div className="tableWrap">
            <table className="table" aria-label="Dealers table">
              <thead>
                <tr>
                  <th style={{ width: "34%" }}>Name</th>
                  <th style={{ width: "36%" }}>Contact</th>
                  <th className="cellRight" style={{ width: "18%" }}>
                    Balance
                  </th>
                  <th className="cellRight" style={{ width: "12%" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((d, idx) => (
                  <tr key={d.id ?? `row-${idx}`}>
                    <td>{d.name || <span className="cellMuted">—</span>}</td>
                    <td className="cellMuted">
                      {d.contact ? d.contact : <span className="cellMuted">—</span>}
                    </td>
                    <td className="cellRight">{formatCurrency(d.balance)}</td>
                    <td className="cellRight">
                      <div className="rowActions">
                        <button className="btn" type="button" onClick={() => openEdit(d)}>
                          Edit
                        </button>
                        <button
                          className="btn btn--danger"
                          type="button"
                          onClick={() => requestDelete(d)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading ? (
                  <tr>
                    <td colSpan={4} className="cellMuted">
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
        <Modal title={editingDealer ? "Edit dealer" : "Add dealer"} onClose={closeModal}>
          <form onSubmit={submit}>
            <div className="modal__body">
              {mutationError ? (
                <div className="banner banner--error" role="status" style={{ margin: 0 }}>
                  {mutationError}
                </div>
              ) : null}

              <div className="formGrid" style={{ marginTop: mutationError ? 12 : 0 }}>
                <div className="formField formField--full">
                  <label className="label" htmlFor="dealerName">
                    Name
                  </label>
                  <input
                    id="dealerName"
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Sunrise Traders"
                    autoFocus
                  />
                </div>

                <div className="formField formField--full">
                  <label className="label" htmlFor="dealerContact">
                    Contact
                  </label>
                  <input
                    id="dealerContact"
                    className="input"
                    value={form.contact}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, contact: e.target.value }))
                    }
                    placeholder="Phone or email"
                  />
                  <div className="helper">
                    Optional (phone/email). You can update this later.
                  </div>
                </div>

                <div className="formField">
                  <label className="label" htmlFor="dealerBalance">
                    Balance
                  </label>
                  <input
                    id="dealerBalance"
                    className="input"
                    inputMode="decimal"
                    value={form.balance}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, balance: e.target.value }))
                    }
                    placeholder="0"
                  />
                  <div className="helper">Positive means dealer owes you (convention).</div>
                </div>

                <div className="formField">
                  <label className="label" htmlFor="dealerId">
                    Dealer ID
                  </label>
                  <input
                    id="dealerId"
                    className="input"
                    value={editingDealer?.id ?? "New"}
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
                {editingDealer ? (updating ? "Saving…" : "Save changes") : creating ? "Adding…" : "Add dealer"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Confirm delete" onClose={cancelDelete}>
          <div className="modal__body">
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              You’re about to delete <strong>{deleteTarget.name || "this dealer"}</strong>.
              This action cannot be undone.
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
