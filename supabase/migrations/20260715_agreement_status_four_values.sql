-- Collapse agreement statuses to four: draft, sent, signed, ended.
-- (Live data was only sent/signed, so no rows needed remapping.) Adds the
-- end bookkeeping the "Mark ended" flow stamps — ended_date mirrors the
-- existing signed_date (plain date), end_reason is free text.
begin;

alter table public.agreements
  drop constraint if exists agreements_status_check;

alter table public.agreements
  add constraint agreements_status_check
  check (status in ('draft', 'sent', 'signed', 'ended'));

alter table public.agreements
  add column if not exists ended_date date;

alter table public.agreements
  add column if not exists end_reason text;

commit;
