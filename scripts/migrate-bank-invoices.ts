/**
 * Insert historical paid invoices captured from the bank statement into
 * Supabase. Idempotent — re-running will skip rows that already exist
 * (matched by client + date + amount).
 *
 * Usage:
 *   npx ts-node scripts/migrate-bank-invoices.ts
 *
 * Credentials (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY       (preferred — bypasses RLS)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   (fallback)
 */

import { config as loadEnv } from "dotenv";
import * as path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or service/anon key in .env.local",
  );
  process.exit(1);
}

// ── data: bank-statement invoices ───────────────────────────────────

type BankInvoice = {
  date: string;
  client: string;
  amount: number;
  service: string;
};

const invoices: BankInvoice[] = [
  { date: "2024-12-18", client: "Summer Water", amount: 3000, service: "DTC Management Retainer" },
  { date: "2025-01-21", client: "Summer Water", amount: 2000, service: "DTC Management Retainer" },
  { date: "2025-02-04", client: "Summer Water", amount: 2000, service: "DTC Management Retainer" },
  { date: "2025-02-24", client: "Summer Water", amount: 4000, service: "DTC Management Retainer" },
  { date: "2025-02-25", client: "Jolene Coffee", amount: 4500, service: "DTC Management Retainer" },
  { date: "2025-02-26", client: "Good Twin", amount: 5000, service: "DTC Management Retainer" },
  { date: "2025-03-19", client: "Jolene Coffee", amount: 2000, service: "Design Services" },
  { date: "2025-03-31", client: "Summer Water", amount: 5000, service: "DTC Management Retainer" },
  { date: "2025-04-10", client: "Summer Water", amount: 5000, service: "DTC Management Retainer" },
  { date: "2025-04-14", client: "Summer Water", amount: 3000, service: "DTC Management Retainer" },
  { date: "2025-04-22", client: "Jolene Coffee", amount: 3000, service: "DTC Management Retainer" },
  { date: "2025-04-29", client: "Summer Water", amount: 5000, service: "DTC Management Retainer" },
  { date: "2025-05-16", client: "Afterdream", amount: 3000, service: "DTC Management Retainer" },
  { date: "2025-05-16", client: "Jolene Coffee", amount: 3500, service: "DTC Management Retainer" },
  { date: "2025-06-02", client: "Summer Water", amount: 5000, service: "DTC Management Retainer" },
  { date: "2025-06-12", client: "Jolene Coffee", amount: 3500, service: "DTC Management Retainer" },
  { date: "2025-06-26", client: "Afterdream", amount: 3000, service: "DTC Management Retainer" },
  { date: "2025-07-11", client: "Jolene Coffee", amount: 3500, service: "DTC Management Retainer" },
  { date: "2025-07-14", client: "Afterdream", amount: 7000, service: "DTC Management Retainer" },
  { date: "2025-08-04", client: "Afterdream", amount: 10000, service: "DTC Management Retainer" },
  { date: "2025-08-04", client: "Khloud", amount: 4500, service: "DTC Management Retainer" },
  { date: "2025-08-20", client: "Jolene Coffee", amount: 1000, service: "Design Services" },
  { date: "2025-08-21", client: "Jolene Coffee", amount: 6000, service: "DTC Management Retainer" },
  { date: "2025-08-29", client: "Khloud", amount: 4500, service: "DTC Management Retainer" },
  { date: "2025-09-08", client: "Stuzzi", amount: 7500, service: "DTC Management Retainer" },
  { date: "2025-09-08", client: "Summer Water", amount: 3000, service: "DTC Management Retainer" },
  { date: "2025-09-15", client: "Afterdream", amount: 10000, service: "DTC Management Retainer" },
  { date: "2025-09-19", client: "Jolene Coffee", amount: 6000, service: "DTC Management Retainer" },
  { date: "2025-10-06", client: "Afterdream", amount: 10000, service: "DTC Management Retainer" },
  { date: "2025-10-27", client: "Jolene Coffee", amount: 6000, service: "DTC Management Retainer" },
  { date: "2025-11-12", client: "Afterdream", amount: 10000, service: "DTC Management Retainer" },
  { date: "2025-11-13", client: "Jolene Coffee", amount: 7000, service: "DTC Management Retainer" },
  { date: "2025-11-18", client: "HpO", amount: 5000, service: "DTC Management Retainer" },
  { date: "2025-12-05", client: "Afterdream", amount: 7000, service: "DTC Management Retainer" },
  { date: "2025-12-05", client: "Summer Water", amount: 5000, service: "DTC Management Retainer" },
  { date: "2025-12-16", client: "Jolene Coffee", amount: 6500, service: "DTC Management Retainer" },
  { date: "2025-12-22", client: "Stuzzi", amount: 5000, service: "DTC Management Retainer" },
];

// Clients we need to create if they're missing.
const MISSING_CLIENT_DEFAULTS: Record<string, { company: string }> = {
  Khloud: { company: "Khloud LLC" },
  Stuzzi: { company: "Casa Komos Beverages" },
  "Summer Water": { company: "Maison Thomas LLC" },
};

// ── helpers ─────────────────────────────────────────────────────────

type LineItem = {
  title?: string | null;
  description?: string | null;
  qty?: number | string | null;
  quantity?: number | string | null;
  rate?: number | string | null;
  price?: number | string | null;
};

function lineSum(items: LineItem[] | null | undefined): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((s, it) => {
    const qty = Number(it.qty ?? it.quantity ?? 1) || 0;
    const rate = Number(it.rate ?? it.price ?? 0) || 0;
    return s + qty * rate;
  }, 0);
}

function invoiceTotal(
  items: LineItem[] | null | undefined,
  discount: number | null | undefined,
): number {
  const sub = lineSum(items);
  const pct = Number(discount ?? 0) || 0;
  return Math.max(0, sub - sub * (pct / 100));
}

function nextAtm(existing: { number: string | null }[]): number {
  const re = /^#?ATM(\d+)$/i;
  let max = 0;
  for (const row of existing) {
    if (!row.number) continue;
    const m = re.exec(row.number);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// ── main ────────────────────────────────────────────────────────────

type ExistingInvoice = {
  id: string;
  number: string | null;
  date: string | null;
  client_name: string | null;
  items: LineItem[] | null;
  discount: number | null;
};

type ExistingClient = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
};

type ExistingService = {
  id: string;
  name: string | null;
  description: string | null;
  price: number | null;
};

async function ensureClient(
  sb: SupabaseClient,
  clientsCache: ExistingClient[],
  name: string,
): Promise<ExistingClient | null> {
  const match = clientsCache.find(
    (c) => (c.name ?? "").toLowerCase() === name.toLowerCase(),
  );
  if (match) return match;

  const defaults = MISSING_CLIENT_DEFAULTS[name];
  if (!defaults) {
    console.warn(
      `  ! no defaults for missing client "${name}" — inserting with name only`,
    );
  }

  const payload = {
    name,
    company: defaults?.company ?? null,
    status: "active",
    monthly_value: 0,
  };
  const { data, error } = await sb
    .from("clients")
    .insert(payload)
    .select("id, name, email, company")
    .single();
  if (error) {
    console.error(`  ✗ failed to create client "${name}":`, error.message);
    return null;
  }
  const row = data as ExistingClient;
  console.log(`  + created client "${name}" (${row.id})`);
  clientsCache.push(row);
  return row;
}

async function main() {
  const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  console.log("\n▸ Fetching existing invoices, clients, services…");

  const [{ data: invRows }, { data: clRows }, { data: svcRows }] =
    await Promise.all([
      sb
        .from("invoices")
        .select("id, number, date, client_name, items, discount"),
      sb.from("clients").select("id, name, email, company"),
      sb.from("services").select("id, name, description, price"),
    ]);

  const existingInvoices = (invRows as ExistingInvoice[] | null) ?? [];
  const clients = (clRows as ExistingClient[] | null) ?? [];
  const services = (svcRows as ExistingService[] | null) ?? [];

  console.log(
    `  ${existingInvoices.length} invoices · ${clients.length} clients · ${services.length} services`,
  );

  const serviceByName = new Map<string, ExistingService>();
  for (const s of services) {
    if (s.name) serviceByName.set(s.name.toLowerCase(), s);
  }

  // Aliases: names used in the bank-statement data → canonical service names.
  const SERVICE_ALIASES: Record<string, string> = {
    "design services": "design services retainer",
  };
  const resolveService = (name: string): ExistingService | undefined => {
    const key = name.toLowerCase();
    return (
      serviceByName.get(key) ?? serviceByName.get(SERVICE_ALIASES[key] ?? "")
    );
  };

  const requiredServices = ["DTC Management Retainer", "Design Services"];
  for (const name of requiredServices) {
    if (!resolveService(name)) {
      console.error(
        `  ✗ Missing required service "${name}" in services table — aborting.`,
      );
      process.exit(2);
    }
  }

  let counter = nextAtm(existingInvoices);
  console.log(`  next invoice number: #ATM${String(counter).padStart(3, "0")}`);

  let inserted = 0;
  let skipped = 0;

  console.log("\n▸ Importing bank-statement invoices…");
  for (const bi of invoices) {
    const client = await ensureClient(sb, clients, bi.client);
    if (!client) continue;

    const dup = existingInvoices.find(
      (row) =>
        (row.client_name ?? "").toLowerCase() === bi.client.toLowerCase() &&
        row.date === bi.date &&
        Math.round(invoiceTotal(row.items, row.discount) * 100) ===
          Math.round(bi.amount * 100),
    );
    if (dup) {
      console.log(
        `  · skip  ${dup.number ?? "(no #)"} | ${bi.client.padEnd(16)} | ${bi.date} | ${fmtMoney(bi.amount)} | already exists`,
      );
      skipped += 1;
      continue;
    }

    const svc = resolveService(bi.service);
    if (!svc) {
      console.warn(`  ! unknown service "${bi.service}" — skipping row`);
      skipped += 1;
      continue;
    }

    const number = `#ATM${String(counter).padStart(3, "0")}`;
    counter += 1;

    const payload = {
      number,
      date: bi.date,
      due: bi.date,
      status: "paid",
      client_name: client.name,
      client_email: client.email,
      client_company: client.company,
      client_address: null,
      items: [
        {
          service_id: svc.id,
          title: svc.name,
          description: svc.description ?? "",
          qty: 1,
          rate: bi.amount,
        },
      ],
      discount: 0,
      notes: "Imported from bank statement",
    };

    const { data: inserted_row, error } = await sb
      .from("invoices")
      .insert(payload)
      .select("id, number, date, client_name, items, discount")
      .single();

    if (error) {
      console.error(
        `  ✗ insert failed | ${bi.client} | ${bi.date} | ${fmtMoney(bi.amount)} :: ${error.message}`,
      );
      // Roll back the counter so we don't skip a number.
      counter -= 1;
      continue;
    }

    console.log(
      `  ✓ ${number} | ${bi.client.padEnd(16)} | ${bi.date} | ${fmtMoney(bi.amount)} | paid`,
    );
    existingInvoices.push(inserted_row as ExistingInvoice);
    inserted += 1;
  }

  console.log(
    `\n▸ Done. inserted=${inserted} · skipped=${skipped} · total=${invoices.length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
