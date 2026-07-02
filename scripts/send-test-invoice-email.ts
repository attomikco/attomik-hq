/**
 * Sends ONE test invoice email through Resend to verify the full pipeline
 * (API key, verified domain, PDF attachment, and the email template).
 *
 * Sends to pablo@attomik.co only — never a real client. Sample data.
 *
 * Usage:
 *   npx tsx scripts/send-test-invoice-email.ts
 *   npx tsx scripts/send-test-invoice-email.ts you@example.com   # override recipient
 *
 * Requires RESEND_API_KEY in .env.local (INVOICE_FROM optional).
 */
import { config as loadEnv } from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { renderInvoicePDF } from "../lib/pdf/invoice-pdf";
import { buildInvoiceEmail } from "../lib/email/invoice-email";
import { invoiceLogoAttachment } from "../lib/email/logo";

loadEnv({ path: ".env.local" });

const to = process.argv[2] || "pablo@attomik.co";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error(
    "✗ RESEND_API_KEY is not set in .env.local — add it and re-run.",
  );
  process.exit(1);
}

// Pull the real company details from Settings so the test matches production.
async function loadSettings(): Promise<Record<string, string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return {};
  const supabase = createClient(url, anon);
  const { data } = await supabase.from("settings").select("key, value");
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.key] = row.value;
  return map;
}

const inv = {
  number: "TEST-0001",
  date: "2026-07-02",
  due: "2026-07-17",
  status: "ready",
  client_name: "Test Client",
  client_email: to,
  client_company: "Test Co.",
  client_address: "123 Test St\nMiami, FL",
  items: [
    { title: "Full-Scale Ecom Growth Bundle", qty: 1, rate: 4500 },
    { title: "Klaviyo flow buildout", qty: 1, rate: 1200 },
  ],
  discount: 0,
  notes: "This is a test invoice — please disregard.",
};

async function main() {
  const settings = await loadSettings();
  console.log(
    `  using live Settings — legal_name: ${settings.legal_name ?? "(unset)"}`,
  );
  const { bytes, filename } = renderInvoicePDF(inv as any, settings as any, []);
  const { subject, html, text } = buildInvoiceEmail(inv as any, settings as any);

  const from = process.env.INVOICE_FROM ?? "Attomik Accounts <accounts@attomik.co>";
  const resend = new Resend(apiKey);

  console.log(`Sending test invoice email…`);
  console.log(`  from: ${from}`);
  console.log(`  to:   ${to}`);
  console.log(`  subj: [TEST] ${subject}`);
  console.log(`  pdf:  ${filename} (${bytes.length} bytes)`);

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: `[TEST] ${subject}`,
    html,
    text,
    attachments: [{ filename, content: bytes }, invoiceLogoAttachment],
  });

  if (error) {
    console.error("✗ Resend error:", error);
    process.exit(1);
  }
  console.log(`✓ Sent. Resend id: ${data?.id ?? "(none)"}`);
}

main().catch((e) => {
  console.error("✗ Failed:", e);
  process.exit(1);
});
