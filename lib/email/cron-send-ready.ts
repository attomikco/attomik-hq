import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { invoiceTotal } from "@/lib/format";
import { resolveInvoiceRecipients } from "@/lib/email/recipients";
import { sendInvoiceEmail } from "@/lib/email/dispatch";
import type { Invoice, Service, SettingsMap } from "@/lib/types";

export type CronSentItem = {
  number: string | null;
  client: string | null;
  amount: number;
  to: string;
  cc: string[];
  id: string | null;
};
export type CronSkippedItem = {
  number: string | null;
  client: string | null;
  amount: number;
  reason: string;
};
export type CronStraggler = {
  number: string | null;
  client: string | null;
  date: string | null;
  amount: number;
};
export type CronRunSummary = {
  today: string;
  live: boolean;
  currency: string;
  sent: CronSentItem[];
  skipped: CronSkippedItem[];
  stragglers: CronStraggler[];
};

/**
 * Send every `ready` invoice whose issue date is today (ET). Flips each sent
 * invoice to `sent`. In dry-run mode it resolves recipients and reports what
 * WOULD go out, but sends nothing and changes nothing.
 *
 * Also reports "stragglers": ready invoices whose issue date already passed
 * (these are NOT sent — issue-date-exact matching — so they're surfaced so
 * they can't silently rot).
 */
export async function runSendReadyInvoices(opts: {
  supabase: SupabaseClient;
  resend: Resend;
  live: boolean;
  from: string;
  replyTo?: string;
  todayET: string;
}): Promise<CronRunSummary> {
  const { supabase, resend, live, from, replyTo, todayET } = opts;

  const [{ data: settingsRows }, { data: services }, { data: readyToday }, { data: stragglerRows }] =
    await Promise.all([
      supabase.from("settings").select("key, value"),
      supabase.from("services").select("id, name, description, desc, price"),
      supabase.from("invoices").select("*").eq("status", "ready").eq("date", todayET),
      supabase
        .from("invoices")
        .select("number, client_name, date, items, discount")
        .eq("status", "ready")
        .lt("date", todayET),
    ]);

  const settings: SettingsMap = {};
  for (const row of (settingsRows as { key: string; value: string }[] | null) ?? []) {
    (settings as Record<string, string>)[row.key] = row.value;
  }
  const code = settings.currency ?? "USD";
  const svc = (services as Service[] | null) ?? [];

  const sent: CronSentItem[] = [];
  const skipped: CronSkippedItem[] = [];

  for (const inv of (readyToday as Invoice[] | null) ?? []) {
    const amount = invoiceTotal(inv.items, inv.discount);

    let client: {
      ap_email?: string | null;
      ap_cc_emails?: string[] | null;
      email?: string | null;
    } | null = null;
    if (inv.client_id) {
      const { data } = await supabase
        .from("clients")
        .select("ap_email, ap_cc_emails, email")
        .eq("id", inv.client_id)
        .maybeSingle();
      client = data;
    }

    // Validate the recipient up front (works for both dry-run and live).
    const recipients = resolveInvoiceRecipients({
      apEmail: client?.ap_email ?? null,
      apCc: client?.ap_cc_emails ?? null,
      invoiceClientEmail: inv.client_email,
      clientEmail: client?.email ?? null,
    });
    if (!recipients.ok) {
      skipped.push({ number: inv.number, client: inv.client_name, amount, reason: recipients.error });
      continue;
    }

    if (!live) {
      sent.push({
        number: inv.number,
        client: inv.client_name,
        amount,
        to: recipients.to,
        cc: recipients.cc ?? [],
        id: null,
      });
      continue;
    }

    const result = await sendInvoiceEmail({
      invoice: inv,
      settings,
      services: svc,
      client,
      resend,
      from,
      replyTo,
    });
    if (!result.ok) {
      skipped.push({ number: inv.number, client: inv.client_name, amount, reason: result.error });
      continue;
    }

    // Only after a confirmed send do we flip status — the guard against
    // ever re-sending the same invoice.
    const { error: updErr } = await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", inv.id);
    if (updErr) {
      // Sent but couldn't flag it — surface loudly so it isn't re-sent blindly.
      skipped.push({
        number: inv.number,
        client: inv.client_name,
        amount,
        reason: `SENT but status update failed (${updErr.message}) — set to 'sent' manually to avoid a resend.`,
      });
      continue;
    }

    sent.push({
      number: inv.number,
      client: inv.client_name,
      amount,
      to: result.to,
      cc: result.cc,
      id: result.id,
    });
  }

  const stragglers: CronStraggler[] = (
    (stragglerRows as
      | { number: string | null; client_name: string | null; date: string | null; items: Invoice["items"]; discount: number | null }[]
      | null) ?? []
  ).map((s) => ({
    number: s.number,
    client: s.client_name,
    date: s.date,
    amount: invoiceTotal(s.items, s.discount),
  }));

  return { today: todayET, live, currency: code, sent, skipped, stragglers };
}
