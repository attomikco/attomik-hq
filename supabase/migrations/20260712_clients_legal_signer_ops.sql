-- =============================================================================
-- Client legal fields collected at proposal acceptance (Session 3)
-- =============================================================================
--
-- Clients are created at proposal acceptance, when we collect the real legal
-- data the proposal never had. Legal entity name -> company, registered
-- address -> address, and billing contact -> ap_email already have homes; the
-- three below did not:
--   signer_name / signer_title  the person who signs the agreement
--   ops_email                   shared operational address (e.g. hello@brand)
-- Deliberately a dedicated column, NOT the emails array, so it stays distinct
-- from the primary contact and queryable. All nullable, no backfill.
-- Applied to the live DB as migration clients_legal_signer_ops_email.
-- =============================================================================

alter table public.clients add column if not exists signer_name  text;
alter table public.clients add column if not exists signer_title text;
alter table public.clients add column if not exists ops_email    text;
