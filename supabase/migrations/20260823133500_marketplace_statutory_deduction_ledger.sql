-- FabricTrad marketplace statutory deduction ledger.
--
-- This migration intentionally does NOT calculate or activate tax deductions.
-- Applicability of GST TCS / Income-tax section 194-O depends on the final
-- marketplace entity/payment structure and seller-specific facts. These fields
-- keep statutory deductions separate from commission and gateway charges so
-- settlement logic can be configured after CA/legal sign-off without rewriting
-- historical payment records.

alter table if exists public.catalog_order_payments
  add column if not exists gst_tcs_amount numeric(14,2) not null default 0,
  add column if not exists tds_194o_amount numeric(14,2) not null default 0,
  add column if not exists statutory_deduction_total numeric(14,2) not null default 0,
  add column if not exists statutory_deduction_status text not null default 'not_assessed',
  add column if not exists statutory_deduction_meta jsonb not null default '{}'::jsonb;

alter table if exists public.bulk_order_payments
  add column if not exists gst_tcs_amount numeric(14,2) not null default 0,
  add column if not exists tds_194o_amount numeric(14,2) not null default 0,
  add column if not exists statutory_deduction_total numeric(14,2) not null default 0,
  add column if not exists statutory_deduction_status text not null default 'not_assessed',
  add column if not exists statutory_deduction_meta jsonb not null default '{}'::jsonb;

alter table if exists public.taxation_splits
  add column if not exists gst_tcs_amount numeric(14,2) not null default 0,
  add column if not exists tds_194o_amount numeric(14,2) not null default 0,
  add column if not exists statutory_deduction_total numeric(14,2) not null default 0,
  add column if not exists statutory_deduction_status text not null default 'not_assessed',
  add column if not exists statutory_deduction_meta jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'catalog_order_payments_statutory_amounts_nonnegative'
  ) then
    alter table public.catalog_order_payments
      add constraint catalog_order_payments_statutory_amounts_nonnegative
      check (gst_tcs_amount >= 0 and tds_194o_amount >= 0 and statutory_deduction_total >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bulk_order_payments_statutory_amounts_nonnegative'
  ) then
    alter table public.bulk_order_payments
      add constraint bulk_order_payments_statutory_amounts_nonnegative
      check (gst_tcs_amount >= 0 and tds_194o_amount >= 0 and statutory_deduction_total >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'taxation_splits_statutory_amounts_nonnegative'
  ) then
    alter table public.taxation_splits
      add constraint taxation_splits_statutory_amounts_nonnegative
      check (gst_tcs_amount >= 0 and tds_194o_amount >= 0 and statutory_deduction_total >= 0);
  end if;
end $$;

comment on column public.catalog_order_payments.gst_tcs_amount is
  'GST section 52 TCS amount when assessed as applicable. Kept separate from platform commission.';
comment on column public.catalog_order_payments.tds_194o_amount is
  'Income-tax section 194-O TDS amount when assessed as applicable. Kept separate from platform commission.';
comment on column public.catalog_order_payments.statutory_deduction_status is
  'not_assessed, exempt, assessed, withheld, remitted or adjusted according to configured compliance workflow.';
