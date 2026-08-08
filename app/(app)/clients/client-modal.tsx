"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { CLIENT_COUNTRIES, CLIENT_COUNTRY_LABELS } from "@/lib/types";

export type ClientDraft = {
  id?: string;
  name: string;
  company: string;
  country: string;
  legal_name: string;
  rfc: string;
  fiscal_address: string;
  billing_contact: string;
  address: string;
  email: string;
  emails: string[];
  ap_email: string;
  ap_cc_emails: string[];
  payment_terms: string;
  status: string;
  monthly_value: string;
  growth_stage: string;
  notes: string;
  slack_channel: string;
  preferred_channel: string;
  primary_contact_phone: string;
  hub_notes: string;
  relationship_reason: string;
};

export const EMPTY_CLIENT_DRAFT: ClientDraft = {
  name: "",
  company: "",
  country: "US",
  legal_name: "",
  rfc: "",
  fiscal_address: "",
  billing_contact: "",
  address: "",
  email: "",
  emails: [],
  ap_email: "",
  ap_cc_emails: [],
  payment_terms: "Net 15",
  status: "active",
  monthly_value: "0",
  growth_stage: "",
  notes: "",
  slack_channel: "",
  preferred_channel: "",
  primary_contact_phone: "",
  hub_notes: "",
  relationship_reason: "",
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
  const [apCcInput, setApCcInput] = useState("");

  if (!draft) return null;

  // The fiscal fields are conditionally rendered rather than hidden, so their
  // `required` attributes simply don't exist for US clients.
  const isMX = draft.country === "MX";

  function addEmail(raw: string) {
    const val = raw.trim();
    if (!val || !draft) return;
    if (draft.emails.includes(val)) return;
    onChange({ ...draft, emails: [...draft.emails, val] });
    setEmailInput("");
  }

  function addApCc(raw: string) {
    const val = raw.trim();
    if (!val || !draft) return;
    if (draft.ap_cc_emails.includes(val)) return;
    onChange({ ...draft, ap_cc_emails: [...draft.ap_cc_emails, val] });
    setApCcInput("");
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
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Company</label>
            <input
              value={draft.company}
              onChange={(e) => onChange({ ...draft, company: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <select
              value={draft.country}
              onChange={(e) => onChange({ ...draft, country: e.target.value })}
            >
              {CLIENT_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {CLIENT_COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <textarea
            rows={3}
            value={draft.address}
            onChange={(e) => onChange({ ...draft, address: e.target.value })}
          />
        </div>

        {isMX && (
          <>
            <div className="section-header" style={{ margin: 0 }}>
              <div className="section-header-bar" />
              <div className="section-header-title">Fiscal (Mexico)</div>
              <div className="section-header-line" />
            </div>

            <p className="caption" style={{ marginTop: "calc(-1 * var(--sp-2))" }}>
              Required for the client to deduct our invoices. These fields
              replace the standard bill-to block on this client&apos;s invoices.
            </p>

            <div className="form-group">
              <label className="form-label">Legal name</label>
              <input
                required
                value={draft.legal_name}
                onChange={(e) =>
                  onChange({ ...draft, legal_name: e.target.value })
                }
                placeholder="Abastecedora de Productos Naturales, S.A. de C.V."
              />
              <p className="caption" style={{ marginTop: "var(--sp-1)" }}>
                The entity that pays and deducts, which is often not the name
                you know them by. Invoices bill to this name.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">RFC</label>
              <input
                required
                className="mono"
                value={draft.rfc}
                onChange={(e) => onChange({ ...draft, rfc: e.target.value })}
                placeholder="APN831231I55"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fiscal address</label>
              <textarea
                required
                rows={3}
                value={draft.fiscal_address}
                onChange={(e) =>
                  onChange({ ...draft, fiscal_address: e.target.value })
                }
                placeholder="Street, colonia, delegacion, city, CP, country"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Billing contact</label>
              <input
                required
                value={draft.billing_contact}
                onChange={(e) =>
                  onChange({ ...draft, billing_contact: e.target.value })
                }
                placeholder="Name, email"
              />
            </div>
          </>
        )}

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
          <div className="section-header-title">Billing / Invoicing</div>
          <div className="section-header-line" />
        </div>

        <div className="form-group">
          <label className="form-label">Accounts payable email</label>
          <input
            type="email"
            value={draft.ap_email}
            onChange={(e) => onChange({ ...draft, ap_email: e.target.value })}
            placeholder="ap@client.com"
          />
          <p className="caption" style={{ marginTop: "var(--sp-1)" }}>
            Invoices are sent here. Falls back to the primary email if empty.
          </p>
        </div>
        <div className="form-group">
          <label className="form-label">Invoice CC emails</label>
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
            {draft.ap_cc_emails.map((em) => (
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
                      ap_cc_emails: draft.ap_cc_emails.filter((x) => x !== em),
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
              value={apCcInput}
              placeholder="Type and press Enter"
              onChange={(e) => setApCcInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addApCc(apCcInput);
                } else if (
                  e.key === "Backspace" &&
                  !apCcInput &&
                  draft.ap_cc_emails.length > 0
                ) {
                  onChange({
                    ...draft,
                    ap_cc_emails: draft.ap_cc_emails.slice(0, -1),
                  });
                }
              }}
              onBlur={() => apCcInput && addApCc(apCcInput)}
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
          <p className="caption" style={{ marginTop: "var(--sp-1)" }}>
            CC'd on every invoice, alongside pablo@attomik.co.
          </p>
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
        <div className="form-group">
          <label className="form-label">
            {draft.status === "active"
              ? "Why we love them"
              : draft.status === "cancelled"
                ? "Why it ended"
                : "Relationship note"}
          </label>
          <textarea
            rows={4}
            value={draft.relationship_reason}
            onChange={(e) =>
              onChange({ ...draft, relationship_reason: e.target.value })
            }
            placeholder={
              draft.status === "active"
                ? "What makes this a great fit culturally?"
                : draft.status === "cancelled"
                  ? "Reason for churn"
                  : ""
            }
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
  country?: string | null;
  legal_name?: string | null;
  rfc?: string | null;
  fiscal_address?: string | null;
  billing_contact?: string | null;
  address: string | null;
  email: string | null;
  emails: string[] | null;
  ap_email?: string | null;
  ap_cc_emails?: string[] | null;
  payment_terms: string | null;
  status: string | null;
  monthly_value: number | null;
  growth_stage: string | null;
  notes: string | null;
  slack_channel: string | null;
  preferred_channel: string | null;
  primary_contact_phone: string | null;
  hub_notes: string | null;
  relationship_reason?: string | null;
}): ClientDraft {
  return {
    id: c.id,
    name: c.name ?? "",
    company: c.company ?? "",
    country: c.country ?? "US",
    legal_name: c.legal_name ?? "",
    rfc: c.rfc ?? "",
    fiscal_address: c.fiscal_address ?? "",
    billing_contact: c.billing_contact ?? "",
    address: c.address ?? "",
    email: c.email ?? "",
    emails: Array.isArray(c.emails) ? c.emails : [],
    ap_email: c.ap_email ?? "",
    ap_cc_emails: Array.isArray(c.ap_cc_emails) ? c.ap_cc_emails : [],
    payment_terms: c.payment_terms ?? "Net 15",
    status: c.status ?? "active",
    monthly_value: String(c.monthly_value ?? 0),
    growth_stage: c.growth_stage ?? "",
    notes: c.notes ?? "",
    slack_channel: c.slack_channel ?? "",
    preferred_channel: c.preferred_channel ?? "",
    primary_contact_phone: c.primary_contact_phone ?? "",
    hub_notes: c.hub_notes ?? "",
    relationship_reason: c.relationship_reason ?? "",
  };
}

export function clientDraftToPayload(d: ClientDraft) {
  // Switching a client back to US clears the fiscal fields rather than leaving
  // stale MX data behind a hidden form section.
  const isMX = d.country === "MX";
  return {
    name: d.name,
    company: d.company,
    country: d.country || "US",
    legal_name: isMX ? d.legal_name.trim() || null : null,
    rfc: isMX ? d.rfc.trim() || null : null,
    fiscal_address: isMX ? d.fiscal_address.trim() || null : null,
    billing_contact: isMX ? d.billing_contact.trim() || null : null,
    address: d.address,
    email: d.email,
    emails: d.emails,
    ap_email: d.ap_email || null,
    ap_cc_emails: d.ap_cc_emails,
    payment_terms: d.payment_terms,
    status: d.status || "active",
    monthly_value: Number(d.monthly_value) || 0,
    growth_stage: d.growth_stage || null,
    notes: d.notes || null,
    slack_channel: d.slack_channel || null,
    preferred_channel: d.preferred_channel || null,
    primary_contact_phone: d.primary_contact_phone || null,
    hub_notes: d.hub_notes || null,
    relationship_reason: d.relationship_reason || null,
  };
}
