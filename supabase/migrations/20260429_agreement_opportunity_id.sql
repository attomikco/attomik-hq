-- =============================================================================
-- Agreements: trace back to the originating opportunity
-- =============================================================================
--
-- Depends on 20260428_opportunities.sql (specifically, public.opportunities).
--
-- Phase 3 of the Pipeline rebuild propagates opportunity_id through the chain:
--   opportunity → proposal → agreement → client
--
-- Phase 2 already added opportunity_id to proposals and clients. This migration
-- closes the loop on agreements so /agreements/page.tsx::markSigned can find
-- the linked opportunity directly (without joining through proposals).
-- =============================================================================

alter table public.agreements
  add column if not exists opportunity_id uuid
    references public.opportunities(id) on delete set null;

create index if not exists agreements_opportunity_id_idx
  on public.agreements(opportunity_id);
