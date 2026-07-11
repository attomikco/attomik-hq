-- =============================================================================
-- Prospects table + opportunity referred_by (top-of-funnel, Session 1)
-- =============================================================================
--
-- Formalizes the top of the sales funnel:
--   Prospect (outbound target, no conversation yet)
--     -> Opportunity (real two-way conversation)
--
-- opportunities.source already existed and was fully populated
-- (network / referral / outbound / inbound), so this migration only adds the
-- new referred_by free-text column used when source is 'referral' ("Referred
-- by") or 'network' ("Intro by"). The add-column guards make it a no-op for
-- source on the live DB.
--
-- prospects is a new outbound target list. A prospect graduates into an
-- opportunity (source = 'outbound'), which back-links via opportunity_id.
-- Applied to the live DB as migration prospects_and_opportunity_referred_by.
-- =============================================================================

alter table public.opportunities add column if not exists source      text;
alter table public.opportunities add column if not exists referred_by text;

create table if not exists public.prospects (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  company            text not null,
  contact_name       text,
  contact_email      text,
  contact_role       text,
  channel            text check (channel in ('cold_email','cold_dm','linkedin','other')),
  status             text not null default 'not_contacted'
                       check (status in ('not_contacted','contacted','no_reply','replied','graduated','disqualified')),
  first_contacted_at timestamptz,
  last_touch_at      timestamptz,
  notes              text,
  opportunity_id     uuid references public.opportunities(id) on delete set null
);

create index if not exists prospects_status_idx     on public.prospects (status);
create index if not exists prospects_last_touch_idx on public.prospects (last_touch_at desc);

-- Keep updated_at fresh via the shared trigger function, matching other tables.
drop trigger if exists prospects_set_updated_at on public.prospects;
create trigger prospects_set_updated_at
  before update on public.prospects
  for each row execute function set_updated_at();

-- RLS matching opportunities_all_authenticated.
alter table public.prospects enable row level security;
drop policy if exists prospects_all_authenticated on public.prospects;
create policy prospects_all_authenticated on public.prospects
  for all to authenticated using (true) with check (true);
