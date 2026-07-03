import {
  currency,
  dateShort,
  invoiceTotal,
  lineSubtotal,
  type LineItem,
} from "@/lib/format";
import type { Invoice, SettingsMap } from "@/lib/types";
import { INVOICE_LOGO_CID } from "./logo";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Escape, then turn newlines into <br> — pre-line/pre-wrap are unreliable
// across email clients (notably Outlook), so we hardcode the breaks.
function escBr(s: string): string {
  return esc(s).replace(/\r?\n/g, "<br>");
}

// Attomik accent green — used sparingly as a top rule.
const ACCENT = "#00e88a";

type Row = { label: string; value: string; big?: boolean };

function rowHtml({ label, value, big }: Row): string {
  return `
                  <tr>
                    <td style="padding:10px 0;font-size:13px;color:#6b7280;">${esc(label)}</td>
                    <td style="padding:10px 0;font-size:${big ? "22px" : "13px"};font-weight:${big ? "700" : "600"};color:#111;text-align:right;">${esc(value)}</td>
                  </tr>`;
}

/** Common facts derived from an invoice + settings. */
function facts(inv: Invoice, settings: SettingsMap) {
  const brand = settings.brand_name ?? "Attomik";
  const legal =
    settings.legal_name && settings.legal_name !== brand
      ? settings.legal_name
      : "";
  const code = settings.currency ?? "USD";
  const total = invoiceTotal(inv.items, inv.discount);
  const totalStr = currency(total, code);
  const num = inv.number ?? "";
  const issued = dateShort(inv.date);
  const due = dateShort(inv.due);
  const clientLabel = (inv.client_name || inv.client_company || "").trim();
  const greetText = clientLabel ? `Hi ${clientLabel} Team,` : "Hi Team,";
  const greetHtml = clientLabel ? `Hi ${esc(clientLabel)} Team,` : "Hi Team,";
  const pay = settings.payment_instructions ?? "";
  const terms = settings.default_payment_terms
    ? settings.default_payment_terms.replace(
        /\{due_date\}/g,
        inv.due ? due : "receipt",
      )
    : "";
  return {
    brand,
    legal,
    code,
    total,
    totalStr,
    num,
    issued,
    due,
    greetText,
    greetHtml,
    pay,
    terms,
  };
}

function lineParts(it: LineItem, code: string) {
  const qty = Number(it.qty ?? it.quantity ?? 1) || 0;
  const rate = Number(it.rate ?? it.price ?? 0) || 0;
  const title = String(it.title ?? it.name ?? "").trim() || "—";
  return { qty, rate, amount: qty * rate, title, amountStr: currency(qty * rate, code) };
}

/**
 * Bordered details block: meta rows (invoice #, dates…), the itemized
 * services with amounts, and subtotal / discount / total due.
 */
function detailsBlockHtml(inv: Invoice, code: string, metaRows: Row[]): string {
  const items: LineItem[] = Array.isArray(inv.items) ? inv.items : [];

  const itemRows = items
    .map((it) => {
      const { qty, rate, title, amountStr } = lineParts(it, code);
      const qtyNote =
        qty !== 1
          ? ` &nbsp;<span style="color:#9ca3af;">${esc(String(qty))} × ${esc(currency(rate, code))}</span>`
          : "";
      return `
                  <tr>
                    <td style="padding:9px 0;font-size:13px;color:#374151;border-top:1px solid #f0f0f2;">${esc(title)}${qtyNote}</td>
                    <td style="padding:9px 0;font-size:13px;font-weight:600;color:#111;text-align:right;white-space:nowrap;border-top:1px solid #f0f0f2;">${esc(amountStr)}</td>
                  </tr>`;
    })
    .join("");

  const subtotal = lineSubtotal(items);
  const discPct = Number(inv.discount ?? 0) || 0;
  const discAmt = subtotal * (discPct / 100);
  const total = Math.max(0, subtotal - discAmt);

  const subtotalRow = `
                  <tr>
                    <td style="padding:10px 0 0;font-size:13px;color:#6b7280;">Subtotal</td>
                    <td style="padding:10px 0 0;font-size:13px;color:#374151;text-align:right;">${esc(currency(subtotal, code))}</td>
                  </tr>`;
  const discountRow =
    discPct > 0
      ? `
                  <tr>
                    <td style="padding:4px 0 0;font-size:13px;color:#6b7280;">Discount (${discPct}%)</td>
                    <td style="padding:4px 0 0;font-size:13px;color:#374151;text-align:right;">&minus; ${esc(currency(discAmt, code))}</td>
                  </tr>`
      : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececef;border-bottom:1px solid #ececef;margin:0 0 22px;">
                  ${metaRows.map(rowHtml).join("")}
                  <tr>
                    <td style="padding:14px 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;font-weight:700;">Service</td>
                    <td style="padding:14px 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;font-weight:700;text-align:right;">Amount</td>
                  </tr>${itemRows}${subtotalRow}${discountRow}
                  <tr>
                    <td style="padding:12px 0;font-size:13px;color:#6b7280;font-weight:700;border-top:1px solid #ececef;">Total due</td>
                    <td style="padding:12px 0;font-size:22px;font-weight:700;color:#111;text-align:right;border-top:1px solid #ececef;">${esc(currency(total, code))}</td>
                  </tr>
                </table>`;
}

/** Plain-text version of the itemized services + total. */
function detailsTextLines(inv: Invoice, code: string): string[] {
  const items: LineItem[] = Array.isArray(inv.items) ? inv.items : [];
  const lines = items.map((it) => {
    const { qty, rate, title, amountStr } = lineParts(it, code);
    const qtyNote = qty !== 1 ? ` (${qty} × ${currency(rate, code)})` : "";
    return `  - ${title}${qtyNote}: ${amountStr}`;
  });
  const subtotal = lineSubtotal(items);
  const discPct = Number(inv.discount ?? 0) || 0;
  const discAmt = subtotal * (discPct / 100);
  const total = invoiceTotal(inv.items, inv.discount);
  return [
    "Services:",
    ...lines,
    `Subtotal: ${currency(subtotal, code)}`,
    ...(discPct > 0 ? [`Discount (${discPct}%): -${currency(discAmt, code)}`] : []),
    `Total due: ${currency(total, code)}`,
  ];
}

function payTermsHtml(pay: string, terms: string): string {
  return `${
    pay
      ? `<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;font-weight:700;">How to pay</p>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#374151;">${escBr(pay)}</p>`
      : ""
  }${
    terms
      ? `<p style="margin:0 0 18px;font-size:12px;line-height:1.6;color:#9ca3af;">${escBr(terms)}</p>`
      : ""
  }`;
}

/** Shared HTML shell: accent rule, centered logo, greeting, body, footer. */
function shell(opts: {
  brand: string;
  legal: string;
  settings: SettingsMap;
  preheader: string;
  greetHtml: string;
  bodyHtml: string;
}): string {
  const { brand, legal, settings, preheader, greetHtml, bodyHtml } = opts;
  const footerBits = [legal || brand, settings.address, settings.email].filter(
    Boolean,
  ) as string[];
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;border:1px solid #e7e7ea;overflow:hidden;">
            <tr><td style="height:4px;background:${ACCENT};font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:28px 36px 4px;">
                <img src="cid:${INVOICE_LOGO_CID}" alt="${esc(brand)}" width="128" height="37" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;height:37px;width:auto;max-width:160px;" />
                <div style="font-size:19px;font-weight:800;letter-spacing:-0.02em;color:#111;">${esc(brand)}</div>
                ${legal ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px;">${esc(legal)}</div>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 8px;font-size:15px;line-height:1.65;color:#374151;">
                <p style="margin:0 0 14px;">${greetHtml}</p>
                ${bodyHtml}
                <p style="margin:0;font-size:15px;color:#374151;">Thanks,<br/><strong>${esc(brand)}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 28px;">
                <div style="border-top:1px solid #ececef;padding-top:16px;font-size:12px;line-height:1.6;color:#9ca3af;">
                  ${footerBits.map((b) => esc(b)).join(" &nbsp;·&nbsp; ")}
                </div>
              </td>
            </tr>
          </table>
          <div style="font-size:11px;color:#b6b6bd;padding:16px 0 0;">Sent by ${esc(brand)}</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Invoice email — a concise cover note; the PDF is attached.
 */
export function buildInvoiceEmail(inv: Invoice, settings: SettingsMap) {
  const f = facts(inv, settings);
  const contactBits = [settings.email, settings.phone].filter(Boolean);

  const subject = `Invoice ${f.num} from ${f.brand}`;
  const preheader = `Invoice ${f.num} · ${f.totalStr}${inv.due ? ` · due ${f.due}` : ""}`;

  const metaRows: Row[] = [
    { label: "Invoice", value: f.num },
    ...(inv.date ? [{ label: "Issued", value: f.issued }] : []),
    ...(inv.due ? [{ label: "Due date", value: f.due }] : []),
  ];

  const bodyHtml = `<p style="margin:0 0 20px;">Thanks for working with ${esc(f.brand)}. Your invoice <strong>${esc(f.num)}</strong> is attached to this email as a PDF — here's a quick summary.</p>
                ${detailsBlockHtml(inv, f.code, metaRows)}
                ${payTermsHtml(f.pay, f.terms)}
                <p style="margin:0 0 20px;font-size:14px;color:#374151;">Any questions about this invoice? Just reply to this email and we'll take care of it.</p>`;

  const html = shell({
    brand: f.brand,
    legal: f.legal,
    settings,
    preheader,
    greetHtml: f.greetHtml,
    bodyHtml,
  });

  const text = [
    f.greetText,
    ``,
    `Thanks for working with ${f.brand}. Your invoice ${f.num} is attached as a PDF.`,
    ``,
    `Invoice: ${f.num}`,
    inv.date ? `Issued: ${f.issued}` : "",
    inv.due ? `Due: ${f.due}` : "",
    ``,
    ...detailsTextLines(inv, f.code),
    ``,
    f.pay ? `How to pay:\n${f.pay}` : "",
    f.terms ? `\n${f.terms}` : "",
    ``,
    `Any questions about this invoice? Just reply to this email.`,
    ``,
    `Thanks,`,
    f.brand,
    contactBits.length ? contactBits.join(" · ") : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html, text };
}

function daysOverdue(due: string | null | undefined, asOf: Date): number {
  if (!due) return 0;
  const d = new Date(`${due}T00:00:00`);
  const ms = asOf.getTime() - d.getTime();
  return ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

/**
 * Payment reminder for an overdue invoice — friendly nudge, PDF re-attached.
 * `asOf` is the reference date for the "days overdue" figure.
 */
export function buildInvoiceReminderEmail(
  inv: Invoice,
  settings: SettingsMap,
  asOf: Date,
) {
  const f = facts(inv, settings);
  const overdue = daysOverdue(inv.due, asOf);
  const overdueStr =
    overdue > 0 ? `${overdue} day${overdue === 1 ? "" : "s"} past due` : "due";

  const subject = `Payment reminder: Invoice ${f.num} from ${f.brand}`;
  const preheader = `Invoice ${f.num} · ${f.totalStr}${overdue > 0 ? ` · ${overdue}d overdue` : ""}`;

  const metaRows: Row[] = [
    { label: "Invoice", value: f.num },
    ...(inv.due ? [{ label: "Due date", value: f.due }] : []),
    ...(overdue > 0 ? [{ label: "Status", value: overdueStr }] : []),
  ];

  const dueClause = inv.due
    ? ` was due on ${f.due}${overdue > 0 ? ` and is now ${overdueStr}` : ""}`
    : "";

  const bodyHtml = `<p style="margin:0 0 20px;">This is a friendly reminder that invoice <strong>${esc(f.num)}</strong> for <strong>${esc(f.totalStr)}</strong>${esc(dueClause)}. A copy is attached again for your convenience. If payment is already on its way, thank you — please disregard this note.</p>
                ${detailsBlockHtml(inv, f.code, metaRows)}
                ${payTermsHtml(f.pay, f.terms)}
                <p style="margin:0 0 20px;font-size:14px;color:#374151;">Already paid, or have a question? Just reply to this email and we'll sort it out.</p>`;

  const html = shell({
    brand: f.brand,
    legal: f.legal,
    settings,
    preheader,
    greetHtml: f.greetHtml,
    bodyHtml,
  });

  const text = [
    f.greetText,
    ``,
    `A friendly reminder that invoice ${f.num} for ${f.totalStr}${dueClause}. A copy is attached.`,
    ``,
    `Invoice: ${f.num}`,
    inv.due ? `Due: ${f.due}` : "",
    overdue > 0 ? `Status: ${overdueStr}` : "",
    ``,
    ...detailsTextLines(inv, f.code),
    ``,
    f.pay ? `How to pay:\n${f.pay}` : "",
    f.terms ? `\n${f.terms}` : "",
    ``,
    `Already paid, or have a question? Just reply to this email.`,
    ``,
    `Thanks,`,
    f.brand,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html, text };
}
