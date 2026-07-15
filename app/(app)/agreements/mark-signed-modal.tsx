"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";

export type SignatureValues = {
  signed_date: string;
  signed_by_name: string;
  signed_by_title: string;
};

/**
 * Single capture point for marking an agreement signed. Stamps signed date +
 * signer name/title in one confirmation, prefilled from the linked client's
 * signer fields. The caller decides what to do with the values (write to the
 * DB immediately, or fold them into an in-progress edit draft) — this modal
 * only captures.
 */
export default function MarkSignedModal({
  open,
  agreementNumber,
  clientLabel,
  initial,
  saving,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  agreementNumber: string;
  clientLabel: string;
  initial: SignatureValues;
  saving: boolean;
  onConfirm: (v: SignatureValues) => void;
  onCancel: () => void;
}) {
  const [signedDate, setSignedDate] = useState(initial.signed_date);
  const [name, setName] = useState(initial.signed_by_name);
  const [title, setTitle] = useState(initial.signed_by_title);

  // Re-seed the fields from the prefill each time the modal opens.
  useEffect(() => {
    if (open) {
      setSignedDate(initial.signed_date);
      setName(initial.signed_by_name);
      setTitle(initial.signed_by_title);
    }
  }, [
    open,
    initial.signed_date,
    initial.signed_by_name,
    initial.signed_by_title,
  ]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Mark signed"
      maxWidth={460}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() =>
              onConfirm({
                signed_date: signedDate,
                signed_by_name: name.trim(),
                signed_by_title: title.trim(),
              })
            }
          >
            {saving ? "Saving…" : "Confirm signed"}
          </button>
        </>
      }
    >
      <div className="flex-col" style={{ gap: "var(--sp-4)" }}>
        <p className="caption" style={{ margin: 0 }}>
          Marks <strong>{agreementNumber}</strong>
          {clientLabel ? ` — ${clientLabel}` : ""} as signed and stamps the
          signature below in one action.
        </p>
        <div className="form-group">
          <label className="form-label">Signed date</label>
          <input
            type="date"
            value={signedDate}
            onChange={(e) => setSignedDate(e.target.value)}
          />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Signed by name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Signed by title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
