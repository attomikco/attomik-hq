import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { renderAgreementPDF } from "@/lib/pdf/agreement-pdf";
import { renderInvoicePDF } from "@/lib/pdf/invoice-pdf";
import { renderProposalPDF } from "@/lib/pdf/proposal-pdf";
import type {
  Agreement,
  Invoice,
  Proposal,
  Service,
  SettingsMap,
} from "@/lib/types";

// jsPDF needs the Node runtime (Buffer, no Edge).
export const runtime = "nodejs";

// Minimal, safe plain-text -> HTML for the cover email body.
function bodyToHtml(body: string): string {
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/\n/g, "<br>");
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();

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

  const {
    to: toRaw,
    subject,
    body,
  } = (await req.json().catch(() => ({}))) as {
    to?: string;
    subject?: string;
    body?: string;
  };
  if (!subject || !body) {
    return NextResponse.json(
      { error: "Subject and body are required." },
      { status: 400 },
    );
  }

  // Load the agreement + settings + services server-side (single source of
  // truth). The agreement is the anchor for the whole package.
  const [{ data: agreement, error: agErr }, { data: settingsRows }, { data: services }] =
    await Promise.all([
      supabase
        .from("agreements")
        .select("*")
        .eq("id", params.id)
        .single<Agreement>(),
      supabase.from("settings").select("key, value"),
      supabase.from("services").select("id, name, description, desc, price"),
    ]);
  if (agErr || !agreement) {
    return NextResponse.json({ error: "Agreement not found" }, { status: 404 });
  }

  // The deposit invoice is required — the send-package action is only offered
  // once an invoice is linked, but guard here too. Take the earliest linked one.
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("agreement_id", agreement.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Invoice>();
  if (invErr || !invoice) {
    return NextResponse.json(
      { error: "No invoice is linked to this agreement yet." },
      { status: 400 },
    );
  }

  // The accepted proposal is attached for reference when one is linked.
  const { data: proposal } = agreement.proposal_id
    ? await supabase
        .from("proposals")
        .select("*")
        .eq("id", agreement.proposal_id)
        .maybeSingle<Proposal>()
    : { data: null };

  const to = (toRaw ?? "").trim() || (agreement.client_email ?? "").trim();
  if (!to) {
    return NextResponse.json(
      { error: "Enter a recipient email address." },
      { status: 400 },
    );
  }

  const settings: SettingsMap = {};
  for (const row of (settingsRows as { key: string; value: string }[] | null) ??
    []) {
    (settings as Record<string, string>)[row.key] = row.value;
  }

  // Render all three PDFs server-side.
  const agreementPdf = renderAgreementPDF(agreement, settings);
  const invoicePdf = renderInvoicePDF(
    invoice,
    settings,
    (services as Service[]) ?? [],
  );
  const attachments: { filename: string; content: Buffer }[] = [
    { filename: agreementPdf.filename, content: agreementPdf.bytes },
    { filename: invoicePdf.filename, content: invoicePdf.bytes },
  ];
  if (proposal) {
    const proposalPdf = renderProposalPDF(proposal, settings);
    // Proposal goes after the agreement, before the invoice, when present.
    attachments.splice(1, 0, {
      filename: proposalPdf.filename,
      content: proposalPdf.bytes,
    });
  }

  // From accounts@ by default (reply_to pablo@). If someone overrides
  // PACKAGE_FROM to pablo@, CC accounts@ instead so billing still sees it.
  const from = process.env.PACKAGE_FROM ?? "Attomik <accounts@attomik.co>";
  const fromIsPablo = /pablo@/i.test(from);
  const cc = fromIsPablo ? ["accounts@attomik.co"] : undefined;
  const replyTo = fromIsPablo ? undefined : "pablo@attomik.co";

  const { data, error } = await new Resend(apiKey).emails.send({
    from,
    to,
    cc,
    replyTo,
    subject,
    text: body,
    html: bodyToHtml(body),
    attachments,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to send email." },
      { status: 502 },
    );
  }

  // Bookkeeping ONLY on success, and FORWARD-ONLY — a re-send must never
  // downgrade status. Agreement: draft -> sent; a sent/signed agreement stays
  // as-is. Invoice: only draft/ready -> sent; sent/overdue/paid are left alone
  // (a paid invoice must never regress). If either update fails the email
  // already went, so we still report success.
  if (agreement.status === "draft") {
    await supabase
      .from("agreements")
      .update({ status: "sent" })
      .eq("id", agreement.id);
  }
  if (invoice.status === "draft" || invoice.status === "ready") {
    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoice.id);
  }

  return NextResponse.json({
    ok: true,
    id: data?.id ?? null,
    to,
    attachments: attachments.map((a) => a.filename),
  });
}
