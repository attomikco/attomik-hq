-- =============================================================================
-- Client relationship reason (dual-purpose culture / churn note)
-- =============================================================================
--
-- One nullable column: status tells us how to read it — active clients get a
-- "why we love them" culture note, cancelled clients get a churn reason.
-- Backfills the 8 known cancellation reasons (matched by exact name); every
-- other client stays NULL.
-- =============================================================================

alter table public.clients add column if not exists relationship_reason text;

update public.clients set relationship_reason = 'Phase-one project only, never scoped to continue. Too early stage, no revenue, no budget. Clean handoff rather than a real loss.' where name = 'Vista Products';
update public.clients set relationship_reason = 'Positive churn. Performed so well they doubled down on ecommerce and hired a full-time in-house person who absorbed the work.' where name = 'Good Twin';
update public.clients set relationship_reason = 'THC category looking legally fragile, so they cut budget hard (possible shutdown). Work folded into the same full-time hire running Good Twin.' where name = 'Afterdream';
update public.clients set relationship_reason = 'Never performed. Very low sales, weak product, no budget. Ran out of runway mid-raise and has not raised since.' where name = 'HpO';
update public.clients set relationship_reason = 'Phase-one only, never committed to phase two. No budget for a retainer.' where name = 'Stuzzi Hot Sauce';
update public.clients set relationship_reason = 'Seasonal Amass gig, only live over the summer months. Now handled internally by their full-time hire.' where name = 'Summer Water';
update public.clients set relationship_reason = 'Never a real fit. Short engagement. Chose to keep everything with their existing agency.' where name = 'Khloud';
update public.clients set relationship_reason = 'Expected full-time attention we never scoped. Demanding team, unrealistic requests, early stage with little budget. Expected churn.' where name = 'Osia';
