"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Modal } from "@/components/modal";
import { buildDetailsRequestEmail } from "@/lib/defaults/details-request";
import type { Proposal } from "@/lib/types";

export default function RequestDetailsModal({
  open,
  proposal,
  onClose,
}: {
  open: boolean;
  proposal: Proposal | null;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  // Re-seed from the template whenever a different proposal opens the modal.
  useEffect(() => {
    if (!proposal) return;
    const t = buildDetailsRequestEmail({ clientName: proposal.client_name });
    setSubject(t.subject);
    setBody(t.body);
    setCopied(false);
  }, [proposal]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Copy failed — select the text and copy manually.");
    }
  }

  if (!proposal) return null;

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
          <button type="button" className="btn btn-primary" onClick={handleCopy}>
            <Copy size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            {copied ? "Copied" : "Copy email"}
          </button>
        </>
      }
    >
      <div className="flex-col" style={{ gap: "var(--sp-4)" }}>
        <div className="form-group">
          <label className="form-label">To</label>
          <input value={proposal.client_email ?? ""} readOnly />
          {!proposal.client_email && (
            <div className="caption" style={{ marginTop: "var(--sp-1)" }}>
              This proposal has no contact email. Add one on the proposal, or
              paste the address into your mail client.
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
            rows={16}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
