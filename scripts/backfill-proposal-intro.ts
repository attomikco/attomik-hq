/**
 * Backfill the Phase 2 callout ("intro") on proposals whose stored text
 * still matches the pre-ATMSA009-revision default verbatim. Only touches
 * rows that match the OLD default exactly — proposals with a custom or
 * already-updated intro are left untouched.
 *
 * Usage:
 *   npx tsx scripts/backfill-proposal-intro.ts          # dry-run
 *   npx tsx scripts/backfill-proposal-intro.ts --apply   # write to DB
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

const OLD_INTRO =
  "Built in two phases. You only commit to Phase 1 — Phase 2 starts after launch and runs month-by-month with no commitment, so you can cancel after Phase 1 or stop anytime once it's running.";

const NEW_INTRO =
  "Built in two phases. You only commit to Phase 1. Phase 2 starts after launch and runs month-by-month, so you can stop after Phase 1 or give 30 days notice once it's running.";

type ProposalRow = {
  id: string;
  number: string | null;
  status: string | null;
  intro: string | null;
};

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
    process.exit(1);
  }

  console.log("Attomik HQ · Proposal intro (Phase 2 callout) backfill");
  console.log(`  target: ${SUPABASE_URL}`);
  console.log(
    `  auth:   ${
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "service_role"
        : "anon (RLS must permit this read/write)"
    }`,
  );
  console.log(`  mode:   ${APPLY ? "APPLY (writes to DB)" : "DRY RUN (no writes)"}`);

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb
    .from("proposals")
    .select("id, number, status, intro")
    .eq("intro", OLD_INTRO);

  if (error) {
    console.error(`\n✗ fetch failed: ${error.message}`);
    process.exit(1);
  }

  const rows = (data as ProposalRow[] | null) ?? [];
  console.log(`\n${rows.length} proposal(s) have the old intro verbatim:`);
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    const s = r.status ?? "null";
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    console.log(`  ${(r.number ?? r.id).padEnd(12)} status=${r.status ?? "(none)"}`);
  }
  console.log("\nBy status:", byStatus);

  if (rows.length === 0) {
    console.log("\nNothing to do.");
    process.exit(0);
  }

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write changes.");
    process.exit(0);
  }

  console.log("\nApplying updates…");
  let ok = 0;
  let fail = 0;
  for (const r of rows) {
    const { error: upErr } = await sb
      .from("proposals")
      .update({ intro: NEW_INTRO })
      .eq("id", r.id);
    if (upErr) {
      console.error(`  ✗ ${r.number ?? r.id}: ${upErr.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${r.number ?? r.id}`);
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
