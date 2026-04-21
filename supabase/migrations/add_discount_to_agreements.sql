-- Persist proposal discounts on derived agreements so they remain visible.

alter table public.agreements
  add column if not exists phase1_discount numeric(12,2) not null default 0,
  add column if not exists phase2_discount numeric(12,2) not null default 0;
