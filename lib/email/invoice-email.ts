import { currency, dateShort, invoiceTotal } from "@/lib/format";
import type { Invoice, SettingsMap } from "@/lib/types";
import { INVOICE_LOGO_CID } from "./logo";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Attomik accent green — used sparingly as a top rule.
const ACCENT = "#00e88a";

/**
 * Build the subject / html / text for an invoice email.
 * The PDF is sent as an attachment, so the body is a concise cover note that
 * restates the key facts (number, amount, due date) and how to pay.
 */
export function buildInvoiceEmail(inv: Invoice, settings: SettingsMap) {
  const brand = settings.brand_name ?? "Attomik";
  const legal = settings.legal_name && settings.legal_name !== brand
    ? settings.legal_name
    : "";
  const code = settings.currency ?? "USD";
  const total = invoiceTotal(inv.items, inv.discount);
  const totalStr = currency(total, code);
  const num = inv.number ?? "";
  const issued = dateShort(inv.date);
  const due = dateShort(inv.due);
  const greetName = inv.client_name ? ` ${inv.client_name.split(" ")[0]}` : "";

  const pay = settings.payment_instructions ?? "";
  const terms = settings.default_payment_terms
    ? settings.default_payment_terms.replace(
        /\{due_date\}/g,
        inv.due ? due : "receipt",
      )
    : "";

  // Contact line for the footer / sign-off.
  const contactBits = [settings.email, settings.phone].filter(Boolean);
  const footerBits = [legal || brand, settings.address, settings.email].filter(
    Boolean,
  ) as string[];

  const subject = `Invoice ${num} from ${brand}`;

  // ── Plain-text fallback ────────────────────────────────────────────────
  const text = [
    `Hi${greetName},`,
    ``,
    `Thanks for working with ${brand}. Your invoice ${num} is attached as a PDF.`,
    ``,
    `Invoice: ${num}`,
    `Amount due: ${totalStr}`,
    inv.date ? `Issued: ${issued}` : "",
    inv.due ? `Due: ${due}` : "",
    ``,
    pay ? `How to pay:\n${pay}` : "",
    terms ? `\n${terms}` : "",
    ``,
    `Any questions about this invoice? Just reply to this email.`,
    ``,
    `Thanks,`,
    brand,
    contactBits.length ? contactBits.join(" · ") : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  // ── HTML ───────────────────────────────────────────────────────────────
  const preheader = `Invoice ${num} · ${totalStr}${inv.due ? ` · due ${due}` : ""}`;

  const row = (label: string, value: string, big = false) => `
                  <tr>
                    <td style="padding:10px 0;font-size:13px;color:#6b7280;">${esc(label)}</td>
                    <td style="padding:10px 0;font-size:${big ? "22px" : "13px"};font-weight:${big ? "700" : "600"};color:#111;text-align:right;">${esc(value)}</td>
                  </tr>`;

  const html = `<!doctype html>
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
                <p style="margin:0 0 14px;">Hi${esc(greetName)},</p>
                <p style="margin:0 0 20px;">Thanks for working with ${esc(brand)}. Your invoice <strong>${esc(num)}</strong> is attached to this email as a PDF — here's a quick summary.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececef;border-bottom:1px solid #ececef;margin:0 0 22px;">
                  ${row("Invoice", num)}${row("Amount due", totalStr, true)}${inv.date ? row("Issued", issued) : ""}${inv.due ? row("Due date", due) : ""}
                </table>
                ${
                  pay
                    ? `<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;font-weight:700;">How to pay</p>
                <p style="margin:0 0 18px;font-size:14px;color:#374151;white-space:pre-line;">${esc(pay)}</p>`
                    : ""
                }
                ${
                  terms
                    ? `<p style="margin:0 0 18px;font-size:12px;color:#9ca3af;white-space:pre-line;">${esc(terms)}</p>`
                    : ""
                }
                <p style="margin:0 0 20px;font-size:14px;color:#374151;">Any questions about this invoice? Just reply to this email and we'll take care of it.</p>
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

  return { subject, html, text };
}
