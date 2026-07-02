"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { currency, lineSubtotal } from "@/lib/format";
import { Modal } from "@/components/modal";
import {
  EMPTY_LINE,
  EMPTY_NEW_CLIENT,
  type Client,
  type LineItemDraft,
  type NewClientDraft,
  type Service,
} from "@/lib/types";

export type InvoiceDraft = {
  id?: string;
  number: string;
  date: string;
  due: string;
  status: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_company: string;
  client_address: string;
  items: LineItemDraft[];
  discount: string;
  notes: string;
};

export default function InvoiceForm({
  open,
  draft,
  clients,
  services,
  saving,
  currencyCode,
  onChange,
  onClose,
  onSubmit,
  onCreateClient,
}: {
  open: boolean;
  draft: InvoiceDraft | null;
  clients: Client[];
  services: Service[];
  saving: boolean;
  currencyCode: string;
  onChange: (d: InvoiceDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onCreateClient: (draft: NewClientDraft) => Promise<Client | null>;
}) {
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientDraft, setNewClientDraft] = useState<NewClientDraft>(
    EMPTY_NEW_CLIENT,
  );
  const [savingNewClient, setSavingNewClient] = useState(false);

  // Reset the inline-create section whenever the modal closes
  useEffect(() => {
    if (!open) {
      setCreatingClient(false);
      setNewClientDraft(EMPTY_NEW_CLIENT);
      setSavingNewClient(false);
    }
  }, [open]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      ),
    [clients],
  );

  const subtotal = useMemo(() => {
    if (!draft) return 0;
    return lineSubtotal(
      draft.items.map((it) => ({
        qty: Number(it.qty),
        rate: Number(it.rate),
      })),
    );
  }, [draft]);

  if (!draft) return null;

  const discPct = Number(draft.discount) || 0;
  const discAmt = subtotal * (discPct / 100);
  const total = Math.max(0, subtotal - discAmt);
  const selectedClient = clients.find((c) => c.id === draft.client_id);

  function pickClient(id: string) {
    if (!draft) return;
    if (!id) {
      onChange({
        ...draft,
        client_id: "",
        client_name: "",
        client_email: "",
        client_company: "",
        client_address: "",
      });
      return;
    }
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    // Dual-write: persist client_id (the FK) and snapshot the legacy
    // string fields too. The strings stay as a safety net until they're
    // dropped in a follow-up cleanup.
    onChange({
      ...draft,
      client_id: id,
      client_name: c.name ?? "",
      client_email: c.email ?? "",
      client_company: c.company ?? "",
      client_address: c.address ?? "",
    });
  }

  async function handleCreateClient() {
    if (!newClientDraft.name.trim()) {
      alert("Client name is required.");
      return;
    }
    setSavingNewClient(true);
    const created = await onCreateClient(newClientDraft);
    setSavingNewClient(false);
    if (!created) return; // parent already alerted on error
    pickClient(created.id);
    setCreatingClient(false);
    setNewClientDraft(EMPTY_NEW_CLIENT);
  }

  function updateLine(i: number, patch: Partial<LineItemDraft>) {
    if (!draft) return;
    const items = draft.items.map((it, idx) =>
      idx === i ? { ...it, ...patch } : it,
    );
    onChange({ ...draft, items });
  }

  function pickService(i: number, id: string) {
    if (!draft) return;
    if (!id) {
      updateLine(i, { service_id: "" });
      return;
    }
    const s = services.find((x) => x.id === id);
    if (!s) return;
    updateLine(i, {
      service_id: id,
      title: s.name ?? "",
      description: (s.description ?? s.desc ?? "") as string,
      rate: String(s.price ?? 0),
    });
  }

  function addLine() {
    if (!draft) return;
    onChange({ ...draft, items: [...draft.items, { ...EMPTY_LINE }] });
  }

  function removeLine(i: number) {
    if (!draft) return;
    onChange({
      ...draft,
      items: draft.items.filter((_, idx) => idx !== i),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? `Edit ${draft.number}` : "New invoice"}
      maxWidth={760}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="invoice-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save invoice"}
          </button>
        </>
      }
    >
      <form
        id="invoice-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-5)" }}
      >
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Number</label>
            <input
              className="mono"
              required
              value={draft.number}
              onChange={(e) => onChange({ ...draft, number: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Issue date</label>
            <input
              type="date"
              required
              value={draft.date}
              onChange={(e) => onChange({ ...draft, date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Due date</label>
            <input
              type="date"
              value={draft.due}
              onChange={(e) => onChange({ ...draft, due: e.target.value })}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              value={draft.status}
              onChange={(e) => onChange({ ...draft, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready to send</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Client</label>
            <select
              required
              value={draft.client_id}
              onChange={(e) => pickClient(e.target.value)}
            >
              <option value="">— choose client —</option>
              {sortedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? "(no name)"}
                  {c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!creatingClient ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setCreatingClient(true)}
            style={{
              alignSelf: "flex-start",
              marginTop: "calc(-1 * var(--sp-3))",
              gap: 4,
            }}
          >
            <Plus size={12} strokeWidth={2} />
            New client
          </button>
        ) : (
          <div
            className="card-sm"
            style={{
              background: "var(--gray-150)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--sp-3)",
            }}
          >
            <div className="label mono">Create new client</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  value={newClientDraft.name}
                  onChange={(e) =>
                    setNewClientDraft({
                      ...newClientDraft,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Acme Coffee"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input
                  value={newClientDraft.company}
                  onChange={(e) =>
                    setNewClientDraft({
                      ...newClientDraft,
                      company: e.target.value,
                    })
                  }
                  placeholder="Legal entity"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={newClientDraft.email}
                onChange={(e) =>
                  setNewClientDraft({
                    ...newClientDraft,
                    email: e.target.value,
                  })
                }
                placeholder="billing@…"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                rows={2}
                value={newClientDraft.address}
                onChange={(e) =>
                  setNewClientDraft({
                    ...newClientDraft,
                    address: e.target.value,
                  })
                }
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payment terms</label>
              <input
                value={newClientDraft.payment_terms}
                onChange={(e) =>
                  setNewClientDraft({
                    ...newClientDraft,
                    payment_terms: e.target.value,
                  })
                }
                placeholder="Net 15"
              />
            </div>
            <div
              className="flex gap-2"
              style={{ justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => {
                  setCreatingClient(false);
                  setNewClientDraft(EMPTY_NEW_CLIENT);
                }}
                disabled={savingNewClient}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={handleCreateClient}
                disabled={savingNewClient}
              >
                {savingNewClient ? "Creating…" : "Create & select"}
              </button>
            </div>
          </div>
        )}

        {selectedClient && (
          <div
            className="card-sm"
            style={{
              background: "var(--paper)",
              border: "1px solid var(--border)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--sp-2) var(--sp-4)",
            }}
          >
            <div>
              <div className="label mono">Bill to</div>
              <div
                style={{
                  fontWeight: "var(--fw-semibold)",
                  marginTop: "var(--sp-1)",
                }}
              >
                {selectedClient.name ?? "—"}
              </div>
              {selectedClient.company && (
                <div className="caption">{selectedClient.company}</div>
              )}
            </div>
            <div>
              <div className="label mono">Contact</div>
              {selectedClient.email && (
                <div
                  className="caption mono"
                  style={{ marginTop: "var(--sp-1)" }}
                >
                  {selectedClient.email}
                </div>
              )}
              {selectedClient.address && (
                <div
                  className="caption"
                  style={{ whiteSpace: "pre-line" }}
                >
                  {selectedClient.address}
                </div>
              )}
            </div>
            <div
              className="caption"
              style={{
                gridColumn: "1 / -1",
                color: "var(--subtle)",
                fontSize: "var(--fs-11)",
              }}
            >
              These details snapshot onto the invoice when you save. Update
              them on the client&rsquo;s page if anything is wrong.
            </div>
          </div>
        )}

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Line items</div>
          <div className="section-header-line" />
        </div>

        <div className="flex-col" style={{ gap: "var(--sp-3)" }}>
          {draft.items.map((it, i) => {
            const qty = Number(it.qty) || 0;
            const rate = Number(it.rate) || 0;
            return (
              <div
                key={i}
                className="card-sm"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--sp-3)",
                  background: "var(--gray-150)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Service</label>
                    <select
                      value={it.service_id}
                      onChange={(e) => pickService(i, e.target.value)}
                    >
                      <option value="">— choose service —</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ·{" "}
                          {currency(Number(s.price ?? 0), currencyCode)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input
                      value={it.title}
                      onChange={(e) => updateLine(i, { title: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={2}
                    value={it.description}
                    onChange={(e) =>
                      updateLine(i, { description: e.target.value })
                    }
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 160px 1fr auto",
                    gap: "var(--sp-3)",
                    alignItems: "end",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.qty}
                      onChange={(e) => updateLine(i, { qty: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.rate}
                      onChange={(e) => updateLine(i, { rate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Line total</label>
                    <div
                      className="mono"
                      style={{
                        padding: "10px var(--sp-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--r-sm)",
                        background: "var(--paper)",
                        fontWeight: "var(--fw-semibold)",
                      }}
                    >
                      {currency(qty * rate, currencyCode)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeLine(i)}
                    disabled={draft.items.length === 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addLine}
            style={{ alignSelf: "flex-start" }}
          >
            + Add line
          </button>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Discount %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={draft.discount}
              onChange={(e) =>
                onChange({ ...draft, discount: e.target.value })
              }
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: "var(--sp-1)",
              alignItems: "flex-end",
            }}
          >
            <div className="mono label" style={{ color: "var(--muted)" }}>
              Subtotal {currency(subtotal, currencyCode)}
              {discPct > 0 ? ` · −${currency(discAmt, currencyCode)}` : ""}
            </div>
            <div
              className="mono"
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: "var(--fw-bold)",
              }}
            >
              Total {currency(total, currencyCode)}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
