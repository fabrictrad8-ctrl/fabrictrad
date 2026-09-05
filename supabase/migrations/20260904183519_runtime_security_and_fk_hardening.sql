-- Restrict SECURITY DEFINER entry points to their intended callers and index
-- foreign keys used by membership/session cleanup and joins.

create index if not exists seller_verified_memberships_user_id_idx
  on public.seller_verified_memberships (user_id);

create index if not exists whatsapp_seller_catalog_sessions_user_id_idx
  on public.whatsapp_seller_catalog_sessions (user_id);

create index if not exists whatsapp_seller_catalog_sessions_active_product_id_idx
  on public.whatsapp_seller_catalog_sessions (active_product_id);

-- Trigger-only and server-maintenance functions are not public RPCs.
revoke all on function public.auto_claim_verified_seller_early_bird() from public, anon, authenticated;
revoke all on function public.enforce_buyer_seller_identity_separation() from public, anon, authenticated;
revoke all on function public.enforce_seller_buyer_identity_separation() from public, anon, authenticated;
revoke all on function public.enforce_user_profile_seller_identity_separation() from public, anon, authenticated;
revoke all on function public.expire_direct_catalog_orders() from public, anon, authenticated;
revoke all on function public.finalize_seller_rejection_after_refund() from public, anon, authenticated;
revoke all on function public.release_catalog_order_stock_on_terminal_cancel() from public, anon, authenticated;

grant execute on function public.auto_claim_verified_seller_early_bird() to service_role;
grant execute on function public.enforce_buyer_seller_identity_separation() to service_role;
grant execute on function public.enforce_seller_buyer_identity_separation() to service_role;
grant execute on function public.enforce_user_profile_seller_identity_separation() to service_role;
grant execute on function public.expire_direct_catalog_orders() to service_role;
grant execute on function public.finalize_seller_rejection_after_refund() to service_role;
grant execute on function public.release_catalog_order_stock_on_terminal_cancel() to service_role;

-- Authenticated commerce RPCs enforce ownership internally; anonymous callers
-- must not be able to invoke them.
revoke all on function public.buy_catalog_now(uuid, uuid, numeric, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.claim_verified_seller_early_bird(uuid) from public, anon, authenticated;
revoke all on function public.seller_has_verified_tag(uuid) from public, anon, authenticated;
revoke all on function public.seller_reject_catalog_order(uuid, text) from public, anon, authenticated;
revoke all on function public.seller_verified_tags(uuid[]) from public, anon, authenticated;

grant execute on function public.buy_catalog_now(uuid, uuid, numeric, uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.claim_verified_seller_early_bird(uuid) to authenticated, service_role;
grant execute on function public.seller_has_verified_tag(uuid) to authenticated, service_role;
grant execute on function public.seller_reject_catalog_order(uuid, text) to authenticated, service_role;
grant execute on function public.seller_verified_tags(uuid[]) to authenticated, service_role;

-- Identity collision checks expose private account matches and are only used
-- through server routes backed by the service-role client.
revoke all on function public.seller_identity_conflicts(text, text, text, text) from public, anon, authenticated;
grant execute on function public.seller_identity_conflicts(text, text, text, text) to service_role;
