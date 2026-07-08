-- =============================================================================
-- Invoice service period
-- =============================================================================
--
-- Optional service window shown on invoices, distinct from the issue date
-- (e.g. a retainer covering Jun 22 – Jul 22). Both nullable — invoices without
-- a defined window leave them blank and the row is omitted from the PDF.
-- =============================================================================

alter table public.invoices add column if not exists service_start_date date;
alter table public.invoices add column if not exists service_end_date date;
