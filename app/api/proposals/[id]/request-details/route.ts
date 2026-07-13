import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { sendDetailsRequestEmail } from "@/lib/email/proposal-dispatch";
import type { Proposal } from "@/lib/types";

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

  // Load the proposal (existence check + fallback recipient).
  const { data: proposal, error: propErr } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", params.id)
    .single<Proposal>();
  if (propErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  // Recipient comes from the (editable) To field, falling back to the
  // proposal's contact.
  const to = ((toRaw ?? "").trim() || (proposal.client_email ?? "").trim());
  if (!to) {
    return NextResponse.json(
      { error: "Enter a recipient email address." },
      { status: 400 },
    );
  }

  const from = process.env.DETAILS_FROM ?? "Pablo Rivera <pablo@attomik.co>";

  const result = await sendDetailsRequestEmail({
    resend: new Resend(apiKey),
    from,
    to,
    cc: ["accounts@attomik.co"],
    replyTo: "pablo@attomik.co",
    subject,
    body,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Bookkeeping: stamp when the request went out.
  await supabase
    .from("proposals")
    .update({ details_requested_at: new Date().toISOString() })
    .eq("id", proposal.id);

  return NextResponse.json({ ok: true, id: result.id, to });
}
