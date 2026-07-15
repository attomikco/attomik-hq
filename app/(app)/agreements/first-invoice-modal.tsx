"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { currency, dateISO, addDays } from "@/lib/format";
import type { Agreement } from "@/lib/types";

export type FirstInvoiceValues = {
  number: string;
  date: string;
  due: string;
  service_start_date: string;
  service_end_date: string;
  title: string;
  amount: number;
};

// Phase 1 net = sum of line item prices minus the (absolute) discount.
function phase1Net(a: Agreement): number {
  const subtotal = (a.phase1_items ?? []).reduce(
    (sum, it) => sum + (Number(it.price) || 0),
    0,
  );
  const discount = Number(a.phase1_discount) || 0;
  return Math.max(0, subtotal - discount);
}

// Deposit clause + percent from the free-text payment schedule, e.g.
// "60% upon signing, 40% upon delivery" -> { clause: "60% upon signing", pct: 60 }.
// Falls back to 60% when the schedule has no leading percent.
function depositFromSchedule(payment: string | null): {
  clause: string;
  pct: number;
} {
  const firstClause = (payment ?? "").split(",")[0].trim();
  const m = firstClause.match(/(\d+(?:\.\d+)?)\s*%/);
  if (firstClause && m) {
    return { clause: firstClause, pct: Number(m[1]) };
  }
  return { clause: "60% upon signing", pct: 60 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function FirstInvoiceModal({
  open,
  agreement,
  suggestedNumber,
  currencyCode,
  saving,
  onClose,
  onCreate,
}: {
  open: boolean;
  agreement: Agreement | null;
  suggestedNumber: string;
  currencyCode: string;
  saving: boolean;
  onClose: () => void;
  onCreate: (v: FirstInvoiceValues) => void;
}) {
  const net = useMemo(
    () => (agreement ? phase1Net(agreement) : 0),
    [agreement],
  );
  const deposit = useMemo(
    () => depositFromSchedule(agreement?.phase1_payment ?? null),
    [agreement],
  );

  const [number, setNumber] = useState(suggestedNumber);
  const [date, setDate] = useState("");
  const [due, setDue] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [title, setTitle] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");

  // Seed everything from the agreement each time the modal opens.
  useEffect(() => {
    if (!open || !agreement) return;
    const today = dateISO();
    setNumber(suggestedNumber);
    setDate(today);
    setDue(dateISO(addDays(new Date(), 15)));
    setStart("");
    setEnd("");
    setTitle(`Phase 1 — deposit (${deposit.clause})`);
    setPercent(String(deposit.pct));
    setAmount(String(round2((net * deposit.pct) / 100)));
  }, [open, agreement, suggestedNumber, net, deposit.clause, deposit.pct]);

  if (!agreement) return null;

  function onPercentChange(v: string) {
    setPercent(v);
    const p = Number(v);
    if (!Number.isNaN(p)) setAmount(String(round2((net * p) / 100)));
  }

  function onAmountChange(v: string) {
    setAmount(v);
    const a = Number(v);
    if (!Number.isNaN(a)) {
      setPercent(net > 0 ? String(round2((a / net) * 100)) : "");
    }
  }

  const amountNum = Number(amount) || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`First invoice — ${agreement.number}`}
      maxWidth={620}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !number.trim() || amountNum <= 0}
            onClick={() =>
              onCreate({
                number: number.trim(),
                date,
                due,
                service_start_date: start,
                service_end_date: end,
                title: title.trim(),
                amount: round2(amountNum),
              })
            }
          >
            {saving ? "Creating…" : "Create invoice"}
          </button>
        </>
      }
    >
      <div className="flex-col" style={{ gap: "var(--sp-4)" }}>
        <div
          className="caption"
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "var(--sp-2) var(--sp-3)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            background: "var(--cream, var(--paper))",
          }}
        >
          <span>Phase 1 net</span>
          <span className="mono">{currency(net, currencyCode)}</span>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Invoice number</label>
            <input
              className="mono"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Line item</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Deposit %</label>
            <input
              type="number"
              min="0"
              step="1"
              value={percent}
              onChange={(e) => onPercentChange(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label className="form-label">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Service period start</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Service period end</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="caption">
          Due {due || "—"}. Creates a draft invoice linked to this agreement. It
          is not sent.
        </div>
      </div>
    </Modal>
  );
}
