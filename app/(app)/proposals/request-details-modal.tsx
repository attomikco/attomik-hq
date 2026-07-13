"use client";

import { useEffect, useState } from "react";
import { Copy, Send } from "lucide-react";
import { Modal } from "@/components/modal";
import { buildDetailsRequestEmail } from "@/lib/defaults/details-request";
import type { Proposal } from "@/lib/types";

export default function RequestDetailsModal({
  open,
  proposal,
  sending,
  onClose,
  onSend,
}: {
  open: boolean;
  proposal: Proposal | null;
  sending: boolean;
  onClose: () => void;
  // Returns true on success (parent closes + toasts); false leaves the modal
  // open with edits intact, Copy still available as a fallback.
  onSend: (to: string, subject: string, body: string) => Promise<boolean>;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [copied, setCopied] = useState(false);

  // Re-seed from the template whenever a different proposal opens the modal.
  useEffect(() => {
    if (!proposal) return;
    const t = buildDetailsRequestEmail({ clientName: proposal.client_name });
    setTo(proposal.client_email ?? "");
    setSubject(t.subject);
    setBody(t.body);
    setCc(t.cc);
    setCopied(false);
  }, [proposal]);

  async function handleCopy() {
    try {
      // CC on its own line above the subject so it can't be missed when
      // pasting into Gmail.
      await navigator.clipboard.writeText(`CC: ${cc}\n\n${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed — select the text and copy manually.");
    }
  }

  if (!proposal) return null;

  const alreadyDays = proposal.details_requested_at
    ? Math.floor(
        (Date.now() - new Date(proposal.details_requested_at).getTime()) /
          86400000,
      )
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request company details"
      maxWidth={640}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
          >
            <Copy size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            {copied ? "Copied" : "Copy email"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || !to.trim()}
            onClick={() => onSend(to.trim(), subject, body)}
          >
            <Send size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            {sending ? "Sending…" : "Send email"}
          </button>
        </>
      }
    >
      <div className="flex-col" style={{ gap: "var(--sp-4)" }}>
        {alreadyDays !== null && (
          <div className="caption" style={{ color: "var(--muted)" }}>
            Already sent <span className="mono">{alreadyDays}d</span> ago.
            Sending again is fine.
          </div>
        )}
        <div className="form-group">
          <label className="form-label">To</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@company.com"
          />
          {proposal.client_email &&
            to.trim() !== proposal.client_email.trim() && (
              <div
                className="caption"
                style={{ marginTop: "var(--sp-1)", color: "var(--danger)" }}
              >
                Differs from proposal contact ({proposal.client_email})
              </div>
            )}
          {!proposal.client_email && (
            <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
              This proposal has no saved contact email.
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">CC</label>
          <input value={cc} readOnly />
        </div>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Body</label>
          <textarea
            rows={16}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
