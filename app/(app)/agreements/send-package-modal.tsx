"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Modal } from "@/components/modal";
import { buildPackageSendEmail } from "@/lib/defaults/package-send";
import type { Agreement } from "@/lib/types";

export default function SendPackageModal({
  open,
  agreement,
  depositFormatted,
  hasProposal,
  sending,
  onClose,
  onSend,
}: {
  open: boolean;
  agreement: Agreement | null;
  depositFormatted: string | null;
  hasProposal: boolean;
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
    if (!agreement) return;
    const t = buildPackageSendEmail({
      clientName: agreement.client_name,
      company: agreement.client_company,
      depositFormatted,
    });
    setTo(agreement.client_email ?? "");
    setSubject(t.subject);
    setBody(t.body);
  }, [agreement, depositFormatted]);

  if (!agreement) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send package — ${agreement.number}`}
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
            {sending ? "Sending…" : "Send package"}
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
          {agreement.client_email &&
            to.trim() !== agreement.client_email.trim() && (
              <div
                className="caption"
                style={{ marginTop: "var(--sp-1)", color: "var(--danger)" }}
              >
                Differs from client contact ({agreement.client_email})
              </div>
            )}
          {!agreement.client_email && (
            <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
              This agreement has no saved contact email.
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
            rows={14}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
            Attaches the agreement
            {hasProposal ? ", the accepted proposal," : ""} and the first
            invoice as PDFs. Sending marks the agreement and invoice as sent.
          </div>
        </div>
      </div>
    </Modal>
  );
}
