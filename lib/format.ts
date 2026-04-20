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

/** Short date like "May 24" — drops the year. */
export function dateCompact(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function dateShort(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateISO(d: Date = new Date()) {
  return d.toISOString().slice(0, 10);
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

export function proposalTotal(p: {
  p1_items?: LineItem[] | null;
  p1_total?: number | null;
  p1_discount?: number | null;
  phase1_price?: string | null;
  p2_rate?: number | null;
  p2_total?: number | null;
  p2_discount?: number | null;
}): number {
  const hasNewItems = Array.isArray(p.p1_items) && p.p1_items.length > 0;
  const p1Base = hasNewItems
    ? lineSubtotal(p.p1_items)
    : p.p1_total != null && Number.isFinite(Number(p.p1_total))
      ? Number(p.p1_total)
      : parseMoney(p.phase1_price);
  const p1Pct = Number(p.p1_discount ?? 0) || 0;
  const p1Net = Math.max(0, p1Base - p1Base * (p1Pct / 100));
  const p2Base =
    p.p2_rate != null && Number(p.p2_rate) > 0
      ? Number(p.p2_rate)
      : Number(p.p2_total ?? 0) || 0;
  const p2Pct = Number(p.p2_discount ?? 0) || 0;
  const p2Net = Math.max(0, p2Base - p2Base * (p2Pct / 100));
  return p1Net + p2Net;
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
