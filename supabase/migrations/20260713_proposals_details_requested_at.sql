-- =============================================================================
-- proposals.details_requested_at (Session 4)
-- =============================================================================
-- Stamped when the post-acceptance "request company details" email is sent
-- programmatically via Resend from the proposals page. Nullable, no backfill.
-- Applied to the live DB as migration proposals_details_requested_at.
-- =============================================================================

alter table public.proposals add column if not exists details_requested_at timestamptz;
