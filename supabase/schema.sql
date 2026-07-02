-- Attomik HQ schema

create table invoices (
  id uuid primary key default gen_random_uuid(),
  number text,
  date date,
  due date,
  status text default 'draft',
  client_name text,
  client_email text,
  client_company text,
  client_address text,
  items jsonb default '[]',
  discount numeric default 0,
  notes text,
  created_at timestamptz default now(),
  last_reminder_at timestamptz,
  reminder_count integer not null default 0
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  emails jsonb default '[]',
  ap_email text,
  ap_cc_emails jsonb default '[]',
  company text,
  address text,
  payment_terms text,
  status text default 'active',
  monthly_value numeric default 0,
  growth_stage text,
  notes text,
  created_at timestamptz default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  price numeric default 0,
  created_at timestamptz default now()
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  number text,
  date date,
  valid_until date,
  status text default 'draft',
  client_name text,
  client_email text,
  client_company text,
  intro text,
  items jsonb default '[]',
  discount numeric default 0,
  notes text,
  phase1_title text,
  phase1_price text,
  phase1_compare text,
  phase1_note text,
  phase1_timeline text,
  phase1_payment text,
  phase2_title text,
  phase2_monthly text,
  phase2_compare text,
  phase2_note text,
  phase2_commitment text,
  created_at timestamptz default now()
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  key text unique,
  value text
);

create table pipeline_contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  company text,
  email text,
  status text default 'idea',
  stage text,
  notes text,
  monthly_value numeric default 0,
  last_contact date,
  created_at timestamptz default now()
);
