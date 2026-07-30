ALTER TABLE public.bulk_order_payments
  ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;
