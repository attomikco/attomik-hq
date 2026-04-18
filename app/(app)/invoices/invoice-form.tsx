"use client";

import { useMemo } from "react";
import { currency, lineSubtotal } from "@/lib/format";
import { Modal } from "@/components/modal";
import {
  EMPTY_LINE,
  type Client,
  type LineItemDraft,
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
}) {
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

  function pickClient(id: string) {
    if (!draft) return;
    if (!id) {
      onChange({ ...draft, client_id: "" });
      return;
    }
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    onChange({
      ...draft,
      client_id: id,
      client_name: c.name ?? "",
      client_email: c.email ?? "",
      client_company: c.company ?? "",
      client_address: c.address ?? "",
    });
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
      description: s.description ?? "",
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
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Client (from list)</label>
            <select
              value={draft.client_id}
              onChange={(e) => pickClient(e.target.value)}
            >
              <option value="">— choose or enter manually —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` · ${c.company}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Client name</label>
            <input
              value={draft.client_name}
              onChange={(e) =>
                onChange({ ...draft, client_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Client email</label>
            <input
              type="email"
              value={draft.client_email}
              onChange={(e) =>
                onChange({ ...draft, client_email: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Company</label>
            <input
              value={draft.client_company}
              onChange={(e) =>
                onChange({ ...draft, client_company: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              rows={2}
              value={draft.client_address}
              onChange={(e) =>
                onChange({ ...draft, client_address: e.target.value })
              }
            />
          </div>
        </div>

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
                          {s.name} · {currency(Number(s.price ?? 0), currencyCode)}
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
            <div
              className="mono label"
              style={{ color: "var(--muted)" }}
            >
              Subtotal {currency(subtotal, currencyCode)}
              {discPct > 0
                ? ` · −${currency(discAmt, currencyCode)}`
                : ""}
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
