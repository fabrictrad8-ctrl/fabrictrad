-- Restrict privileged marketplace functions to the minimum required roles.
-- Applied to production and retained here so Supabase deployment history stays reproducible.

REVOKE EXECUTE ON FUNCTION public.begin_marketplace_refund(text, uuid, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_marketplace_refund_request(text, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_marketplace_refund(text, uuid, numeric, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_marketplace_refund_request(text, uuid, text, text, text, text)
  TO service_role;

-- This is a trigger function and must never be directly exposed as an RPC.
REVOKE EXECUTE ON FUNCTION public.protect_bulk_order_state()
  FROM PUBLIC, anon, authenticated;

-- Tax invoices remain available only to authenticated sellers and trusted server code.
REVOKE EXECUTE ON FUNCTION public.issue_catalog_tax_invoice(uuid, boolean, text, text, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_catalog_tax_invoice(uuid, boolean, text, text, timestamptz, text)
  TO authenticated, service_role;

-- Delivery bookkeeping is server-only. RLS with no participant policies intentionally denies Data API access.
REVOKE ALL ON TABLE public.auth_email_delivery_state FROM anon, authenticated;
