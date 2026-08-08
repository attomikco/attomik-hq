-- =============================================================================
-- Country-aware invoicing: client country + Mexican fiscal fields
-- =============================================================================
--
-- Most clients are US-based, so `country` defaults to 'US' and every existing
-- row is backfilled to 'US' by the default itself (Postgres 11+ stores the
-- default in the catalog, no table rewrite). 16 rows at time of writing.
--
-- The four fiscal columns are only populated when country = 'MX'. They exist
-- because a comprobante issued by a foreign resident must carry the paying
-- entity's fiscal identity for the expense to be deductible in Mexico:
--   legal_name       the entity that pays and deducts. NOT always the same as
--                    the relationship name in `name` (e.g. name "Reset
--                    Wellness", legal_name "Abastecedora de Productos
--                    Naturales, S.A. de C.V."). The invoice BILL TO uses
--                    legal_name when present and falls back to name.
--   rfc              Registro Federal de Contribuyentes (tax ID)
--   fiscal_address   registered fiscal address, may differ from `address`
--   billing_contact  name and email of the AP contact on the fiscal side
-- All four nullable, no backfill.
--
-- The invoice template reads these by joining on invoices.client_id at render
-- time rather than snapshotting them onto the invoice row, so fiscal data is
-- always current. Follows the direction of travel noted in 20260428_client_fk.
-- =============================================================================

alter table public.clients
  add column if not exists country text not null default 'US';

alter table public.clients add column if not exists legal_name      text;
alter table public.clients add column if not exists rfc             text;
alter table public.clients add column if not exists fiscal_address  text;
alter table public.clients add column if not exists billing_contact text;

-- Belt and braces: assert the backfill landed before adding the constraint.
update public.clients set country = 'US' where country is null;

-- Matches the check-constraint precedent set by agreements.status. Adding a
-- third country later is a one-line migration.
alter table public.clients
  drop constraint if exists clients_country_check;
alter table public.clients
  add constraint clients_country_check check (country in ('US', 'MX'));

-- =============================================================================
-- Issuer constants (company-wide, not per-client)
-- =============================================================================
--
-- Attomik's EIN and place of issuance are identical on every invoice, so they
-- belong with the rest of the issuer info in the key/value settings table
-- alongside legal_name, address and payment_instructions. No DDL needed.
-- =============================================================================

insert into public.settings (key, value) values
  ('issuer_ein',        '32-0575976'),
  ('place_of_issuance', 'New York, NY, USA')
on conflict (key) do update set value = excluded.value;
