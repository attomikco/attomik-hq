-- =============================================================================
-- Client accounts-payable billing fields
-- =============================================================================
--
-- Adds a dedicated invoicing contact to clients so invoice emails can be
-- addressed to an accounts-payable inbox with explicit CC recipients,
-- independent of the client's general contact emails.
--
--   ap_email      — the To: address for invoices (accounts payable)
--   ap_cc_emails  — explicit CC list for invoices
--
-- Both are optional; the invoice sender falls back to the invoice's stored
-- client_email when ap_email is empty.
-- =============================================================================

alter table public.clients
  add column if not exists ap_email text;

alter table public.clients
  add column if not exists ap_cc_emails jsonb default '[]';
