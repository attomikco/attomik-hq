import { Resend } from "resend";
import { renderInvoicePDF } from "@/lib/pdf/invoice-pdf";
import { buildInvoiceEmail } from "@/lib/email/invoice-email";
import { invoiceLogoAttachment } from "@/lib/email/logo";
import { resolveInvoiceRecipients } from "@/lib/email/recipients";
import type { Invoice, Service, SettingsMap } from "@/lib/types";

export type InvoiceClient = {
  ap_email?: string | null;
  ap_cc_emails?: string[] | null;
  email?: string | null;
} | null;

export type DispatchResult =
  | { ok: true; to: string; cc: string[]; id: string | null }
  | { ok: false; code: "recipient" | "send"; error: string };

/**
 * Send ONE invoice email (PDF + logo attached). Shared by the manual send
 * route and the auto-send cron so they never diverge. Does not touch the DB —
 * the caller owns the status update.
 */
export async function sendInvoiceEmail(params: {
  invoice: Invoice;
  settings: SettingsMap;
  services: Service[];
  client: InvoiceClient;
  resend: Resend;
  from: string;
  replyTo?: string;
}): Promise<DispatchResult> {
  const { invoice, settings, services, client, resend, from, replyTo } = params;

  const recipients = resolveInvoiceRecipients({
    apEmail: client?.ap_email ?? null,
    apCc: client?.ap_cc_emails ?? null,
    invoiceClientEmail: invoice.client_email,
    clientEmail: client?.email ?? null,
  });
  if (!recipients.ok) {
    return { ok: false, code: "recipient", error: recipients.error };
  }
  const { to, cc } = recipients;

  const { bytes, filename } = renderInvoicePDF(invoice, settings, services);
  const { subject, html, text } = buildInvoiceEmail(invoice, settings);

  const { data, error } = await resend.emails.send({
    from,
    to,
    cc,
    replyTo,
    subject,
    html,
    text,
    attachments: [{ filename, content: bytes }, invoiceLogoAttachment],
  });

  if (error) {
    return { ok: false, code: "send", error: error.message ?? "Failed to send email." };
  }
  return { ok: true, to, cc: cc ?? [], id: data?.id ?? null };
}
