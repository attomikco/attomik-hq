// Shared recipient/CC resolution for invoice emails (send + reminder), so both
// paths stay consistent and tolerate malformed CC addresses identically.

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

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
  const alwaysCc = "pablo@attomik.co";
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
