import { currency, dateShort, invoiceTotal } from "@/lib/format";
import type { Invoice, SettingsMap } from "@/lib/types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the subject / html / text for an invoice email.
 * The PDF is sent as an attachment, so the body is a short cover note.
 */
export function buildInvoiceEmail(inv: Invoice, settings: SettingsMap) {
  const brand = settings.brand_name ?? "Attomik";
  const code = settings.currency ?? "USD";
  const total = invoiceTotal(inv.items, inv.discount);
  const totalStr = currency(total, code);
  const num = inv.number ?? "";
  const due = dateShort(inv.due);
  const greetName = inv.client_name ? ` ${inv.client_name.split(" ")[0]}` : "";
  const pay = settings.payment_instructions ?? "";

  const subject = `Invoice ${num} · ${brand}`;

  const text = [
    `Hi${greetName},`,
    ``,
    `Please find attached invoice ${num} for ${totalStr}.`,
    `Due: ${due}`,
    pay ? `\n${pay}` : "",
    ``,
    `Thanks,`,
    brand,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #ebebeb;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;">${esc(brand)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px;font-size:14px;line-height:1.6;color:#333;">
                <p style="margin:0 0 16px;">Hi${esc(greetName)},</p>
                <p style="margin:0 0 16px;">Please find attached invoice <strong>${esc(num)}</strong>. Details below.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ebebeb;border-bottom:1px solid #ebebeb;margin:8px 0 20px;">
                  <tr>
                    <td style="padding:12px 0;font-size:13px;color:#666;">Amount due</td>
                    <td style="padding:12px 0;font-size:20px;font-weight:700;text-align:right;">${esc(totalStr)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 12px;font-size:13px;color:#666;">Due date</td>
                    <td style="padding:0 0 12px;font-size:13px;text-align:right;font-weight:600;">${esc(due)}</td>
                  </tr>
                </table>
                ${
                  pay
                    ? `<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#999;font-weight:700;">Payment</p>
                <p style="margin:0 0 16px;font-size:13px;color:#333;white-space:pre-line;">${esc(pay)}</p>`
                    : ""
                }
                <p style="margin:16px 0 0;font-size:14px;">Thanks,<br/>${esc(brand)}</p>
              </td>
            </tr>
          </table>
          <div style="font-size:11px;color:#999;padding:16px 0;">${esc(brand)}</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
