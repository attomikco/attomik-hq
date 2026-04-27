"use client";

import { Modal } from "@/components/modal";
import { currency } from "@/lib/format";
import {
  OPPORTUNITY_PHASES,
  OPPORTUNITY_SOURCES,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/lib/types";

export type OpportunityDraft = {
  id?: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  stage: OpportunityStage;
  source: string;
  estimated_value: string;
  estimated_phase: string;
  next_action: string;
  next_action_date: string;
  notes: string;
  lost_reason: string;
};

const STAGE_LABEL: Record<OpportunityStage, string> = {
  idea: "Idea",
  qualified: "Qualified",
  discovery: "Discovery",
  proposal_drafted: "Proposal drafted",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const PHASE_LABEL: Record<string, string> = {
  phase1_only: "Phase 1 only",
  phase1_phase2: "Phase 1 + Phase 2",
  phase2_only: "Phase 2 only",
};

const SOURCE_LABEL: Record<string, string> = {
  referral: "Referral",
  inbound: "Inbound",
  outbound: "Outbound",
  network: "Network",
  other: "Other",
};

export default function OpportunityForm({
  open,
  draft,
  saving,
  currencyCode,
  showGenerateProposal,
  onChange,
  onClose,
  onSubmit,
  onGenerateProposal,
}: {
  open: boolean;
  draft: OpportunityDraft | null;
  saving: boolean;
  currencyCode: string;
  showGenerateProposal: boolean;
  onChange: (d: OpportunityDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onGenerateProposal: () => void;
}) {
  if (!draft) return null;

  const isLost = draft.stage === "lost";
  const estimated = Number(draft.estimated_value) || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? "Edit opportunity" : "New opportunity"}
      maxWidth={720}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {showGenerateProposal && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onGenerateProposal}
              disabled={saving}
              title="Create a proposal from this opportunity"
            >
              Generate proposal
            </button>
          )}
          <button
            type="submit"
            form="opportunity-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save opportunity"}
          </button>
        </>
      }
    >
      <form
        id="opportunity-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-5)" }}
      >
        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Company & contact</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Company</label>
            <input
              required
              value={draft.company_name}
              onChange={(e) =>
                onChange({ ...draft, company_name: e.target.value })
              }
              placeholder="Acme Coffee Co."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contact name</label>
            <input
              value={draft.contact_name}
              onChange={(e) =>
                onChange({ ...draft, contact_name: e.target.value })
              }
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Contact email</label>
          <input
            type="email"
            value={draft.contact_email}
            onChange={(e) =>
              onChange({ ...draft, contact_email: e.target.value })
            }
          />
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Funnel</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Stage</label>
            <select
              value={draft.stage}
              onChange={(e) =>
                onChange({
                  ...draft,
                  stage: e.target.value as OpportunityStage,
                })
              }
            >
              {OPPORTUNITY_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Source</label>
            <select
              value={draft.source}
              onChange={(e) =>
                onChange({ ...draft, source: e.target.value })
              }
            >
              <option value="">—</option>
              {OPPORTUNITY_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estimated phase</label>
            <select
              value={draft.estimated_phase}
              onChange={(e) =>
                onChange({ ...draft, estimated_phase: e.target.value })
              }
            >
              <option value="">—</option>
              {OPPORTUNITY_PHASES.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Estimated value (Phase 1 + first 6 months Phase 2)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.estimated_value}
            onChange={(e) =>
              onChange({ ...draft, estimated_value: e.target.value })
            }
            placeholder="0"
          />
          {estimated > 0 && (
            <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
              {currency(estimated, currencyCode)}
            </div>
          )}
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Next action</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Next action</label>
            <input
              value={draft.next_action}
              onChange={(e) =>
                onChange({ ...draft, next_action: e.target.value })
              }
              placeholder="e.g. follow-up call, send proposal"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Next action date</label>
            <input
              type="date"
              value={draft.next_action_date}
              onChange={(e) =>
                onChange({ ...draft, next_action_date: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            rows={4}
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </div>

        {isLost && (
          <div className="form-group">
            <label className="form-label">Lost reason</label>
            <textarea
              rows={2}
              value={draft.lost_reason}
              onChange={(e) =>
                onChange({ ...draft, lost_reason: e.target.value })
              }
              placeholder="Price, fit, timing, lost to competitor, …"
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
