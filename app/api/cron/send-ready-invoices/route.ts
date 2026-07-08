import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSendReadyInvoices } from "@/lib/email/cron-send-ready";
import { buildCronDigestEmail } from "@/lib/email/cron-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
  // the CRON_SECRET env var is set. Reject anything else.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email is not configured (missing RESEND_API_KEY)." },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);
  const from =
    process.env.INVOICE_FROM ?? "Attomik <accounts@attomik.co>";
  const digestTo = process.env.CRON_DIGEST_TO || "pablo@attomik.co";

  // The cron runs with no user session, so under RLS it MUST use the
  // service-role client. If the key is missing it can't read invoices — alert
  // loudly rather than silently sending nothing.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await resend.emails.send({
      from,
      to: digestTo,
      subject: "[Attomik] ⚠️ Auto-send cron can't run — missing service-role key",
      text: "The invoice auto-send cron requires SUPABASE_SERVICE_ROLE_KEY to read invoices under RLS. Set it in Vercel and redeploy; no invoices were sent this run.",
    });
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set." },
      { status: 500 },
    );
  }

  // Live only when explicitly enabled — otherwise dry-run (no client emails,
  // no status changes).
  const live = process.env.INVOICE_CRON_LIVE === "true";

  const supabase = createAdminClient();
  const replyTo = process.env.INVOICE_REPLY_TO || undefined;

  // "Today" in Attomik's business timezone, not UTC.
  const todayET = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });

  const summary = await runSendReadyInvoices({
    supabase,
    resend,
    live,
    from,
    replyTo,
    todayET,
  });

  // Email the ops digest only when there's something to report.
  const hasActivity = summary.sent.length + summary.skipped.length > 0;
  if (hasActivity) {
    const digest = buildCronDigestEmail(summary);
    await resend.emails.send({
      from,
      to: digestTo,
      subject: digest.subject,
      html: digest.html,
      text: digest.text,
    });
  }

  return NextResponse.json({
    ok: true,
    live,
    today: summary.today,
    sent: summary.sent.length,
    skipped: summary.skipped.length,
  });
}
