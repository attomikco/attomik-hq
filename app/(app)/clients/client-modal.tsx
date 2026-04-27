"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";

export type ClientDraft = {
  id?: string;
  name: string;
  company: string;
  address: string;
  email: string;
  emails: string[];
  payment_terms: string;
  status: string;
  monthly_value: string;
  growth_stage: string;
  notes: string;
  slack_channel: string;
  preferred_channel: string;
  primary_contact_phone: string;
  hub_notes: string;
};

export const EMPTY_CLIENT_DRAFT: ClientDraft = {
  name: "",
  company: "",
  address: "",
  email: "",
  emails: [],
  payment_terms: "Net 15",
  status: "active",
  monthly_value: "0",
  growth_stage: "",
  notes: "",
  slack_channel: "",
  preferred_channel: "",
  primary_contact_phone: "",
  hub_notes: "",
};

export default function ClientModal({
  draft,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ClientDraft | null;
  saving: boolean;
  onChange: (d: ClientDraft) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const [emailInput, setEmailInput] = useState("");

  if (!draft) return null;

  function addEmail(raw: string) {
    const val = raw.trim();
    if (!val || !draft) return;
    if (draft.emails.includes(val)) return;
    onChange({ ...draft, emails: [...draft.emails, val] });
    setEmailInput("");
  }

  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={draft.id ? "Edit client" : "New client"}
      maxWidth={620}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="client-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save client"}
          </button>
        </>
      }
    >
      <form
        id="client-form"
        onSubmit={onSubmit}
        className="flex-col"
        style={{ gap: "var(--sp-4)" }}
      >
        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Identity</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Name</label>
          <input
            required
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Company</label>
          <input
            value={draft.company}
            onChange={(e) => onChange({ ...draft, company: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea
            rows={3}
            value={draft.address}
            onChange={(e) => onChange({ ...draft, address: e.target.value })}
          />
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Contact</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Primary email</label>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Additional emails</label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--sp-2)",
              padding: "var(--sp-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              background: "var(--paper)",
              minHeight: 44,
            }}
          >
            {draft.emails.map((em) => (
              <span
                key={em}
                className="badge badge-gray"
                style={{ gap: "var(--sp-2)" }}
              >
                {em}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      emails: draft.emails.filter((x) => x !== em),
                    })
                  }
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "var(--text-sm)",
                    lineHeight: 1,
                  }}
                  aria-label={`Remove ${em}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="email"
              value={emailInput}
              placeholder="Type and press Enter"
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addEmail(emailInput);
                } else if (
                  e.key === "Backspace" &&
                  !emailInput &&
                  draft.emails.length > 0
                ) {
                  onChange({
                    ...draft,
                    emails: draft.emails.slice(0, -1),
                  });
                }
              }}
              onBlur={() => emailInput && addEmail(emailInput)}
              style={{
                border: "none",
                outline: "none",
                flex: 1,
                minWidth: 160,
                padding: 0,
                background: "transparent",
                boxShadow: "none",
              }}
            />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              value={draft.primary_contact_phone}
              onChange={(e) =>
                onChange({ ...draft, primary_contact_phone: e.target.value })
              }
              placeholder="+1 555 555 5555"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Preferred channel</label>
            <select
              value={draft.preferred_channel}
              onChange={(e) =>
                onChange({ ...draft, preferred_channel: e.target.value })
              }
            >
              <option value="">—</option>
              <option value="Slack">Slack</option>
              <option value="Email">Email</option>
              <option value="Notion">Notion</option>
              <option value="Phone">Phone</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Slack channel</label>
          <input
            value={draft.slack_channel}
            onChange={(e) =>
              onChange({ ...draft, slack_channel: e.target.value })
            }
            placeholder="#client-name"
          />
        </div>

        <div className="section-header" style={{ margin: 0 }}>
          <div className="section-header-bar" />
          <div className="section-header-title">Engagement</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Payment terms</label>
          <input
            value={draft.payment_terms}
            onChange={(e) =>
              onChange({ ...draft, payment_terms: e.target.value })
            }
            placeholder="e.g. Net 15"
          />
        </div>
        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              value={draft.status}
              onChange={(e) => onChange({ ...draft, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Monthly retainer ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.monthly_value}
              onChange={(e) =>
                onChange({ ...draft, monthly_value: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Growth stage</label>
            <select
              value={draft.growth_stage}
              onChange={(e) =>
                onChange({ ...draft, growth_stage: e.target.value })
              }
            >
              <option value="">—</option>
              <option value="launch">Launch</option>
              <option value="scale">Scale</option>
              <option value="optimize">Optimize</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes (short — list view)</label>
          <textarea
            rows={3}
            value={draft.notes}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Hub notes (long — Hub-only)</label>
          <textarea
            rows={5}
            value={draft.hub_notes}
            onChange={(e) =>
              onChange({ ...draft, hub_notes: e.target.value })
            }
            placeholder="Working notes — onboarding context, preferences, anything you want to remember about this client."
          />
        </div>
      </form>
    </Modal>
  );
}

export function clientToDraft(c: {
  id: string;
  name: string | null;
  company: string | null;
  address: string | null;
  email: string | null;
  emails: string[] | null;
  payment_terms: string | null;
  status: string | null;
  monthly_value: number | null;
  growth_stage: string | null;
  notes: string | null;
  slack_channel: string | null;
  preferred_channel: string | null;
  primary_contact_phone: string | null;
  hub_notes: string | null;
}): ClientDraft {
  return {
    id: c.id,
    name: c.name ?? "",
    company: c.company ?? "",
    address: c.address ?? "",
    email: c.email ?? "",
    emails: Array.isArray(c.emails) ? c.emails : [],
    payment_terms: c.payment_terms ?? "Net 15",
    status: c.status ?? "active",
    monthly_value: String(c.monthly_value ?? 0),
    growth_stage: c.growth_stage ?? "",
    notes: c.notes ?? "",
    slack_channel: c.slack_channel ?? "",
    preferred_channel: c.preferred_channel ?? "",
    primary_contact_phone: c.primary_contact_phone ?? "",
    hub_notes: c.hub_notes ?? "",
  };
}

export function clientDraftToPayload(d: ClientDraft) {
  return {
    name: d.name,
    company: d.company,
    address: d.address,
    email: d.email,
    emails: d.emails,
    payment_terms: d.payment_terms,
    status: d.status || "active",
    monthly_value: Number(d.monthly_value) || 0,
    growth_stage: d.growth_stage || null,
    notes: d.notes || null,
    slack_channel: d.slack_channel || null,
    preferred_channel: d.preferred_channel || null,
    primary_contact_phone: d.primary_contact_phone || null,
    hub_notes: d.hub_notes || null,
  };
}
