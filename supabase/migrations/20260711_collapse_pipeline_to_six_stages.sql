-- =============================================================================
-- Collapse the pipeline to 6 stages
-- =============================================================================
--
-- Nine stages was a CRM's vocabulary, not a founder's. The pipeline tracks six
-- unambiguous states: idea -> contacted -> qualified -> proposal -> won / lost.
-- Proposal-level detail (drafted / sent / negotiating) lives on the proposals
-- table with its own lifecycle timestamps (Session 2), so the pipeline no
-- longer mirrors it in coarser resolution.
--
-- Remap: discovery -> qualified; proposal_drafted / proposal_sent /
-- negotiation -> proposal; idea / contacted / qualified / won / lost unchanged.
--
-- Order matters: drop the old CHECK first so the intermediate 'proposal' value
-- is permitted during the remap, then re-add the constraint with the 6 values.
-- Applied to the live DB as migration collapse_pipeline_to_six_stages.
-- =============================================================================

alter table public.opportunities drop constraint if exists opportunities_stage_check;

update public.opportunities set stage='qualified' where stage='discovery';
update public.opportunities set stage='proposal'
  where stage in ('proposal_drafted','proposal_sent','negotiation');

alter table public.opportunities add constraint opportunities_stage_check
  check (stage in ('idea','contacted','qualified','proposal','won','lost'));
