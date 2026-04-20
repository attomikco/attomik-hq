"use client";

import { useMemo } from "react";
import { Modal } from "@/components/modal";
import { currency } from "@/lib/format";
import {
  DEFAULT_KICKOFF_ITEMS,
  KICKOFF_CATEGORIES,
} from "@/lib/defaults/kickoff-checklist";
import { DEFAULT_LEGAL_TERMS } from "@/lib/defaults/legal-terms";
import type {
  AgreementStatus,
  Client,
  KickoffItem,
  Phase1Item,
  SettingsMap,
} from "@/lib/types";

export type AgreementDraft = {
  id?: string;
  number: string;
  date: string;
  status: AgreementStatus;
  proposal_id: string | null;
  proposal_number: string | null;
  proposal_date: string | null;
  client_id: string;
  client_name: string;
  client_email: string;
  client_company: string;
  client_address: string;
  phase1_items: Phase1Item[];
  phase1_total: string;
  phase1_timeline: string;
  phase1_payment: string;
  phase2_service: string;
  phase2_rate: string;
  phase2_commitment: string;
  phase2_start_date: string;
  kickoff_items: KickoffItem[];
  terms: string;
  signed_date: string;
  signed_by_name: string;
  signed_by_title: string;
  notes: string;
};

export default function AgreementForm({
  open,
  draft,
  clients,
  saving,
  currencyCode,
  settings,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: AgreementDraft | null;
  clients: Client[];
  saving: boolean;
  currencyCode: string;
  settings: SettingsMap;
  onChange: (d: AgreementDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const computedP1Total = useMemo(() => {
    if (!draft) return 0;
    return draft.phase1_items.reduce(
      (sum, it) => sum + (Number(it.price) || 0),
      0,
    );
  }, [draft]);

  if (!draft) return null;

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

  function updateP1(i: number, patch: Partial<Phase1Item>) {
    const items = draft!.phase1_items.map((it, idx) =>
      idx === i ? { ...it, ...patch } : it,
    );
    onChange({ ...draft!, phase1_items: items });
  }

  function addP1() {
    onChange({
      ...draft!,
      phase1_items: [
        ...draft!.phase1_items,
        { name: "", price: 0, description: "" },
      ],
    });
  }

  function removeP1(i: number) {
    onChange({
      ...draft!,
      phase1_items: draft!.phase1_items.filter((_, idx) => idx !== i),
    });
  }

  function updateKickoff(i: number, patch: Partial<KickoffItem>) {
    const items = draft!.kickoff_items.map((it, idx) =>
      idx === i ? { ...it, ...patch } : it,
    );
    onChange({ ...draft!, kickoff_items: items });
  }

  function addKickoffItem(category: string) {
    onChange({
      ...draft!,
      kickoff_items: [
        ...draft!.kickoff_items,
        { category, item: "", required: false, provided: false },
      ],
    });
  }

  function removeKickoffItem(i: number) {
    onChange({
      ...draft!,
      kickoff_items: draft!.kickoff_items.filter((_, idx) => idx !== i),
    });
  }

  function resetKickoffDefaults() {
    onChange({ ...draft!, kickoff_items: DEFAULT_KICKOFF_ITEMS });
  }

  const groupedKickoff = KICKOFF_CATEGORIES.map((cat) => ({
    category: cat,
    items: draft.kickoff_items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.category === cat),
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? `Edit ${draft.number}` : "New agreement"}
      maxWidth={860}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="agreement-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save agreement"}
          </button>
        </>
      }
    >
      <form
        id="agreement-form"
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
            <label className="form-label">Status</label>
            <select
              value={draft.status}
              onChange={(e) =>
                onChange({
                  ...draft,
                  status: e.target.value as AgreementStatus,
                })
              }
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Client</div>
          <div className="section-header-line" />
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
          <div className="section-header-title">Phase 1 · Scope</div>
          <div className="section-header-line" />
        </div>

        <div className="flex-col" style={{ gap: "var(--sp-2)" }}>
          {draft.phase1_items.map((it, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 140px auto",
                gap: "var(--sp-3)",
                alignItems: "center",
              }}
            >
              <input
                placeholder="Service name"
                value={it.name}
                onChange={(e) => updateP1(i, { name: e.target.value })}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Price"
                value={String(it.price ?? 0)}
                onChange={(e) =>
                  updateP1(i, { price: Number(e.target.value) || 0 })
                }
              />
              <button
                type="button"
                className="btn btn-danger btn-xs"
                onClick={() => removeP1(i)}
                disabled={draft.phase1_items.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={addP1}
            style={{ alignSelf: "flex-start" }}
          >
            + Add line item
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "var(--sp-3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            background: "var(--cream, var(--paper))",
            fontWeight: "var(--fw-bold)",
          }}
        >
          <span>Phase 1 total</span>
          <span className="mono" style={{ color: "var(--accent)" }}>
            {currency(computedP1Total, currencyCode)}
          </span>
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
            <label className="form-label">Payment schedule</label>
            <input
              value={draft.phase1_payment}
              onChange={(e) =>
                onChange({ ...draft, phase1_payment: e.target.value })
              }
              placeholder={
                settings.agreement_default_phase1_payment ??
                "50% upon signing, 50% upon delivery"
              }
            />
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Phase 2 · Growth Partnership</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Service / Engagement name</label>
          <input
            value={draft.phase2_service}
            onChange={(e) =>
              onChange({ ...draft, phase2_service: e.target.value })
            }
            placeholder="e.g. Growth + Ads Bundle"
          />
        </div>
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Monthly rate</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.phase2_rate}
              onChange={(e) =>
                onChange({ ...draft, phase2_rate: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Commitment (months)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.phase2_commitment}
              onChange={(e) =>
                onChange({ ...draft, phase2_commitment: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Start date</label>
            <input
              type="date"
              value={draft.phase2_start_date}
              onChange={(e) =>
                onChange({ ...draft, phase2_start_date: e.target.value })
              }
            />
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Kickoff Requirements</div>
          <div className="section-header-line" />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "calc(var(--sp-3) * -1)",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={resetKickoffDefaults}
          >
            Reset to default list
          </button>
        </div>

        {groupedKickoff.map(({ category, items }) => (
          <div key={category} className="flex-col" style={{ gap: "var(--sp-2)" }}>
            <div
              className="label mono"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{category}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => addKickoffItem(category)}
              >
                + Add item
              </button>
            </div>
            {items.length === 0 && (
              <div className="caption">No items in this category.</div>
            )}
            {items.map(({ it, i }) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto auto 1fr 1fr auto",
                  gap: "var(--sp-2)",
                  alignItems: "center",
                  padding: "var(--sp-1) var(--sp-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                }}
              >
                <label
                  className="caption"
                  style={{ display: "flex", gap: "4px", alignItems: "center" }}
                  title="Required"
                >
                  <input
                    type="checkbox"
                    checked={it.required}
                    onChange={(e) =>
                      updateKickoff(i, { required: e.target.checked })
                    }
                  />
                  <span>Req</span>
                </label>
                <label
                  className="caption"
                  style={{ display: "flex", gap: "4px", alignItems: "center" }}
                  title="Provided"
                >
                  <input
                    type="checkbox"
                    checked={it.provided}
                    onChange={(e) =>
                      updateKickoff(i, { provided: e.target.checked })
                    }
                  />
                  <span>Ok</span>
                </label>
                <input
                  value={it.item}
                  onChange={(e) => updateKickoff(i, { item: e.target.value })}
                  placeholder="Item"
                />
                <input
                  value={it.notes ?? ""}
                  onChange={(e) => updateKickoff(i, { notes: e.target.value })}
                  placeholder="Notes"
                />
                <button
                  type="button"
                  className="btn btn-danger btn-xs"
                  onClick={() => removeKickoffItem(i)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ))}

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Terms & Conditions</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Terms (edit carefully)</label>
          <textarea
            rows={12}
            className="mono"
            style={{ fontSize: "var(--text-sm)" }}
            value={draft.terms}
            onChange={(e) => onChange({ ...draft, terms: e.target.value })}
          />
          <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
            Merge fields render at PDF time: {"{client_company}"}, {"{phase2_commitment}"}, {"{governing_law}"}, {"{legal_entity}"}.
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              style={{ marginLeft: "var(--sp-2)" }}
              onClick={() =>
                onChange({ ...draft, terms: DEFAULT_LEGAL_TERMS })
              }
            >
              Reset to default
            </button>
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Signature & Notes</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Signed date</label>
            <input
              type="date"
              value={draft.signed_date}
              onChange={(e) =>
                onChange({ ...draft, signed_date: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Signed by name</label>
            <input
              value={draft.signed_by_name}
              onChange={(e) =>
                onChange({ ...draft, signed_by_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Signed by title</label>
            <input
              value={draft.signed_by_title}
              onChange={(e) =>
                onChange({ ...draft, signed_by_title: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Internal notes</label>
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
