-- =============================================================================
-- Client Hub — per-client detail data
-- =============================================================================
--
-- Three new tables to consolidate everything Attomik tracks for an active
-- client: who's been added to which platforms, shared logins we use as the
-- client, and links to shared resources (Drive, Notion, etc.).
--
-- Plus four new columns on `clients` for Hub-specific contact / channel /
-- freeform-notes data that doesn't fit the existing fields.
--
-- Depends on the agreements migration only because it reuses the
-- public.set_updated_at() function created there.
--
-- All three new tables get RLS enabled with the same `for all to
-- authenticated` policy used on agreements and opportunities.
--
-- Out of scope here (per Hub spec): no encryption on stored passwords; the
-- credentials table holds plaintext on purpose.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- client_platform_access
-- For platform accounts where Attomik has been added as a user (Shopify
-- collaborator, Meta admin, Klaviyo manager, etc.). One row per (client,
-- platform, login_email) granted access combination.
-- -----------------------------------------------------------------------------
create table if not exists public.client_platform_access (
  id            uuid          primary key default gen_random_uuid(),
  client_id     uuid          not null references public.clients(id) on delete cascade,
  platform      text          not null,            -- Shopify, Meta, Klaviyo, GA4, Google Ads, TikTok, Amazon, Custom
  login_email   text,                              -- the email that was given access
  access_level  text,                              -- admin / manager / staff / collaborator / custom
  status        text          not null default 'invited'
    check (status in ('invited','accepted','pending','revoked')),
  login_url     text,
  notes         text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index if not exists client_platform_access_client_id_idx
  on public.client_platform_access(client_id);
create index if not exists client_platform_access_platform_idx
  on public.client_platform_access(platform);

drop trigger if exists client_platform_access_set_updated_at
  on public.client_platform_access;
create trigger client_platform_access_set_updated_at
  before update on public.client_platform_access
  for each row execute function public.set_updated_at();

alter table public.client_platform_access enable row level security;

drop policy if exists "client_platform_access_all_authenticated"
  on public.client_platform_access;
create policy "client_platform_access_all_authenticated"
  on public.client_platform_access
  for all to authenticated using (true) with check (true);


-- -----------------------------------------------------------------------------
-- client_credentials
-- Shared logins where Attomik logs in as the client (e.g. a techsupport@
-- mailbox the client owns but shares with us). Plaintext storage; convenience
-- over secrecy was the explicit decision.
-- -----------------------------------------------------------------------------
create table if not exists public.client_credentials (
  id          uuid         primary key default gen_random_uuid(),
  client_id   uuid         not null references public.clients(id) on delete cascade,
  label       text,                               -- e.g. "Klaviyo techsupport account"
  url         text,
  username    text,
  password    text,                               -- plaintext, no encryption
  notes       text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists client_credentials_client_id_idx
  on public.client_credentials(client_id);

drop trigger if exists client_credentials_set_updated_at
  on public.client_credentials;
create trigger client_credentials_set_updated_at
  before update on public.client_credentials
  for each row execute function public.set_updated_at();

alter table public.client_credentials enable row level security;

drop policy if exists "client_credentials_all_authenticated"
  on public.client_credentials;
create policy "client_credentials_all_authenticated"
  on public.client_credentials
  for all to authenticated using (true) with check (true);


-- -----------------------------------------------------------------------------
-- client_resources
-- Links to shared materials: brand assets folders, planning docs, design
-- files. The `type` discriminator drives the icon in the UI.
-- -----------------------------------------------------------------------------
create table if not exists public.client_resources (
  id          uuid         primary key default gen_random_uuid(),
  client_id   uuid         not null references public.clients(id) on delete cascade,
  label       text,                               -- e.g. "Brand assets folder"
  url         text,
  type        text         not null default 'other'
    check (type in ('drive','notion','figma','slack','dropbox','other')),
  notes       text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index if not exists client_resources_client_id_idx
  on public.client_resources(client_id);

drop trigger if exists client_resources_set_updated_at
  on public.client_resources;
create trigger client_resources_set_updated_at
  before update on public.client_resources
  for each row execute function public.set_updated_at();

alter table public.client_resources enable row level security;

drop policy if exists "client_resources_all_authenticated"
  on public.client_resources;
create policy "client_resources_all_authenticated"
  on public.client_resources
  for all to authenticated using (true) with check (true);


-- -----------------------------------------------------------------------------
-- clients: Hub-only fields
-- These are intentionally separate from the existing `notes` column (which is
-- short-form, used in pipeline/list views) and from `email`/`emails` (which
-- are for outbound recipient resolution). `hub_notes` is freeform working
-- notes; the channel fields drive the Contacts section of the Hub.
-- -----------------------------------------------------------------------------
alter table public.clients
  add column if not exists slack_channel         text,
  add column if not exists preferred_channel     text,    -- Slack / Email / Notion / Phone / Other
  add column if not exists primary_contact_phone text,
  add column if not exists hub_notes             text;
