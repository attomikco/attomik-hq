-- NDA module: extend agreements table with a type discriminator and
-- NDA-specific fields. Existing rows backfill to type = 'services'.
-- Phase 1/2/kickoff columns stay nullable for NDA rows; nda_* columns
-- stay nullable for services rows.

alter table public.agreements
  add column if not exists type text not null default 'services'
    check (type in ('services', 'nda'));

alter table public.agreements
  add column if not exists nda_purpose text;

alter table public.agreements
  add column if not exists nda_term_years integer default 2;

create index if not exists agreements_type_idx on public.agreements(type);

-- NDA email templates so the same Gmail-compose flow can render NDA-specific
-- copy without per-call branching. Mirrors agreement_email_subject/body.
insert into public.settings (key, value) values
  ('nda_email_subject', 'Mutual NDA — Attomik & {client_company} (#{nda_number})'),
  ('nda_email_body', E'Hi {client_name},\n\nAttached is a Mutual Non-Disclosure Agreement between Attomik, LLC and {client_company} (#{nda_number}) covering our upcoming discussions.\n\nPurpose: {purpose}\n\nTo execute, either:\n1. Reply to this email with the words "I accept" to confirm, or\n2. Sign the PDF and return a copy.\n\nLet me know if anything needs adjustment.\n\nPablo')
on conflict (key) do nothing;
