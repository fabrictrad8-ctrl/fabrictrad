create index if not exists catalog_order_requests_company_location_idx on public.catalog_order_requests(company_location_id) where company_location_id is not null;
create index if not exists orders_company_location_idx on public.orders(company_location_id) where company_location_id is not null;
create index if not exists seller_catalog_rules_variant_idx on public.seller_catalog_rules(variant_id) where variant_id is not null;

drop policy if exists b2b_company_owner_access on public.b2b_company_accounts;
drop policy if exists b2b_company_admin_access on public.b2b_company_accounts;
create policy b2b_company_owner_or_admin on public.b2b_company_accounts
  for all to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists b2b_location_owner_access on public.b2b_company_locations;
drop policy if exists b2b_location_admin_access on public.b2b_company_locations;
create policy b2b_location_owner_or_admin on public.b2b_company_locations
  for all to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.b2b_company_accounts company
      where company.id = company_id and company.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.b2b_company_accounts company
      where company.id = company_id and company.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists b2b_contact_owner_access on public.b2b_company_contacts;
drop policy if exists b2b_contact_admin_access on public.b2b_company_contacts;
create policy b2b_contact_owner_or_admin on public.b2b_company_contacts
  for all to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.b2b_company_accounts company
      where company.id = company_id and company.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.b2b_company_accounts company
      where company.id = company_id and company.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists seller_catalog_owner_access on public.seller_catalogs;
drop policy if exists seller_catalog_admin_access on public.seller_catalogs;
drop policy if exists seller_catalog_buyer_read on public.seller_catalogs;
create policy seller_catalog_select on public.seller_catalogs
  for select to authenticated
  using (
    (select public.is_admin())
    or (seller_id = (select public.my_seller_id()) and (select public.can_current_user_sell()))
    or (
      status = 'active'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
      and (
        scope = 'all_buyers'
        or exists (
          select 1 from public.b2b_company_accounts company
          where company.id = company_id and company.owner_user_id = (select auth.uid())
        )
      )
    )
  );
create policy seller_catalog_insert on public.seller_catalogs
  for insert to authenticated
  with check ((select public.is_admin()) or (seller_id = (select public.my_seller_id()) and (select public.can_current_user_sell())));
create policy seller_catalog_update on public.seller_catalogs
  for update to authenticated
  using ((select public.is_admin()) or (seller_id = (select public.my_seller_id()) and (select public.can_current_user_sell())))
  with check ((select public.is_admin()) or (seller_id = (select public.my_seller_id()) and (select public.can_current_user_sell())));
create policy seller_catalog_delete on public.seller_catalogs
  for delete to authenticated
  using ((select public.is_admin()) or (seller_id = (select public.my_seller_id()) and (select public.can_current_user_sell())));

drop policy if exists seller_catalog_rule_owner_access on public.seller_catalog_rules;
drop policy if exists seller_catalog_rule_admin_access on public.seller_catalog_rules;
drop policy if exists seller_catalog_rule_buyer_read on public.seller_catalog_rules;
create policy seller_catalog_rule_select on public.seller_catalog_rules
  for select to authenticated
  using (
    exists (
      select 1 from public.seller_catalogs catalog
      where catalog.id = catalog_id
        and (
          (select public.is_admin())
          or (catalog.seller_id = (select public.my_seller_id()) and (select public.can_current_user_sell()))
          or (
            catalog.status = 'active'
            and (catalog.starts_at is null or catalog.starts_at <= now())
            and (catalog.ends_at is null or catalog.ends_at >= now())
            and (
              catalog.scope = 'all_buyers'
              or exists (
                select 1 from public.b2b_company_accounts company
                where company.id = catalog.company_id and company.owner_user_id = (select auth.uid())
              )
            )
          )
        )
    )
  );
create policy seller_catalog_rule_insert on public.seller_catalog_rules
  for insert to authenticated
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.seller_catalogs catalog
      where catalog.id = catalog_id
        and catalog.seller_id = (select public.my_seller_id())
        and (select public.can_current_user_sell())
    )
  );
create policy seller_catalog_rule_update on public.seller_catalog_rules
  for update to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.seller_catalogs catalog
      where catalog.id = catalog_id
        and catalog.seller_id = (select public.my_seller_id())
        and (select public.can_current_user_sell())
    )
  )
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.seller_catalogs catalog
      where catalog.id = catalog_id
        and catalog.seller_id = (select public.my_seller_id())
        and (select public.can_current_user_sell())
    )
  );
create policy seller_catalog_rule_delete on public.seller_catalog_rules
  for delete to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.seller_catalogs catalog
      where catalog.id = catalog_id
        and catalog.seller_id = (select public.my_seller_id())
        and (select public.can_current_user_sell())
    )
  );

drop policy if exists buyer_reorder_owner_access on public.buyer_reorder_lists;
drop policy if exists buyer_reorder_admin_access on public.buyer_reorder_lists;
create policy buyer_reorder_owner_or_admin on public.buyer_reorder_lists
  for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));