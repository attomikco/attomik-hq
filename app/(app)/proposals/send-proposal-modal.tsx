"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Modal } from "@/components/modal";
import { buildProposalSendEmail } from "@/lib/defaults/proposal-send";
import type { Proposal } from "@/lib/types";

export default function SendProposalModal({
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
  // open with edits intact.
  onSend: (to: string, subject: string, body: string) => Promise<boolean>;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!proposal) return;
    const t = buildProposalSendEmail({
      clientName: proposal.client_name,
      company: proposal.client_company,
    });
    setTo(proposal.client_email ?? "");
    setSubject(t.subject);
    setBody(t.body);
  }, [proposal]);

  if (!proposal) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send ${proposal.number ?? "proposal"}`}
      maxWidth={640}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || !to.trim()}
            onClick={() => onSend(to.trim(), subject, body)}
          >
            <Send size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            {sending ? "Sending…" : "Send proposal"}
          </button>
        </>
      }
    >
      <div className="flex-col" style={{ gap: "var(--sp-4)" }}>
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
          <label className="form-label">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Body</label>
          <textarea
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
            The proposal PDF is attached automatically. Sending marks the
            proposal as sent.
          </div>
        </div>
      </div>
    </Modal>
  );
}
