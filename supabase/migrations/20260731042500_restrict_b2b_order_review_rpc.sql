revoke execute on function public.review_company_catalog_order(uuid, text) from public;
revoke execute on function public.review_company_catalog_order(uuid, text) from anon;
grant execute on function public.review_company_catalog_order(uuid, text) to authenticated;