import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { sendProposalEmail } from "@/lib/email/proposal-dispatch";
import type { Proposal, SettingsMap } from "@/lib/types";

// jsPDF needs the Node runtime (Buffer, no Edge).
export const runtime = "nodejs";

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

  const { subject, body } = (await req.json().catch(() => ({}))) as {
    subject?: string;
    body?: string;
  };
  if (!subject || !body) {
    return NextResponse.json(
      { error: "Subject and body are required." },
      { status: 400 },
    );
  }

  const [{ data: proposal, error: propErr }, { data: settingsRows }] =
    await Promise.all([
      supabase
        .from("proposals")
        .select("*")
        .eq("id", params.id)
        .single<Proposal>(),
      supabase.from("settings").select("key, value"),
    ]);
  if (propErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  const to = (proposal.client_email ?? "").trim();
  if (!to) {
    return NextResponse.json(
      { error: "This proposal has no client email to send to." },
      { status: 400 },
    );
  }

  const settings: SettingsMap = {};
  for (const row of (settingsRows as { key: string; value: string }[] | null) ??
    []) {
    (settings as Record<string, string>)[row.key] = row.value;
  }

  const from = process.env.PROPOSAL_FROM ?? "Pablo Rivera <pablo@attomik.co>";

  const result = await sendProposalEmail({
    resend: new Resend(apiKey),
    from,
    to,
    replyTo: "pablo@attomik.co",
    subject,
    body,
    proposal,
    settings,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Same bookkeeping as the manual Mark-sent path: status sent, sent_at stamped
  // first-time-only, so real sends and manual marks land in identical state.
  await supabase
    .from("proposals")
    .update({
      status: "sent",
      sent_at: proposal.sent_at ?? new Date().toISOString(),
    })
    .eq("id", proposal.id);

  return NextResponse.json({ ok: true, id: result.id, to });
}
