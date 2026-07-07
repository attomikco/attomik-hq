import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { sendInvoiceEmail } from "@/lib/email/dispatch";
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

  const brand = settings.brand_name ?? "Attomik";
  const from = process.env.INVOICE_FROM ?? `${brand} <accounts@attomik.co>`;
  const replyTo = process.env.INVOICE_REPLY_TO || undefined;

  const result = await sendInvoiceEmail({
    invoice,
    settings,
    services: (services as Service[]) ?? [],
    client,
    resend: new Resend(apiKey),
    from,
    replyTo,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code === "recipient" ? 400 : 502 },
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
    id: result.id,
    to: result.to,
    cc: result.cc,
  });
}
