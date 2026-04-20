"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { currencyCompact, lineSubtotal } from "@/lib/format";
import {
  EMPTY_LINE,
  type LineItemDraft,
  type Service,
} from "@/lib/types";

export type ProposalDraft = {
  id?: string;
  number: string;
  date: string;
  valid_until: string;
  status: string;
  client_name: string;
  client_email: string;
  client_company: string;
  intro: string;
  notes: string;

  p1_items: LineItemDraft[];
  p1_discount: number;
  phase1_compare: string;
  phase1_note: string;
  phase1_timeline: string;
  phase1_payment: string;

  phase2_title: string;
  phase2_service_id: string;
  p2_rate: number;
  p2_discount: number;
  phase2_compare: string;
  phase2_note: string;
  phase2_commitment: string;
};

export function formatMoney(n: number) {
  return currencyCompact(n);
}

function CurrencyInput({
  value,
  onValueChange,
  placeholder,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const raw = String(value ?? "").replace(/[^0-9.]/g, "");
  const num = parseFloat(raw);
  const formatted =
    raw === "" || isNaN(num) || num <= 0 ? raw : currencyCompact(num);
  return (
    <input
      value={focused ? raw : formatted}
      onChange={(e) =>
        onValueChange(e.target.value.replace(/[^0-9.]/g, ""))
      }
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      inputMode="decimal"
    />
  );
}

export default function ProposalForm({
  open,
  draft,
  services,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: ProposalDraft | null;
  services: Service[];
  saving: boolean;
  onChange: (d: ProposalDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  // eslint-disable-next-line no-console
  console.log(
    "[proposal-form] services prop:",
    services?.length,
    services?.[0],
  );
  const p1Subtotal = useMemo(() => {
    if (!draft) return 0;
    return lineSubtotal(
      draft.p1_items.map((it) => ({
        qty: Number(it.qty),
        rate: Number(it.rate),
      })),
    );
  }, [draft]);

  if (!draft) return null;

  const p1Discount = Number(draft.p1_discount ?? 0) || 0;
  const p1NetTotal = Math.max(
    0,
    p1Subtotal - p1Subtotal * (p1Discount / 100),
  );
  const p1CompareNum = parseFloat(
    String(draft.phase1_compare ?? "").replace(/[^0-9.]/g, ""),
  );
  const showP1Compare =
    !isNaN(p1CompareNum) && p1CompareNum > 0 && p1CompareNum !== p1NetTotal;

  const p2Discount = Number(draft.p2_discount ?? 0) || 0;
  const p2NetMonthly = Math.max(
    0,
    (draft.p2_rate || 0) - (draft.p2_rate || 0) * (p2Discount / 100),
  );
  const p2CompareNum = parseFloat(
    String(draft.phase2_compare ?? "").replace(/[^0-9.]/g, ""),
  );
  const showP2Compare =
    !isNaN(p2CompareNum) &&
    p2CompareNum > 0 &&
    p2CompareNum !== p2NetMonthly;

  function updateP1Line(i: number, patch: Partial<LineItemDraft>) {
    const items = draft!.p1_items.map((it, idx) =>
      idx === i ? { ...it, ...patch } : it,
    );
    onChange({ ...draft!, p1_items: items });
  }

  function pickP1Service(i: number, id: string) {
    if (!id) {
      updateP1Line(i, { service_id: "" });
      return;
    }
    const s = services.find((x) => x.id === id);
    if (!s) return;
    updateP1Line(i, {
      service_id: id,
      title: s.name ?? "",
      description: (s.description ?? s.desc ?? "") as string,
      rate: String(s.price ?? 0),
    });
  }

  function addP1Line() {
    onChange({
      ...draft!,
      p1_items: [...draft!.p1_items, { ...EMPTY_LINE }],
    });
  }

  function removeP1Line(i: number) {
    onChange({
      ...draft!,
      p1_items: draft!.p1_items.filter((_, idx) => idx !== i),
    });
  }

  function pickP2Service(id: string) {
    if (!id) {
      onChange({ ...draft!, phase2_service_id: "" });
      return;
    }
    const s = services.find((x) => x.id === id);
    if (!s) return;
    onChange({
      ...draft!,
      phase2_service_id: id,
      phase2_title: s.name ?? "",
      p2_rate: Number(s.price ?? 0) || 0,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? `Edit ${draft.number}` : "New proposal"}
      maxWidth={780}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="proposal-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save proposal"}
          </button>
        </>
      }
    >
      <form
        id="proposal-form"
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
            <label className="form-label">Date</label>
            <input
              type="date"
              required
              value={draft.date}
              onChange={(e) => onChange({ ...draft, date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Valid until</label>
            <input
              type="date"
              value={draft.valid_until}
              onChange={(e) =>
                onChange({ ...draft, valid_until: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <select
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value })}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
        </div>

        <div className="grid-3">
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
          <div className="form-group">
            <label className="form-label">Company</label>
            <input
              value={draft.client_company}
              onChange={(e) =>
                onChange({ ...draft, client_company: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Intro message</label>
          <textarea
            rows={4}
            value={draft.intro}
            onChange={(e) => onChange({ ...draft, intro: e.target.value })}
          />
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Phase 1 · delivery</div>
          <div className="section-header-line" />
        </div>

        <div className="flex-col" style={{ gap: "var(--sp-3)" }}>
          {draft.p1_items.map((it, i) => {
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
                      onChange={(e) => pickP1Service(i, e.target.value)}
                    >
                      <option value="">— choose service —</option>
                      {(() => {
                        // eslint-disable-next-line no-console
                        console.log(
                          "[proposal-form] rendering service options:",
                          services?.map((s) => s.name),
                        );
                        return services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {formatMoney(Number(s.price ?? 0))}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input
                      value={it.title}
                      onChange={(e) =>
                        updateP1Line(i, { title: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    rows={2}
                    value={it.description}
                    onChange={(e) =>
                      updateP1Line(i, { description: e.target.value })
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
                      onChange={(e) =>
                        updateP1Line(i, { qty: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rate</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.rate}
                      onChange={(e) =>
                        updateP1Line(i, { rate: e.target.value })
                      }
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
                      {formatMoney(qty * rate)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeP1Line(i)}
                    disabled={draft.p1_items.length === 1}
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
            onClick={addP1Line}
            style={{ alignSelf: "flex-start" }}
          >
            + Add service
          </button>
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Discount %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.p1_discount ?? 0}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                const clamped = isNaN(raw)
                  ? 0
                  : Math.min(100, Math.max(0, raw));
                onChange({ ...draft, p1_discount: clamped });
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Standard Rate</label>
            <CurrencyInput
              value={draft.phase1_compare}
              onValueChange={(v) =>
                onChange({ ...draft, phase1_compare: v })
              }
              placeholder="e.g. $10,000"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Rate Note</label>
            <input
              value={draft.phase1_note}
              onChange={(e) =>
                onChange({ ...draft, phase1_note: e.target.value })
              }
              placeholder="e.g. Early Stage Rate"
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Timeline</label>
            <input
              value={draft.phase1_timeline}
              onChange={(e) =>
                onChange({ ...draft, phase1_timeline: e.target.value })
              }
              placeholder="e.g. 20 – 45 days"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Payment terms</label>
            <input
              value={draft.phase1_payment}
              onChange={(e) =>
                onChange({ ...draft, phase1_payment: e.target.value })
              }
              placeholder="e.g. $5k to start · $3k on launch"
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-1)",
            padding: "var(--sp-3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            background: "var(--cream, var(--paper))",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--muted)",
            }}
          >
            <span>Subtotal</span>
            <span className="mono">{formatMoney(p1Subtotal)}</span>
          </div>
          {p1Discount > 0 && p1Subtotal > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "var(--muted)",
              }}
            >
              <span>Discount ({p1Discount}%)</span>
              <span className="mono">
                −{formatMoney(p1Subtotal - p1NetTotal)}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "var(--sp-2)",
              marginTop: "var(--sp-1)",
              borderTop: "1px solid var(--border)",
              fontWeight: "var(--fw-bold)",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "var(--sp-2)",
            }}
          >
            <span>Phase 1 total</span>
            <span
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--sp-2)",
                marginLeft: "auto",
              }}
            >
              {showP1Compare && (
                <span
                  className="mono"
                  style={{
                    color: "var(--muted)",
                    textDecoration: "line-through",
                    fontWeight: "var(--fw-normal)",
                  }}
                >
                  {formatMoney(p1CompareNum)}
                </span>
              )}
              <span className="mono" style={{ color: "var(--accent)" }}>
                {formatMoney(p1NetTotal)}
              </span>
              {draft.phase1_note?.trim() && (
                <span
                  className="mono"
                  style={{
                    color: "var(--accent)",
                    fontWeight: "var(--fw-semibold)",
                  }}
                >
                  · {draft.phase1_note}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Phase 2 · partnership</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Service</label>
            <select
              value={draft.phase2_service_id}
              onChange={(e) => pickP2Service(e.target.value)}
            >
              <option value="">— choose service —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatMoney(Number(s.price ?? 0))}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              value={draft.phase2_title}
              onChange={(e) =>
                onChange({ ...draft, phase2_title: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Monthly rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.p2_rate}
              onChange={(e) =>
                onChange({
                  ...draft,
                  p2_rate: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Discount %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.p2_discount ?? 0}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                const clamped = isNaN(raw)
                  ? 0
                  : Math.min(100, Math.max(0, raw));
                onChange({ ...draft, p2_discount: clamped });
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Commitment (months)</label>
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              value={draft.phase2_commitment}
              onChange={(e) =>
                onChange({ ...draft, phase2_commitment: e.target.value })
              }
              placeholder="e.g. 3"
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Standard Rate</label>
            <CurrencyInput
              value={draft.phase2_compare}
              onValueChange={(v) =>
                onChange({ ...draft, phase2_compare: v })
              }
              placeholder="e.g. $5,000"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Rate Note</label>
            <input
              value={draft.phase2_note}
              onChange={(e) =>
                onChange({ ...draft, phase2_note: e.target.value })
              }
              placeholder="e.g. Early Stage Rate"
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-1)",
            padding: "var(--sp-3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            background: "var(--cream, var(--paper))",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "var(--muted)",
            }}
          >
            <span>Monthly rate</span>
            <span className="mono">{formatMoney(draft.p2_rate || 0)}/mo</span>
          </div>
          {p2Discount > 0 && (draft.p2_rate || 0) > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "var(--muted)",
              }}
            >
              <span>Discount ({p2Discount}%)</span>
              <span className="mono">
                −{formatMoney((draft.p2_rate || 0) - p2NetMonthly)}/mo
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "var(--sp-2)",
              marginTop: "var(--sp-1)",
              borderTop: "1px solid var(--border)",
              fontWeight: "var(--fw-bold)",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "var(--sp-2)",
            }}
          >
            <span>Net monthly</span>
            <span
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--sp-2)",
                marginLeft: "auto",
              }}
            >
              {showP2Compare && (
                <span
                  className="mono"
                  style={{
                    color: "var(--muted)",
                    textDecoration: "line-through",
                    fontWeight: "var(--fw-normal)",
                  }}
                >
                  {formatMoney(p2CompareNum)}/mo
                </span>
              )}
              <span className="mono" style={{ color: "var(--accent)" }}>
                {formatMoney(p2NetMonthly)}/mo
              </span>
              {draft.phase2_note?.trim() && (
                <span
                  className="mono"
                  style={{
                    color: "var(--accent)",
                    fontWeight: "var(--fw-semibold)",
                  }}
                >
                  · {draft.phase2_note}
                </span>
              )}
            </span>
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
