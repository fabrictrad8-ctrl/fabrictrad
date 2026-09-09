-- Reconstructed from the applied live migration 20260909052859_drop_stale_submit_catalog_order_request_overload.
-- CREATE OR REPLACE FUNCTION with an added parameter creates a second
-- overload rather than replacing the original (Postgres matches by exact
-- argument-type signature). This left the old 10-arg signature alongside
-- the new 11-arg one (with p_discount_code default null), which is
-- ambiguous for RPC callers that only supply the original 10 named params.
-- Drop the stale overload so only the discount-aware version remains -
-- fully backward compatible for existing callers since p_discount_code
-- defaults to null.
drop function if exists public.submit_catalog_order_request(uuid, uuid, numeric, uuid, uuid, text, text, numeric, boolean, text);
