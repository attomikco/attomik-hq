// Shared recipient/CC resolution for invoice emails (send + reminder), so both
// paths stay consistent and tolerate malformed CC addresses identically.

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Always CC'd on invoice emails — cannot be unchecked in the UI. */
export const ALWAYS_CC = "pablo@attomik.co";

export type ResolvedRecipients =
  | { ok: true; to: string; cc?: string[] }
  | { ok: false; error: string };

/**
 * Resolve the To + Cc for an invoice email.
 *   To = accounts-payable email → invoice's client email → client primary email
 *   Cc = client's invoice CC list + pablo@attomik.co (always) + any INVOICE_CC
 *        extras, deduped, stray comma/semicolon entries split, invalid
 *        addresses dropped, recipient removed so nobody is both To and Cc.
 */
export function resolveInvoiceRecipients(opts: {
  apEmail?: string | null;
  apCc?: string[] | null;
  invoiceClientEmail?: string | null;
  clientEmail?: string | null;
}): ResolvedRecipients {
  const to = (
    opts.apEmail ||
    opts.invoiceClientEmail ||
    opts.clientEmail ||
    ""
  ).trim();
  if (!to) {
    return {
      ok: false,
      error: "No recipient — set an accounts-payable or client email.",
    };
  }
  if (!isEmail(to)) {
    return {
      ok: false,
      error: `The recipient address "${to}" is not a valid email.`,
    };
  }

  // pablo@attomik.co is ALWAYS CC'd on invoice emails. INVOICE_CC may add
  // further addresses (comma/semicolon separated) but can't remove Pablo.
  const alwaysCc = ALWAYS_CC;
  const extraCc = process.env.INVOICE_CC ?? "";
  const apCc = Array.isArray(opts.apCc) ? opts.apCc : [];
  const ccMap = new Map<string, string>();
  for (const raw of [...apCc, alwaysCc, extraCc]) {
    for (const piece of String(raw ?? "").split(/[,;]/)) {
      const v = piece.trim();
      if (!v || !isEmail(v)) continue;
      const key = v.toLowerCase();
      if (key === to.toLowerCase() || ccMap.has(key)) continue;
      ccMap.set(key, v);
    }
  }
  const cc = ccMap.size ? [...ccMap.values()] : undefined;
  return { ok: true, to, cc };
}

export type RecipientCandidate = {
  email: string;
  /** Where the address came from, e.g. "Accounts payable". */
  label: string;
  /** Ticked when the reminder dialog opens (mirrors the automatic routing). */
  checked: boolean;
  /** Always CC'd — the checkbox is shown but disabled. */
  locked?: boolean;
};

/**
 * Every address a reminder could reasonably go to, in priority order, so the
 * UI checkbox list and the server-side validation agree on what's allowed.
 * The default ticks reproduce resolveInvoiceRecipients(): the first available
 * of AP → invoice → client email as To, plus the client's invoice CC list.
 */
export function invoiceRecipientCandidates(opts: {
  apEmail?: string | null;
  apCc?: string[] | null;
  invoiceClientEmail?: string | null;
  clientEmail?: string | null;
  clientEmails?: string[] | null;
}): RecipientCandidate[] {
  const primary = [
    { email: opts.apEmail, label: "Accounts payable" },
    { email: opts.invoiceClientEmail, label: "Invoice contact" },
    { email: opts.clientEmail, label: "Client email" },
  ];
  const rest = [
    ...(opts.apCc ?? []).map((e) => ({ email: e, label: "Invoice CC", cc: true })),
    ...(opts.clientEmails ?? []).map((e) => ({ email: e, label: "Client contact" })),
  ];

  const byEmail = new Map<string, RecipientCandidate>();
  let hasTo = false;
  const add = (raw: unknown, label: string, checked: boolean) => {
    for (const piece of String(raw ?? "").split(/[,;]/)) {
      const email = piece.trim();
      if (!email || !isEmail(email)) continue;
      const key = email.toLowerCase();
      const existing = byEmail.get(key);
      if (existing) {
        existing.checked = existing.checked || checked;
        continue;
      }
      byEmail.set(key, { email, label, checked });
    }
  };

  for (const p of primary) {
    // Only the first address that resolves is the default To.
    const before = byEmail.size;
    add(p.email, p.label, !hasTo);
    if (!hasTo && byEmail.size > before) hasTo = true;
  }
  for (const r of rest) add(r.email, r.label, "cc" in r && !!r.cc);

  const out = [...byEmail.values()];
  const alwaysKey = ALWAYS_CC.toLowerCase();
  const mine = out.find((c) => c.email.toLowerCase() === alwaysKey);
  if (mine) {
    mine.checked = true;
    mine.locked = true;
  } else {
    out.push({ email: ALWAYS_CC, label: "You (always CC'd)", checked: true, locked: true });
  }
  return out;
}

/**
 * Turn an explicit, ordered recipient selection into To + Cc. The first
 * address is the To, the rest are CC'd, and ALWAYS_CC/INVOICE_CC are folded in
 * exactly as they are for automatic sends.
 */
export function resolveSelectedRecipients(selected: string[]): ResolvedRecipients {
  const picked: string[] = [];
  for (const raw of selected ?? []) {
    const v = String(raw ?? "").trim();
    if (!v || !isEmail(v)) continue;
    if (picked.some((p) => p.toLowerCase() === v.toLowerCase())) continue;
    picked.push(v);
  }
  const [to, ...others] = picked;
  if (!to) {
    return { ok: false, error: "Select at least one valid recipient." };
  }

  const ccMap = new Map<string, string>();
  for (const raw of [...others, ALWAYS_CC, process.env.INVOICE_CC ?? ""]) {
    for (const piece of String(raw ?? "").split(/[,;]/)) {
      const v = piece.trim();
      if (!v || !isEmail(v)) continue;
      const key = v.toLowerCase();
      if (key === to.toLowerCase() || ccMap.has(key)) continue;
      ccMap.set(key, v);
    }
  }
  return { ok: true, to, cc: ccMap.size ? [...ccMap.values()] : undefined };
}
