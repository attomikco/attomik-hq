-- =============================================================================
-- Invoice reminder tracking
-- =============================================================================
--
-- Records when a payment reminder was last sent for an invoice and how many
-- have gone out. Powers the manual "Send reminder" action today and the
-- future auto-reminder cron (so it can space reminders and cap the count).
-- =============================================================================

alter table public.invoices
  add column if not exists last_reminder_at timestamptz;

alter table public.invoices
  add column if not exists reminder_count integer not null default 0;
