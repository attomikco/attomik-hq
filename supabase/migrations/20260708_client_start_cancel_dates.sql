-- =============================================================================
-- Client start / cancel dates (for tenure + churn analysis)
-- =============================================================================
--
-- Adds real engagement dates to clients, backfilled from invoice history:
--   started_at   = the client's first invoice date
--   cancelled_at = the last invoice date, for churned (status='cancelled')
--                  clients only
--
-- Both are inferred proxies and hand-editable going forward. (Previously the
-- only date was created_at, which is the migration timestamp — useless for
-- tenure/churn math.)
-- =============================================================================

alter table public.clients add column if not exists started_at date;
alter table public.clients add column if not exists cancelled_at date;

update public.clients c
set started_at = agg.first_inv
from (
  select client_id, min(date) as first_inv
  from public.invoices where client_id is not null group by client_id
) agg
where agg.client_id = c.id and c.started_at is null;

update public.clients c
set cancelled_at = agg.last_inv
from (
  select client_id, max(date) as last_inv
  from public.invoices where client_id is not null group by client_id
) agg
where agg.client_id = c.id and c.status = 'cancelled' and c.cancelled_at is null;
