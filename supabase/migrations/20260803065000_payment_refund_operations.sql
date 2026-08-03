-- Track refund requests separately from final signed webhook reconciliation.

DO $$
DECLARE payment_table text;
BEGIN
  FOREACH payment_table IN ARRAY ARRAY['catalog_order_payments','bulk_order_payments'] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS refund_requested_amount numeric(12,2) NOT NULL DEFAULT 0',
      payment_table
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT ''none''',
      payment_table
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS last_refund_request_id text',
      payment_table
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS refund_reason text',
      payment_table
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      payment_table,
      payment_table || '_refund_status_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (refund_status IN (''none'',''requested'',''processed'',''failed''))',
      payment_table,
      payment_table || '_refund_status_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      payment_table,
      payment_table || '_refund_requested_amount_check'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (refund_requested_amount >= 0 AND refund_requested_amount <= amount)',
      payment_table,
      payment_table || '_refund_requested_amount_check'
    );
  END LOOP;
END $$;
