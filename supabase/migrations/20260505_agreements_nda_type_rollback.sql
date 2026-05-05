-- Rollback for the NDA module. Removes the type discriminator, NDA-specific
-- columns, the type index, and NDA email template settings rows. Existing
-- rows with type = 'nda' are deleted before the column is dropped, since
-- NDAs no longer have a database representation (they are one-click PDFs).
-- Idempotent: safe to run regardless of how far the forward migration
-- 20260505_agreements_nda_type.sql progressed.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agreements'
      and column_name = 'type'
  ) then
    delete from public.agreements where type = 'nda';
  end if;
end $$;

alter table public.agreements
  drop constraint if exists agreements_type_check;

drop index if exists public.agreements_type_idx;

alter table public.agreements
  drop column if exists type;

alter table public.agreements
  drop column if exists nda_purpose;

alter table public.agreements
  drop column if exists nda_term_years;

delete from public.settings
  where key in ('nda_email_subject', 'nda_email_body');
