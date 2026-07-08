-- =============================================================================
-- Enable Row Level Security on the remaining public tables
-- =============================================================================
--
-- Fixes the Supabase advisor "rls_disabled_in_public" errors. Without RLS,
-- the public anon key (shipped in the browser bundle) grants full read/write
-- to these tables via PostgREST — a serious data exposure (client contacts,
-- invoice amounts, and the bank details in settings.payment_instructions).
--
-- Policy model matches the existing tables (agreements, opportunities,
-- client_*): all logged-in users get full access; the anon role gets nothing.
-- Server jobs that run without a session (the auto-send cron) use the
-- service-role key, which bypasses RLS.
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array['clients','invoices','pipeline_contacts','proposals','services','settings']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_all_authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_all_authenticated', t
    );
  end loop;
end $$;
