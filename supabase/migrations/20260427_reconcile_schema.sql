-- =============================================================================
-- Reconcile committed migrations with live schema
-- =============================================================================
--
-- Live (project ilkxyudurumpvkapdhbh, snapshotted 2026-04-27) has columns on
-- `agreements` and `proposals` that no committed migration created. They were
-- almost certainly added directly via the Supabase dashboard during early
-- development. This file backfills committed history so a fresh `db push`
-- against an empty project produces a schema that matches production.
--
-- Every statement is `add column if not exists`, so this file is safe to run
-- against the live DB (it will be a no-op there) and will add the columns
-- when run against a fresh DB. NOT applied automatically — review and run
-- manually.
--
-- Out of scope here: dropping the unused legacy add-on / categorical columns
-- on proposals (p1_type, p1_second_store, p1_amazon, p1_tiktok,
-- p1_email_template, p2_bundle, p2_second_store). Those exist in production
-- but no current code reads or writes them. They can be dropped in a separate
-- cleanup migration once we've confirmed no row depends on them for display.
-- Including them here for now is the conservative choice — committed history
-- should match reality.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- agreements: add proposal_number / proposal_date
-- -----------------------------------------------------------------------------
-- Read & written by:
--   app/(app)/proposals/page.tsx        (createAgreement payload)
--   app/(app)/agreements/page.tsx       (agreementToDraft, buildPayload)
--   app/(app)/agreements/agreement-form.tsx (AgreementDraft)
--   lib/pdf/agreement-pdf.ts            (proposal_ref merge field)
--   lib/types.ts                        (Agreement type)

alter table public.agreements
  add column if not exists proposal_number text,
  add column if not exists proposal_date   date;


-- -----------------------------------------------------------------------------
-- proposals: backfill the entire post-schema.sql column set
-- -----------------------------------------------------------------------------
-- Current-era columns (read & written by lib/format.ts proposalPhase{1,2}Net,
-- proposal-form.tsx, proposal-preview.tsx, lib/pdf/proposal-pdf.ts):
--   p1_items, p2_items                  — line item arrays
--   p1_total                            — Phase 1 subtotal cache
--   p2_rate, p2_total                   — Phase 2 monthly cache
--   p1_discount_amount, p2_discount_amount — current absolute-$ discounts
--   p1_discount, p2_discount            — legacy % discounts (still computed
--                                          and written by handleSave for
--                                          backward read compatibility)

alter table public.proposals
  add column if not exists p1_items            jsonb   default '[]'::jsonb,
  add column if not exists p2_items            jsonb   default '[]'::jsonb,
  add column if not exists p1_total            numeric default 8000,
  add column if not exists p2_rate             numeric default 0,
  add column if not exists p2_total            numeric default 4000,
  add column if not exists p1_discount         numeric default 0,
  add column if not exists p2_discount         numeric default 0,
  add column if not exists p1_discount_amount  numeric default 0,
  add column if not exists p2_discount_amount  numeric default 0;

-- Legacy add-on / categorical columns (defined in production, not currently
-- read or written, kept here only to keep committed history honest):
alter table public.proposals
  add column if not exists p1_type           text    default 'new_build'::text,
  add column if not exists p1_second_store   boolean default false,
  add column if not exists p1_amazon         boolean default false,
  add column if not exists p1_tiktok         boolean default false,
  add column if not exists p1_email_template boolean default false,
  add column if not exists p2_bundle         text    default 'dtc_meta'::text,
  add column if not exists p2_second_store   boolean default false;
