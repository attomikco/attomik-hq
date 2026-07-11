"use client";

import { Modal } from "@/components/modal";
import {
  OPPORTUNITY_CHANNELS,
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
  referred_by: string;
  channel: string;
  estimated_value: string;
  estimated_phase1_value: string;
  estimated_phase2_monthly: string;
  estimated_phase: string;
  next_action: string;
  next_action_date: string;
  notes: string;
  lost_reason: string;
};

const STAGE_LABEL: Record<OpportunityStage, string> = {
  idea: "Idea",
  contacted: "Contacted",
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

const CHANNEL_LABEL: Record<string, string> = {
  cold_email: "Cold email",
  cold_dm: "Cold DM",
  linkedin: "LinkedIn",
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
  // Attribution detail: who sent the referral / made the intro. Same column
  // (referred_by) either way; only the label changes with the source.
  const referredLabel =
    draft.source === "referral"
      ? "Referred by"
      : draft.source === "network"
        ? "Intro by"
        : null;
  const phase1Counts =
    draft.estimated_phase === "phase1_only" ||
    draft.estimated_phase === "phase1_phase2";
  const phase2Counts =
    draft.estimated_phase === "phase2_only" ||
    draft.estimated_phase === "phase1_phase2";
  const phase1Helper = phase1Counts
    ? "One-time fee. Counts toward Pipeline one-time."
    : "Won't count toward pipeline metrics for the selected scope.";
  const phase2Helper = phase2Counts
    ? "Recurring monthly retainer. Counts toward Pipeline MRR."
    : "Won't count toward pipeline metrics for the selected scope.";

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
              required={!draft.id}
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
            <label className="form-label">Estimated scope</label>
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

        {referredLabel && (
          <div className="form-group">
            <label className="form-label">{referredLabel}</label>
            <input
              value={draft.referred_by}
              onChange={(e) =>
                onChange({ ...draft, referred_by: e.target.value })
              }
              placeholder="Name of the person who referred / introduced them"
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Channel</label>
          <select
            value={draft.channel}
            onChange={(e) => onChange({ ...draft, channel: e.target.value })}
          >
            <option value="">—</option>
            {OPPORTUNITY_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Phase 1 value (one-time)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.estimated_phase1_value}
              onChange={(e) =>
                onChange({ ...draft, estimated_phase1_value: e.target.value })
              }
              placeholder="8000"
            />
            <div
              className="caption"
              style={{
                marginTop: "var(--sp-1)",
                color: phase1Counts ? undefined : "var(--text-muted)",
              }}
            >
              {phase1Helper}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Phase 2 monthly (recurring)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.estimated_phase2_monthly}
              onChange={(e) =>
                onChange({
                  ...draft,
                  estimated_phase2_monthly: e.target.value,
                })
              }
              placeholder="5000"
            />
            <div
              className="caption"
              style={{
                marginTop: "var(--sp-1)",
                color: phase2Counts ? undefined : "var(--text-muted)",
              }}
            >
              {phase2Helper}
            </div>
          </div>
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
