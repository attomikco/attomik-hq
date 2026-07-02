import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { renderInvoicePDF } from "@/lib/pdf/invoice-pdf";
import { buildInvoiceEmail } from "@/lib/email/invoice-email";
import type { Invoice, Service, SettingsMap } from "@/lib/types";

// jsPDF needs the Node runtime (Buffer, no Edge).
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();

  // Auth — middleware already gates this, but verify defensively.
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

  // Load the invoice + supporting data server-side (single source of truth).
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", params.id)
    .single<Invoice>();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (!invoice.client_email) {
    return NextResponse.json(
      { error: "This invoice has no client email address." },
      { status: 400 },
    );
  }

  const [{ data: settingsRows }, { data: services }] = await Promise.all([
    supabase.from("settings").select("key, value"),
    supabase.from("services").select("id, name, description, desc, price"),
  ]);

  const settings: SettingsMap = {};
  for (const row of (settingsRows as { key: string; value: string }[] | null) ??
    []) {
    (settings as Record<string, string>)[row.key] = row.value;
  }

  // Render PDF + email body.
  const { bytes, filename } = renderInvoicePDF(
    invoice,
    settings,
    (services as Service[]) ?? [],
  );
  const { subject, html, text } = buildInvoiceEmail(invoice, settings);

  const brand = settings.brand_name ?? "Attomik";
  const from = process.env.INVOICE_FROM ?? `${brand} <accounts@attomik.co>`;
  const replyTo = process.env.INVOICE_REPLY_TO || undefined;

  // Always keep Pablo in the loop (env-overridable). Skip if it's the recipient.
  const ccAddr = process.env.INVOICE_CC ?? "pablo@attomik.co";
  const cc =
    ccAddr && ccAddr.toLowerCase() !== invoice.client_email.toLowerCase()
      ? ccAddr
      : undefined;

  const resend = new Resend(apiKey);
  const { data: sent, error: sendErr } = await resend.emails.send({
    from,
    to: invoice.client_email,
    cc,
    replyTo,
    subject,
    html,
    text,
    attachments: [{ filename, content: bytes }],
  });

  if (sendErr) {
    return NextResponse.json(
      { error: sendErr.message ?? "Failed to send email." },
      { status: 502 },
    );
  }

  // Mark as sent (don't downgrade a paid invoice).
  if (invoice.status !== "paid") {
    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoice.id);
  }

  return NextResponse.json({
    ok: true,
    id: sent?.id ?? null,
    to: invoice.client_email,
  });
}
