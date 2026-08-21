begin;

-- These are trigger-only helpers. They must not be exposed as callable RPCs.
revoke all on function public.enforce_required_seller_documents_for_registration_status() from public, anon, authenticated;
revoke all on function public.enforce_required_seller_documents_for_profile_status() from public, anon, authenticated;

grant execute on function public.enforce_required_seller_documents_for_registration_status() to service_role;
grant execute on function public.enforce_required_seller_documents_for_profile_status() to service_role;

commit;
