"use client";

import { Modal } from "@/components/modal";
import {
  PROSPECT_CHANNELS,
  PROSPECT_STATUSES,
  type ProspectStatus,
} from "@/lib/types";

export type ProspectDraft = {
  id?: string;
  company: string;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  channel: string;
  status: ProspectStatus;
  notes: string;
};

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  no_reply: "No reply",
  replied: "Replied",
  graduated: "Graduated",
  disqualified: "Disqualified",
};

export const CHANNEL_LABEL: Record<string, string> = {
  cold_email: "Cold email",
  cold_dm: "Cold DM",
  linkedin: "LinkedIn",
  other: "Other",
};

export default function ProspectForm({
  open,
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: ProspectDraft | null;
  saving: boolean;
  onChange: (d: ProspectDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!draft) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={draft.id ? "Edit prospect" : "New prospect"}
      maxWidth={640}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="prospect-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save prospect"}
          </button>
        </>
      }
    >
      <form
        id="prospect-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-5)" }}
      >
        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Company & contact</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Company</label>
          <input
            required
            value={draft.company}
            onChange={(e) => onChange({ ...draft, company: e.target.value })}
            placeholder="Acme Coffee Co."
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Contact name</label>
            <input
              value={draft.contact_name}
              onChange={(e) =>
                onChange({ ...draft, contact_name: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contact role</label>
            <input
              value={draft.contact_role}
              onChange={(e) =>
                onChange({ ...draft, contact_role: e.target.value })
              }
              placeholder="e.g. Head of Marketing"
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
          <div className="section-header-title">Outreach</div>
          <div className="section-header-line" />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Channel</label>
            <select
              value={draft.channel}
              onChange={(e) => onChange({ ...draft, channel: e.target.value })}
            >
              <option value="">—</option>
              {PROSPECT_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              value={draft.status}
              onChange={(e) =>
                onChange({
                  ...draft,
                  status: e.target.value as ProspectStatus,
                })
              }
            >
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea
            rows={4}
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            placeholder="Context, angle, who introduced them, …"
          />
        </div>
      </form>
    </Modal>
  );
}
