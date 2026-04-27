-- =============================================================================
-- Opportunities — replace pipeline_contacts with a proper opportunity-driven
-- funnel and link the proposal/agreement/client chain back to the originating
-- opportunity.
-- =============================================================================
--
-- Depends on 20260427_reconcile_schema.sql (specifically that public.proposals
-- exists with all current-era columns). Apply this migration after that one.
--
-- This migration is additive only:
--   - creates `opportunities`
--   - adds `opportunity_id` to proposals
--   - adds `opportunity_id` and `proposal_id` to clients
--   - copies pipeline_contacts → opportunities
--
-- It does NOT drop pipeline_contacts. After verifying the migrated rows look
-- correct in /pipeline, run a one-line follow-up: `drop table public.pipeline_contacts;`
-- =============================================================================


-- -----------------------------------------------------------------------------
-- opportunities
-- -----------------------------------------------------------------------------
create table if not exists public.opportunities (
  id                uuid          primary key default gen_random_uuid(),
  company_name      text,
  contact_name      text,
  contact_email     text,
  stage             text          not null default 'idea'
    check (stage in (
      'idea','qualified','discovery',
      'proposal_drafted','proposal_sent','negotiation',
      'won','lost'
    )),
  source            text,                       -- referral / inbound / outbound / network / other
  estimated_value   numeric(12,2) default 0,    -- Phase 1 + first 6 months of Phase 2 (rough)
  estimated_phase   text,                       -- phase1_only / phase1_phase2 / phase2_only
  next_action       text,
  next_action_date  date,
  notes             text,
  won_at            timestamptz,
  lost_at           timestamptz,
  lost_reason       text,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index if not exists opportunities_stage_idx
  on public.opportunities(stage);
create index if not exists opportunities_next_action_date_idx
  on public.opportunities(next_action_date);
create index if not exists opportunities_created_at_idx
  on public.opportunities(created_at desc);

-- Reuse the trigger function created by create_agreements_table.sql
drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at
  before update on public.opportunities
  for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;

drop policy if exists "opportunities_all_authenticated" on public.opportunities;
create policy "opportunities_all_authenticated" on public.opportunities
  for all to authenticated using (true) with check (true);


-- -----------------------------------------------------------------------------
-- proposals.opportunity_id  →  opportunities.id  (set null on delete)
-- -----------------------------------------------------------------------------
alter table public.proposals
  add column if not exists opportunity_id uuid
    references public.opportunities(id) on delete set null;

create index if not exists proposals_opportunity_id_idx
  on public.proposals(opportunity_id);


-- -----------------------------------------------------------------------------
-- clients: trace the live retainer back to its originating opportunity + proposal
-- -----------------------------------------------------------------------------
alter table public.clients
  add column if not exists opportunity_id uuid
    references public.opportunities(id) on delete set null,
  add column if not exists proposal_id uuid
    references public.proposals(id) on delete set null;

create index if not exists clients_opportunity_id_idx
  on public.clients(opportunity_id);
create index if not exists clients_proposal_id_idx
  on public.clients(proposal_id);


-- -----------------------------------------------------------------------------
-- Migrate pipeline_contacts → opportunities
-- -----------------------------------------------------------------------------
-- Mapping:
--   id                 → id                    (preserved so any external links survive)
--   company            → company_name
--   name               → contact_name
--   email              → contact_email
--   monthly_value      → estimated_value       (treated as full estimate, not just monthly)
--   last_contact       → next_action_date      (only if in the future, else null)
--   notes              → notes
--   created_at         → created_at            (preserved)
--   status →
--     'idea'      → 'idea'
--     'warm'      → 'qualified'
--     'contacted' → 'discovery'
--     'no_reply'  → 'qualified'  (with note appended explaining the prior status)
--     anything else → 'idea'
-- pipeline_contacts.stage (the legacy "in_conversation" / "outreach" / etc.) is
-- ignored — the new `stage` column is sourced from the legacy `status` field
-- because that's what the prior UI used to drive the funnel.
--
-- `on conflict (id) do nothing` so this section is rerunnable without harm.
insert into public.opportunities (
  id, company_name, contact_name, contact_email,
  stage, estimated_value, next_action_date, notes, created_at
)
select
  pc.id,
  pc.company,
  pc.name,
  pc.email,
  case pc.status
    when 'idea'      then 'idea'
    when 'warm'      then 'qualified'
    when 'contacted' then 'discovery'
    when 'no_reply'  then 'qualified'
    else 'idea'
  end,
  coalesce(pc.monthly_value, 0),
  case
    when pc.last_contact is not null and pc.last_contact > current_date
      then pc.last_contact
    else null
  end,
  case
    when pc.status = 'no_reply' then
      coalesce(pc.notes || E'\n\n', '') ||
      '[Migrated from pipeline_contacts; previously marked no_reply]'
    else pc.notes
  end,
  coalesce(pc.created_at, now())
from public.pipeline_contacts pc
on conflict (id) do nothing;

-- pipeline_contacts is intentionally NOT dropped here. Verify the migrated rows
-- look right in /pipeline, then run:
--   drop table public.pipeline_contacts;
