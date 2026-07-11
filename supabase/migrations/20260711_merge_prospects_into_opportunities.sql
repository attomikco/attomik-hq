-- =============================================================================
-- Merge prospects into opportunities (Session 1 revision)
-- =============================================================================
--
-- Reverses the prospects/opportunities split (20260710_prospects_and_source):
-- the pipeline is one lifecycle from "company I want to pitch" through won/lost,
-- so it should be one table with stages, not two entities with a graduation
-- ceremony. opportunities.referred_by (added in that migration) stays; only the
-- prospects table is torn down here.
--
-- Stage vocabulary extends at the front with 'contacted':
--   idea (company I want to pitch, not yet contacted — absorbs prospect
--   'not_contacted') -> contacted (outreach sent, no meaningful reply yet) ->
--   qualified -> discovery -> proposal_drafted -> proposal_sent -> negotiation
--   -> won -> lost.
--
-- Prospect fields channel / first_contacted_at / last_touch_at are adopted onto
-- opportunities; contact_role is dropped by design. The one live prospect
-- (Saint Spritz, not_contacted, cold_dm) migrates to stage idea, source
-- outbound. prospect 'disqualified' would map to lost, but no such row existed.
-- Applied to the live DB as migration merge_prospects_into_opportunities.
-- =============================================================================

alter table public.opportunities drop constraint if exists opportunities_stage_check;
alter table public.opportunities add  constraint opportunities_stage_check
  check (stage in ('idea','contacted','qualified','discovery',
                   'proposal_drafted','proposal_sent','negotiation','won','lost'));

alter table public.opportunities add column if not exists channel text
  check (channel in ('cold_email','cold_dm','linkedin','other'));
alter table public.opportunities add column if not exists first_contacted_at timestamptz;
alter table public.opportunities add column if not exists last_touch_at      timestamptz;

insert into public.opportunities
  (company_name, stage, source, channel, notes, first_contacted_at, last_touch_at, created_at)
select company, 'idea', 'outbound', channel, notes, first_contacted_at, last_touch_at, created_at
from public.prospects
where id = '20b10733-b9fe-40cc-82a3-549332698dcb';

-- Table drop removes the prospects policy, trigger, indexes, and FK. The shared
-- set_updated_at() function is intentionally left intact (other tables use it).
drop table if exists public.prospects cascade;
