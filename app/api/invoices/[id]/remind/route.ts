import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { renderInvoicePDF } from "@/lib/pdf/invoice-pdf";
import { buildInvoiceReminderEmail } from "@/lib/email/invoice-email";
import { invoiceLogoAttachment } from "@/lib/email/logo";
import {
  invoiceRecipientCandidates,
  resolveInvoiceRecipients,
  resolveSelectedRecipients,
} from "@/lib/email/recipients";
import type { Invoice, Service, SettingsMap } from "@/lib/types";

// jsPDF needs the Node runtime (Buffer, no Edge).
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();

  // Optional explicit recipient picks from the reminder dialog, in order:
  // the first is the To, the rest are CC'd. Omitted → automatic routing.
  const body = (await req.json().catch(() => null)) as
    | { recipients?: unknown }
    | null;
  const picked = Array.isArray(body?.recipients)
    ? body.recipients.filter((r): r is string => typeof r === "string")
    : null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email is not configured (missing RESEND_API_KEY)." },
      { status: 500 },
    );
  }

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", params.id)
    .single<Invoice & { reminder_count?: number | null }>();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Reminders only make sense for unpaid, already-sent invoices.
  if (invoice.status === "paid") {
    return NextResponse.json(
      { error: "This invoice is already marked paid." },
      { status: 400 },
    );
  }
  if (invoice.status === "draft" || invoice.status === "ready") {
    return NextResponse.json(
      { error: "Send the invoice before sending a reminder." },
      { status: 400 },
    );
  }

  const [{ data: client }, { data: settingsRows }, { data: services }] =
    await Promise.all([
      invoice.client_id
        ? supabase
            .from("clients")
            .select("ap_email, ap_cc_emails, email, emails")
            .eq("id", invoice.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("settings").select("key, value"),
      supabase.from("services").select("id, name, description, desc, price"),
    ]);

  const settings: SettingsMap = {};
  for (const row of (settingsRows as { key: string; value: string }[] | null) ??
    []) {
    (settings as Record<string, string>)[row.key] = row.value;
  }

  const contacts = {
    apEmail: client?.ap_email as string | null,
    apCc: client?.ap_cc_emails as string[] | null,
    invoiceClientEmail: invoice.client_email,
    clientEmail: client?.email as string | null,
    clientEmails: client?.emails as string[] | null,
  };

  let recipients;
  if (picked) {
    // Only addresses already tied to this invoice/client may be picked, so a
    // hand-crafted request can't turn this into an open relay.
    const allowed = new Set(
      invoiceRecipientCandidates(contacts).map((c) => c.email.toLowerCase()),
    );
    const unknown = picked.find((e) => !allowed.has(e.trim().toLowerCase()));
    if (unknown) {
      return NextResponse.json(
        { error: `"${unknown}" is not one of this invoice's contacts.` },
        { status: 400 },
      );
    }
    recipients = resolveSelectedRecipients(picked);
  } else {
    recipients = resolveInvoiceRecipients(contacts);
  }
  if (!recipients.ok) {
    return NextResponse.json({ error: recipients.error }, { status: 400 });
  }
  const { to, cc } = recipients;

  const now = new Date();
  const { bytes, filename } = renderInvoicePDF(
    invoice,
    settings,
    (services as Service[]) ?? [],
  );
  const { subject, html, text } = buildInvoiceReminderEmail(
    invoice,
    settings,
    now,
  );

  const brand = settings.brand_name ?? "Attomik";
  const from = process.env.INVOICE_FROM ?? `${brand} <accounts@attomik.co>`;
  const replyTo = process.env.INVOICE_REPLY_TO || undefined;

  const resend = new Resend(apiKey);
  const { data: sent, error: sendErr } = await resend.emails.send({
    from,
    to,
    cc,
    replyTo,
    subject,
    html,
    text,
    attachments: [{ filename, content: bytes }, invoiceLogoAttachment],
  });

  if (sendErr) {
    return NextResponse.json(
      { error: sendErr.message ?? "Failed to send reminder." },
      { status: 502 },
    );
  }

  // Track the reminder for visibility (and the future auto-reminder cron).
  await supabase
    .from("invoices")
    .update({
      last_reminder_at: now.toISOString(),
      reminder_count: (invoice.reminder_count ?? 0) + 1,
    })
    .eq("id", invoice.id);

  return NextResponse.json({
    ok: true,
    id: sent?.id ?? null,
    to,
    cc: cc ?? [],
    reminder_count: (invoice.reminder_count ?? 0) + 1,
  });
}
