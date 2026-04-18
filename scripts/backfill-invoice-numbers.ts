/**
 * Backfill invoice numbers for any row whose `number` field doesn't match
 * the canonical `#ATM###` format. Preserves existing valid numbers, assigns
 * the next sequential number to the offenders in date order.
 *
 * Usage:
 *   npx ts-node scripts/backfill-invoice-numbers.ts          # dry-run
 *   npx ts-node scripts/backfill-invoice-numbers.ts --apply  # write to DB
 */

import { config as loadEnv } from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const APPLY = process.argv.slice(2).includes("--apply");

type Invoice = {
  id: string;
  number: string | null;
  date: string | null;
  created_at: string | null;
};

const VALID_NUMBER = /^#?ATM(\d+)$/i;

function formatNumber(n: number): string {
  return `#ATM${String(n).padStart(3, "0")}`;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
    process.exit(1);
  }

  console.log("Attomik HQ · Invoice number backfill");
  console.log(`  target: ${SUPABASE_URL}`);
  console.log(
    `  auth:   ${
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "service_role"
        : "anon (RLS must be disabled)"
    }`,
  );
  console.log(`  mode:   ${APPLY ? "APPLY (writes to DB)" : "DRY RUN (no writes)"}`);

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch all invoices ordered by date asc, then created_at asc
  const { data, error } = await sb
    .from("invoices")
    .select("id, number, date, created_at")
    .order("date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`\n✗ fetch failed: ${error.message}`);
    process.exit(1);
  }

  const invoices = (data as Invoice[] | null) ?? [];
  console.log(`\nFetched ${invoices.length} invoice(s)`);

  // Establish the current max ATM number from rows that already match
  let maxN = 0;
  for (const inv of invoices) {
    if (!inv.number) continue;
    const m = VALID_NUMBER.exec(inv.number);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  console.log(`Current max ATM number: ${maxN}\n`);

  // Collect invoices that need renumbering (date-asc order already applied)
  const toRenumber = invoices.filter(
    (inv) => !inv.number || !VALID_NUMBER.test(inv.number),
  );
  console.log(`${toRenumber.length} invoice(s) need a new number\n`);

  if (toRenumber.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  const updates: { id: string; oldNumber: string | null; newNumber: string }[] = [];
  let next = maxN;
  for (const inv of toRenumber) {
    next += 1;
    updates.push({
      id: inv.id,
      oldNumber: inv.number,
      newNumber: formatNumber(next),
    });
  }

  // Preview
  console.log("Planned updates:");
  for (const u of updates) {
    const old = u.oldNumber ?? "(null)";
    console.log(`  ${old.padEnd(28)} → ${u.newNumber}`);
  }

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write changes.");
    process.exit(0);
  }

  // Apply
  console.log("\nApplying updates…");
  let ok = 0;
  let fail = 0;
  for (const u of updates) {
    const { error: upErr } = await sb
      .from("invoices")
      .update({ number: u.newNumber })
      .eq("id", u.id);
    if (upErr) {
      console.error(`  ✗ ${u.id}: ${upErr.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${u.oldNumber ?? "(null)"} → ${u.newNumber}`);
      ok++;
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\nFATAL:", e);
  process.exit(1);
});
