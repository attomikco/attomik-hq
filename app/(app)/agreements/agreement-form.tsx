"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Modal } from "@/components/modal";
import { currency, dateShort } from "@/lib/format";
import { DEFAULT_LEGAL_TERMS } from "@/lib/defaults/legal-terms";
import {
  EMPTY_NEW_CLIENT,
  type AgreementStatus,
  type Client,
  type KickoffItem,
  type NewClientDraft,
  type Phase1Item,
  type SettingsMap,
} from "@/lib/types";

export type AgreementDraft = {
  id?: string;
  number: string;
  date: string;
  status: AgreementStatus;
  proposal_id: string | null;
  proposal_number: string | null;
  proposal_date: string | null;
  opportunity_id: string | null;
  client_id: string;
  client_name: string;
  client_email: string;
  client_company: string;
  client_address: string;
  phase1_items: Phase1Item[];
  phase1_total: string;
  phase1_discount: string;
  phase1_timeline: string;
  phase1_payment: string;
  phase2_service: string;
  phase2_rate: string;
  phase2_discount: string;
  phase2_commitment: string;
  phase2_start_date: string;
  kickoff_items: KickoffItem[];
  terms: string;
  signed_date: string;
  signed_by_name: string;
  signed_by_title: string;
  ended_date: string;
  end_reason: string;
  notes: string;
};

/**
 * Collapsible section header matching the .section-header style (accent bar +
 * Barlow title) with a chevron and an optional summary suffix. Used for the
 * sections that collapse by default in the agreement modal.
 */
function SectionToggle({
  title,
  summary,
  open,
  onToggle,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="section-header"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        margin: 0,
        width: "100%",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
      }}
    >
      <div className="section-header-bar" />
      {open ? (
        <ChevronDown size={16} strokeWidth={2} />
      ) : (
        <ChevronRight size={16} strokeWidth={2} />
      )}
      <div className="section-header-title">
        {title}
        {summary && (
          <span
            style={{
              marginLeft: "var(--sp-2)",
              color: "var(--muted)",
              fontWeight: 500,
              letterSpacing: 0,
              fontSize: "var(--text-sm)",
            }}
          >
            · {summary}
          </span>
        )}
      </div>
      <div className="section-header-line" />
    </button>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="form-label">{label}</div>
      <div style={{ fontWeight: "var(--fw-semibold)" }}>{value}</div>
    </div>
  );
}

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
  onGenerateEmail,
  onCreateClient,
  onRequestSign,
  onRequestEnd,
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
  onGenerateEmail: () => void;
  onCreateClient: (draft: NewClientDraft) => Promise<Client | null>;
  onRequestSign: () => void;
  onRequestEnd: () => void;
}) {
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientDraft, setNewClientDraft] = useState<NewClientDraft>(
    EMPTY_NEW_CLIENT,
  );
  const [savingNewClient, setSavingNewClient] = useState(false);

  // Collapsible sections. State resets on each modal-open: Terms always starts
  // collapsed; Signature auto-expands when the agreement is signed or already
  // carries signed values (see below).
  const [termsOpen, setTermsOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setCreatingClient(false);
      setNewClientDraft(EMPTY_NEW_CLIENT);
      setSavingNewClient(false);
    } else {
      setTermsOpen(false);
      const hasSignedValues = !!(
        draft?.signed_date ||
        draft?.signed_by_name ||
        draft?.signed_by_title
      );
      setSignOpen(draft?.status === "signed" || hasSignedValues);
    }
    // draft identity is intentionally excluded: we only recompute the initial
    // collapsed state when the modal transitions open/closed, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      ),
    [clients],
  );
  const computedP1Subtotal = useMemo(() => {
    if (!draft) return 0;
    return draft.phase1_items.reduce(
      (sum, it) => sum + (Number(it.price) || 0),
      0,
    );
  }, [draft]);
  const computedP1Discount = Number(draft?.phase1_discount) || 0;
  const computedP1Net = Math.max(0, computedP1Subtotal - computedP1Discount);
  const computedP2Rate = Number(draft?.phase2_rate) || 0;
  const computedP2Discount = Number(draft?.phase2_discount) || 0;
  const computedP2Net = Math.max(0, computedP2Rate - computedP2Discount);

  if (!draft) return null;

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
    // Dual-write: persist client_id (required, the FK) and snapshot the
    // legacy strings. The strings stay editable below if the user wants
    // the agreement to capture a different snapshot at signing time.
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
    if (!created) return;
    pickClient(created.id);
    setCreatingClient(false);
    setNewClientDraft(EMPTY_NEW_CLIENT);
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

  const termsSummary =
    draft.terms === DEFAULT_LEGAL_TERMS ? "default" : "edited";
  const hasSignature = !!(
    draft.signed_date ||
    draft.signed_by_name ||
    draft.signed_by_title
  );
  const hasEndData = !!(draft.ended_date || draft.end_reason);

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
          {draft.id && draft.client_email && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onGenerateEmail}
              disabled={saving}
              title="Download the agreement PDF and open a Gmail compose window prefilled to the client"
            >
              Generate email
            </button>
          )}
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
              onChange={(e) => {
                const next = e.target.value as AgreementStatus;
                // Selecting 'signed' without signature data, or 'ended' without
                // end data, routes through the capture modal (prefill + confirm)
                // instead of saving nulls.
                if (next === "signed" && !hasSignature) {
                  onRequestSign();
                  return;
                }
                if (next === "ended" && !hasEndData) {
                  onRequestEnd();
                  return;
                }
                onChange({ ...draft, status: next });
              }}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="signed">Signed</option>
              <option value="ended">Ended</option>
            </select>
          </div>
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Client</div>
          <div className="section-header-line" />
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

        <div className="form-group">
          <label className="form-label">Discount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.phase1_discount}
            onChange={(e) =>
              onChange({ ...draft, phase1_discount: e.target.value })
            }
            placeholder="0"
          />
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
            style={{ display: "flex", justifyContent: "space-between" }}
            className="caption"
          >
            <span>Subtotal</span>
            <span className="mono">
              {currency(computedP1Subtotal, currencyCode)}
            </span>
          </div>
          {computedP1Discount > 0 && (
            <div
              style={{ display: "flex", justifyContent: "space-between" }}
              className="caption"
            >
              <span>Discount</span>
              <span className="mono">
                −{currency(computedP1Discount, currencyCode)}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "var(--fw-bold)",
            }}
          >
            <span>Phase 1 total</span>
            <span className="mono" style={{ color: "var(--accent)" }}>
              {currency(computedP1Net, currencyCode)}
            </span>
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
            <label className="form-label">Monthly discount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.phase2_discount}
              onChange={(e) =>
                onChange({ ...draft, phase2_discount: e.target.value })
              }
              placeholder="0"
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
        {computedP2Discount > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "var(--sp-2) var(--sp-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              background: "var(--cream, var(--paper))",
              fontWeight: "var(--fw-bold)",
            }}
          >
            <span>Net monthly</span>
            <span className="mono" style={{ color: "var(--accent)" }}>
              {currency(computedP2Net, currencyCode)} / mo
            </span>
          </div>
        )}

        <SectionToggle
          title="Terms & Conditions"
          summary={termsSummary}
          open={termsOpen}
          onToggle={() => setTermsOpen((v) => !v)}
        />
        {termsOpen && (
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
        )}

        <SectionToggle
          title="Signature & Notes"
          open={signOpen}
          onToggle={() => setSignOpen((v) => !v)}
        />
        {signOpen && (
          <>
        {hasSignature ? (
          // Signature is captured through the Mark signed flow, so it renders
          // read-only here. Internal notes below stays editable.
          <div
            className="card-sm"
            style={{
              background: "var(--gray-150)",
              border: "1px solid var(--border)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "var(--sp-3)",
            }}
          >
            <ReadOnlyField
              label="Signed date"
              value={draft.signed_date ? dateShort(draft.signed_date) : "—"}
            />
            <ReadOnlyField
              label="Signed by name"
              value={draft.signed_by_name || "—"}
            />
            <ReadOnlyField
              label="Signed by title"
              value={draft.signed_by_title || "—"}
            />
          </div>
        ) : (
          <div
            className="flex"
            style={{
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--sp-3)",
            }}
          >
            <span className="caption">Not signed yet.</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRequestSign}
            >
              Mark signed
            </button>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Internal notes</label>
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </div>
          </>
        )}
      </form>
    </Modal>
  );
}
