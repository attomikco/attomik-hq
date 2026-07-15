-- Link an invoice back to the agreement it was generated from, so the
-- "Create first invoice" action on an agreement can be idempotent (Create vs
-- View) and the package send can find the deposit invoice.
--
-- on delete set null: deleting an agreement unlinks the invoice rather than
-- blocking the delete or cascade-removing a real invoice.
alter table public.invoices
  add column if not exists agreement_id uuid references public.agreements(id) on delete set null;

create index if not exists invoices_agreement_id_idx on public.invoices (agreement_id);
