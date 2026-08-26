-- Razorpay payment.captured reconciliation upserts taxation_splits by transaction_id.
-- PostgreSQL requires a matching UNIQUE/EXCLUSION constraint for ON CONFLICT.
-- Production was missing that constraint, causing captured webhooks to fail after
-- the payment/order rows had already been updated successfully.

alter table public.taxation_splits
  add constraint taxation_splits_transaction_id_key unique (transaction_id);
