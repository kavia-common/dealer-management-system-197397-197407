import React, { useEffect, useMemo, useState } from "react";
import "./StockPage.css";
import { useDealersList } from "../hooks/useDealersApi";
import {
  useCreateStockEntry,
  useDeleteStockEntry,
  useStockList,
  useUpdateStockEntry,
} from "../hooks/useStockApi";

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

function createEmptyForm() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  return {
    dealerId: "",
    itemName: "",
    sku: "",
    quantity: "1",
    unitCost: "0",
    receivedDate: `${yyyy}-${mm}-${dd}`,
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

function normalizeDealerId(value) {
  const v = String(value ?? "").trim();
  return v;
}

// PUBLIC_INTERFACE
export default function StockPage() {
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

  const [filters, setFilters] = useState({ dealerId: "", q: "" });
  const activeDealerId = normalizeDealerId(filters.dealerId);

  const { data, loading, error, refetch, url } = useStockList({
    dealerId: activeDealerId || undefined,
    q: filters.q.trim() || undefined,
  });

  const entries = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [form, setForm] = useState(createEmptyForm());
  const [formError, setFormError] = useState(null);

  const { mutate: createEntry, loading: creating, error: createError } =
    useCreateStockEntry();

  const entryIdForUpdate = editingEntry ? editingEntry.id : null;
  const { mutate: updateEntry, loading: updating, error: updateError } =
    useUpdateStockEntry(entryIdForUpdate || "unknown");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const { mutate: deleteEntry, loading: deleting, error: deleteError } =
    useDeleteStockEntry(deleteTarget ? deleteTarget.id : "unknown");

  const openAdd = () => {
    setFormError(null);
    setEditingEntry(null);
    setForm(createEmptyForm());
    setIsModalOpen(true);
  };

  const openEdit = (entry) => {
    setFormError(null);
    setEditingEntry(entry);

    setForm({
      dealerId: normalizeDealerId(entry?.dealerId || ""),
      itemName: entry?.itemName || "",
      sku: entry?.sku || "",
      quantity: String(
        Number.isFinite(Number(entry?.quantity)) ? Number(entry.quantity) : 0
      ),
      unitCost: String(
        Number.isFinite(Number(entry?.unitCost)) ? Number(entry.unitCost) : 0
      ),
      receivedDate: entry?.receivedDate
        ? String(entry.receivedDate).slice(0, 10)
        : createEmptyForm().receivedDate,
      notes: entry?.notes || "",
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (creating || updating) return;
    setIsModalOpen(false);
  };

  const validateForm = () => {
    const itemName = form.itemName.trim();
    if (!itemName) return "Item name is required.";

    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) return "Quantity must be > 0.";

    const unitCost = Number(form.unitCost);
    if (!Number.isFinite(unitCost) || unitCost < 0)
      return "Unit cost must be a valid non-negative number.";

    // Dealer selection is recommended but not required in case backend differs.
    // We keep it optional to avoid blocking UI usage early in development.
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
      itemName: form.itemName.trim(),
      sku: form.sku.trim(),
      quantity: Number(form.quantity),
      unitCost: Number(form.unitCost),
      receivedDate: form.receivedDate || null,
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

  const dealerNameById = useMemo(() => {
    const map = new Map();
    dealers.forEach((d) => {
      const id = normalizeDealerId(d?.id);
      if (!id) return;
      map.set(id, d?.name || id);
    });
    return map;
  }, [dealers]);

  const visibleEntries = entries.map((e) => {
    const dealerId = normalizeDealerId(e.dealerId);
    return {
      ...e,
      dealerId,
      dealerName:
        e.dealerName ||
        (dealerId ? dealerNameById.get(dealerId) || "" : ""),
    };
  });

  const totalValue = useMemo(() => {
    return visibleEntries.reduce((sum, e) => {
      const qty = Number.isFinite(Number(e.quantity)) ? Number(e.quantity) : 0;
      const unit = Number.isFinite(Number(e.unitCost)) ? Number(e.unitCost) : 0;
      return sum + qty * unit;
    }, 0);
  }, [visibleEntries]);

  return (
    <section className="stockPage" aria-label="Stock">
      <div className="stockHeader">
        <div className="stockHeader__text">
          <h2 className="stockHeader__title">Stock</h2>
          <p className="stockHeader__subtitle">
            Track stock received from dealers. Filter by dealer, add new stock
            entries, and update quantities/costs.
          </p>
        </div>

        <div className="stockHeader__actions">
          <button className="btn" type="button" onClick={refetch} disabled={loading}>
            Refresh
          </button>
          <button
            className="btn btn--primary"
            type="button"
            onClick={openAdd}
            disabled={dealersLoading}
          >
            Add stock
          </button>
        </div>
      </div>

      {dealersError ? (
        <div className="banner banner--error" role="status">
          Could not load dealers for the filter dropdown. You can still manage
          stock entries.
        </div>
      ) : null}

      {error ? (
        <div className="banner banner--error" role="status">
          <div>
            Could not load stock entries from{" "}
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

      <div className="stockCard">
        <div className="stockCard__toolbar">
          <div className="stockCard__meta">
            {loading ? "Loading stock…" : `${visibleEntries.length} entr(y/ies)`}
          </div>

          <div className="stockToolbarRight" aria-label="Stock summary">
            <span className="pill">Total value: {formatCurrency(totalValue)}</span>
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

        <div className="filters" aria-label="Stock filters">
          <div className="filters__field filters__field--small">
            <label className="label" htmlFor="stockDealerFilter">
              Dealer
            </label>
            <select
              id="stockDealerFilter"
              className="input"
              value={filters.dealerId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dealerId: e.target.value }))
              }
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
            <div className="helper">
              Optional: filter stock entries by dealer.
            </div>
          </div>

          <div className="filters__field">
            <label className="label" htmlFor="stockSearch">
              Search
            </label>
            <input
              id="stockSearch"
              className="input"
              value={filters.q}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, q: e.target.value }))
              }
              placeholder="Search by item name or SKU"
            />
            <div className="helper">Best-effort search (depends on backend).</div>
          </div>
        </div>

        {visibleEntries.length === 0 && !loading ? (
          <div className="emptyState">
            <div className="emptyState__title">No stock entries yet</div>
            <p className="emptyState__desc">
              Add your first stock entry to start tracking quantities and value
              per dealer.
            </p>
          </div>
        ) : (
          <div className="tableWrap">
            <table className="table" aria-label="Stock table">
              <thead>
                <tr>
                  <th style={{ width: "18%" }}>Dealer</th>
                  <th style={{ width: "22%" }}>Item</th>
                  <th style={{ width: "12%" }}>SKU</th>
                  <th className="cellRight" style={{ width: "10%" }}>
                    Qty
                  </th>
                  <th className="cellRight" style={{ width: "12%" }}>
                    Unit cost
                  </th>
                  <th className="cellRight" style={{ width: "12%" }}>
                    Total
                  </th>
                  <th style={{ width: "14%" }}>Received</th>
                  <th className="cellRight" style={{ width: "10%" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((e, idx) => {
                  const qty = Number.isFinite(Number(e.quantity))
                    ? Number(e.quantity)
                    : 0;
                  const unit = Number.isFinite(Number(e.unitCost))
                    ? Number(e.unitCost)
                    : 0;
                  const rowTotal = qty * unit;

                  return (
                    <tr key={e.id ?? `row-${idx}`}>
                      <td>
                        {e.dealerName ? (
                          e.dealerName
                        ) : e.dealerId ? (
                          <span className="cellMuted">{e.dealerId}</span>
                        ) : (
                          <span className="cellMuted">—</span>
                        )}
                      </td>
                      <td>{e.itemName || <span className="cellMuted">—</span>}</td>
                      <td className="cellMuted">
                        {e.sku ? e.sku : <span className="cellMuted">—</span>}
                      </td>
                      <td className="cellRight">{qty}</td>
                      <td className="cellRight">{formatCurrency(unit)}</td>
                      <td className="cellRight">{formatCurrency(rowTotal)}</td>
                      <td className="cellMuted">{formatDate(e.receivedDate)}</td>
                      <td className="cellRight">
                        <div className="rowActions">
                          <button
                            className="btn"
                            type="button"
                            onClick={() => openEdit(e)}
                          >
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
          title={editingEntry ? "Edit stock entry" : "Add stock entry"}
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
                  <label className="label" htmlFor="stockDealer">
                    Dealer
                  </label>
                  <select
                    id="stockDealer"
                    className="input"
                    value={form.dealerId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dealerId: e.target.value }))
                    }
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
                  <div className="helper">
                    If backend requires a dealer, choose one here.
                  </div>
                </div>

                <div className="formField">
                  <label className="label" htmlFor="stockReceivedDate">
                    Received date
                  </label>
                  <input
                    id="stockReceivedDate"
                    className="input"
                    type="date"
                    value={form.receivedDate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, receivedDate: e.target.value }))
                    }
                  />
                </div>

                <div className="formField formField--full">
                  <label className="label" htmlFor="stockItemName">
                    Item name
                  </label>
                  <input
                    id="stockItemName"
                    className="input"
                    value={form.itemName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, itemName: e.target.value }))
                    }
                    placeholder="e.g., Rice (25kg bag)"
                    autoFocus
                  />
                </div>

                <div className="formField">
                  <label className="label" htmlFor="stockSku">
                    SKU
                  </label>
                  <input
                    id="stockSku"
                    className="input"
                    value={form.sku}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="formField">
                  <label className="label" htmlFor="stockQty">
                    Quantity
                  </label>
                  <input
                    id="stockQty"
                    className="input"
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, quantity: e.target.value }))
                    }
                    placeholder="1"
                  />
                </div>

                <div className="formField">
                  <label className="label" htmlFor="stockUnitCost">
                    Unit cost
                  </label>
                  <input
                    id="stockUnitCost"
                    className="input"
                    inputMode="decimal"
                    value={form.unitCost}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, unitCost: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>

                <div className="formField">
                  <label className="label" htmlFor="stockEntryId">
                    Stock ID
                  </label>
                  <input
                    id="stockEntryId"
                    className="input"
                    value={editingEntry?.id ?? "New"}
                    readOnly
                  />
                  <div className="helper">Assigned by backend once saved.</div>
                </div>

                <div className="formField formField--full">
                  <label className="label" htmlFor="stockNotes">
                    Notes
                  </label>
                  <input
                    id="stockNotes"
                    className="input"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Optional notes (batch, condition, etc.)"
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
                    : "Add stock"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Confirm delete" onClose={cancelDelete}>
          <div className="modal__body">
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              You’re about to delete{" "}
              <strong>{deleteTarget.itemName || "this stock entry"}</strong>.
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
