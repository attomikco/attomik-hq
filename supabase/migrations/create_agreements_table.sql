-- Services Agreement module

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  date date not null default current_date,
  status text not null default 'draft'
    check (status in ('draft','sent','signed','active','completed','cancelled')),
  proposal_id uuid references public.proposals(id) on delete set null,
  client_name text,
  client_email text,
  client_company text,
  client_address text,
  phase1_items jsonb default '[]'::jsonb,
  phase1_total numeric(12,2) default 0,
  phase1_timeline text,
  phase1_payment text,
  phase2_service text,
  phase2_rate numeric(12,2) default 0,
  phase2_commitment integer default 6,
  phase2_start_date date,
  kickoff_items jsonb default '[]'::jsonb,
  terms text,
  signed_date date,
  signed_by_name text,
  signed_by_title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agreements_status_idx on public.agreements(status);
create index if not exists agreements_date_idx on public.agreements(date desc);
create index if not exists agreements_proposal_id_idx on public.agreements(proposal_id);
create index if not exists agreements_client_email_idx on public.agreements(client_email);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agreements_set_updated_at on public.agreements;
create trigger agreements_set_updated_at
  before update on public.agreements
  for each row execute function public.set_updated_at();

alter table public.agreements enable row level security;

drop policy if exists "agreements_all_authenticated" on public.agreements;
create policy "agreements_all_authenticated" on public.agreements
  for all to authenticated using (true) with check (true);

insert into public.settings (key, value) values
  ('agreement_default_phase1_payment', '50% upon signing, 50% upon delivery'),
  ('agreement_default_phase2_payment', 'Invoiced monthly on the 1st, due net 15'),
  ('agreement_default_late_fee', '1.5% per month on overdue balances'),
  ('agreement_governing_law', 'State of New York, United States'),
  ('agreement_legal_entity', 'Attomik, LLC'),
  ('agreement_email_subject', 'Welcome to Attomik — Services Agreement for {client_company}'),
  ('agreement_email_body', E'Hi {client_name},\n\nExcited to make this official. Attached is the Services Agreement for {client_company} (#{agreement_number}) covering our Phase 1 build and Phase 2 ongoing partnership.\n\nQuick summary of what''s inside:\n• Scope and deliverables for both phases\n• Commercial terms (Phase 1: {phase1_total} / Phase 2: {phase2_rate}/mo)\n• What we need from you to kick off\n• Standard terms & conditions\n\nTo get started:\n1. Review the agreement (especially page 5 — what we need from you)\n2. Reply "I accept" to confirm, or sign and return\n3. We''ll send the first invoice and schedule the kickoff call\n\nAnything unclear or that you want to adjust — just hit reply. Looking forward to it.\n\nPablo')
on conflict (key) do nothing;
