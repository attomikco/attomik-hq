export function currency(n: number, code = "USD") {
  return (Number(n) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: code,
  });
}

/** Currency without trailing `.00` on whole numbers. */
export function currencyCompact(n: number, code = "USD") {
  const v = Number(n) || 0;
  const whole = Number.isInteger(v);
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

// Parse "YYYY-MM-DD" as a local-timezone date. Passing such a string to
// `new Date()` parses it as UTC midnight, which in Americas timezones shifts
// to the previous day when formatted with toLocaleDateString, so date-only
// values stored in the DB render a day earlier in tables/previews/PDFs than
// in <input type="date"> fields. Full timestamps fall through to Date().
function parseDateValue(d: string | Date): Date {
  if (typeof d !== "string") return d;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(d);
}

/** Short date like "May 24" — drops the year. */
export function dateCompact(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = parseDateValue(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function dateShort(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = parseDateValue(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateISO(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export type LineItem = {
  service_id?: string | null;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  desc?: string | null;
  qty?: number | string | null;
  quantity?: number | string | null;
  rate?: number | string | null;
  price?: number | string | null;
};

export function lineSubtotal(items: LineItem[] | null | undefined) {
  const list = Array.isArray(items) ? items : [];
  return list.reduce((sum, it) => {
    const qty = Number(it.qty ?? it.quantity ?? 1) || 0;
    const rate = Number(it.rate ?? it.price ?? 0) || 0;
    return sum + qty * rate;
  }, 0);
}

export function invoiceTotal(
  items: LineItem[] | null | undefined,
  discountPercent: number | null | undefined,
) {
  const subtotal = lineSubtotal(items);
  const pct = Number(discountPercent ?? 0) || 0;
  return Math.max(0, subtotal - subtotal * (pct / 100));
}

function parseMoney(s: string | null | undefined): number {
  if (!s) return 0;
  const m = String(s).replace(/[^0-9.]/g, "");
  const n = parseFloat(m);
  return isNaN(n) ? 0 : n;
}

type ProposalForTotals = {
  p1_items?: LineItem[] | null;
  p1_total?: number | null;
  p1_discount?: number | null;
  p1_discount_amount?: number | null;
  phase1_price?: string | null;
  p2_items?: LineItem[] | null;
  p2_rate?: number | null;
  p2_total?: number | null;
  p2_discount?: number | null;
  p2_discount_amount?: number | null;
};

export function proposalPhase1Net(p: ProposalForTotals): number {
  const hasNewItems = Array.isArray(p.p1_items) && p.p1_items.length > 0;
  const p1Base = hasNewItems
    ? lineSubtotal(p.p1_items)
    : p.p1_total != null && Number.isFinite(Number(p.p1_total))
      ? Number(p.p1_total)
      : parseMoney(p.phase1_price);
  const p1Amt = Number(p.p1_discount_amount ?? 0) || 0;
  const p1Discount =
    p1Amt > 0
      ? p1Amt
      : p1Base * ((Number(p.p1_discount ?? 0) || 0) / 100);
  return Math.max(0, p1Base - p1Discount);
}

export function proposalPhase2Net(p: ProposalForTotals): number {
  const hasNewItems = Array.isArray(p.p2_items) && p.p2_items.length > 0;
  const p2Base = hasNewItems
    ? lineSubtotal(p.p2_items)
    : p.p2_rate != null && Number(p.p2_rate) > 0
      ? Number(p.p2_rate)
      : Number(p.p2_total ?? 0) || 0;
  const p2Amt = Number(p.p2_discount_amount ?? 0) || 0;
  const p2Discount =
    p2Amt > 0
      ? p2Amt
      : p2Base * ((Number(p.p2_discount ?? 0) || 0) / 100);
  return Math.max(0, p2Base - p2Discount);
}

export function proposalTotal(p: ProposalForTotals): number {
  return proposalPhase1Net(p) + proposalPhase2Net(p);
}

export function nextInvoiceNumber(
  existing: { number: string | null }[],
  prefix = "ATM",
) {
  // Matches either "ATM001" or "#ATM001" (case-insensitive) so we pick up
  // historical records from the Google Sheet too.
  const re = new RegExp(`^#?${prefix}(\\d+)$`, "i");
  let max = 0;
  for (const inv of existing) {
    if (!inv.number) continue;
    const m = re.exec(inv.number);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `#${prefix}${String(max + 1).padStart(3, "0")}`;
}
