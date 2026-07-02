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
  // Load the client (for the accounts-payable billing contact) + settings +
  // services. Client is optional — invoices can predate a client link.
  const [{ data: client }, { data: settingsRows }, { data: services }] =
    await Promise.all([
      invoice.client_id
        ? supabase
            .from("clients")
            .select("ap_email, ap_cc_emails, email")
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

  // Resolve recipient: accounts-payable email wins, then the invoice's stored
  // client email, then the client's primary email.
  const apEmail = (client?.ap_email as string | null) || null;
  const apCc: string[] = Array.isArray(client?.ap_cc_emails)
    ? (client!.ap_cc_emails as string[])
    : [];
  const to =
    apEmail ||
    invoice.client_email ||
    (client?.email as string | null) ||
    null;
  if (!to) {
    return NextResponse.json(
      { error: "No recipient — set an accounts-payable or client email." },
      { status: 400 },
    );
  }

  // CC = the client's invoice CC list + Pablo, deduped (case-insensitive),
  // minus the recipient so nobody is both To and Cc.
  const pablo = process.env.INVOICE_CC ?? "pablo@attomik.co";
  const ccMap = new Map<string, string>();
  for (const raw of [...apCc, pablo]) {
    const v = (raw ?? "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (key === to.toLowerCase() || ccMap.has(key)) continue;
    ccMap.set(key, v);
  }
  const cc = ccMap.size ? [...ccMap.values()] : undefined;

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

  const resend = new Resend(apiKey);
  const { data: sent, error: sendErr } = await resend.emails.send({
    from,
    to,
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
    to,
    cc: cc ?? [],
  });
}
