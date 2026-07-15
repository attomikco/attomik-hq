"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";

export type EndValues = {
  ended_date: string;
  end_reason: string;
};

/**
 * Single capture point for marking an agreement ended. Stamps the ended date +
 * a free-text reason in one confirmation. The caller decides what to do with
 * the values (write to the DB immediately, or fold them into an in-progress
 * edit draft) — this modal only captures. Mirrors MarkSignedModal.
 */
export default function MarkEndedModal({
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
  initial: EndValues;
  saving: boolean;
  onConfirm: (v: EndValues) => void;
  onCancel: () => void;
}) {
  const [endedDate, setEndedDate] = useState(initial.ended_date);
  const [reason, setReason] = useState(initial.end_reason);

  // Re-seed the fields from the prefill each time the modal opens.
  useEffect(() => {
    if (open) {
      setEndedDate(initial.ended_date);
      setReason(initial.end_reason);
    }
  }, [open, initial.ended_date, initial.end_reason]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Mark ended"
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
                ended_date: endedDate,
                end_reason: reason.trim(),
              })
            }
          >
            {saving ? "Saving…" : "Confirm ended"}
          </button>
        </>
      }
    >
      <div className="flex-col" style={{ gap: "var(--sp-4)" }}>
        <p className="caption" style={{ margin: 0 }}>
          Marks <strong>{agreementNumber}</strong>
          {clientLabel ? ` — ${clientLabel}` : ""} as ended and stamps the date
          and reason below in one action.
        </p>
        <div className="form-group">
          <label className="form-label">Ended date</label>
          <input
            type="date"
            value={endedDate}
            onChange={(e) => setEndedDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Reason</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why did the engagement end? (encouraged, e.g. offboarded, completed, cancelled by client)"
          />
        </div>
      </div>
    </Modal>
  );
}
