-- =============================================================================
-- Proposal lifecycle timestamps + decline tracking (Session 2)
-- =============================================================================
--
-- Gives proposals a real lifecycle so we can see what's out, what's stale, and
-- why deals die. Win rate = accepted / sent, so sent and declined are
-- first-class states with timestamps.
--
-- proposals.status already existed (text, default 'draft') with live values
-- draft / sent / accepted / declined, so we map onto it rather than inventing a
-- parallel state machine, and lock the vocabulary with a CHECK constraint.
--
-- sent_at is seeded from created_at for the currently-sent proposal(s) so the
-- "Awaiting response" view shows a sensible age. Closed rows (accepted /
-- declined) are intentionally NOT backfilled — there is no reliable source for
-- their true close date, and they never appear in the Awaiting view.
-- Applied to the live DB as migration proposal_lifecycle_timestamps.
-- =============================================================================

alter table public.proposals add column if not exists sent_at        timestamptz;
alter table public.proposals add column if not exists accepted_at    timestamptz;
alter table public.proposals add column if not exists declined_at    timestamptz;
alter table public.proposals add column if not exists decline_reason text;

alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals add  constraint proposals_status_check
  check (status in ('draft','sent','accepted','declined'));

update public.proposals set sent_at = created_at
  where status = 'sent' and sent_at is null;
