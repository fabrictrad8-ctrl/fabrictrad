-- Recovered on 2026-09-05 from the production PostgreSQL catalog.
-- These legacy tables existed before the recorded settlement migrations but their
-- creation was absent from Git. Run before their dependent migrations on rebuild.
-- Existing production tables are left intact; no customer records are copied.

do $baseline$
begin
  if to_regclass('public.b2b_company_accounts') is null then
    create table public.b2b_company_accounts (
      "id" uuid default gen_random_uuid() not null,
      "owner_user_id" uuid not null,
      "company_name" text not null,
      "gstin" text,
      "status" text default 'active'::text not null,
      "purchase_order_required" boolean default false not null,
      "order_review_required" boolean default false not null,
      "default_payment_terms" text default 'due_on_order'::text not null,
      "default_deposit_percent" numeric(5,2) default 0 not null,
      "created_at" timestamp with time zone default now() not null,
      "updated_at" timestamp with time zone default now() not null,
      constraint "b2b_company_accounts_default_deposit_percent_check" CHECK (((default_deposit_percent >= (0)::numeric) AND (default_deposit_percent <= (100)::numeric))),
      constraint "b2b_company_accounts_default_payment_terms_check" CHECK ((default_payment_terms = ANY (ARRAY['due_on_order'::text, 'due_on_fulfillment'::text, 'net_7'::text, 'net_15'::text, 'net_30'::text, 'net_45'::text, 'net_60'::text, 'net_90'::text]))),
      constraint "b2b_company_accounts_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
      constraint "b2b_company_accounts_owner_user_id_key" UNIQUE (owner_user_id),
      constraint "b2b_company_accounts_pkey" PRIMARY KEY (id),
      constraint "b2b_company_accounts_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'suspended'::text])))
    );
    alter table public.b2b_company_accounts enable row level security;
    revoke all on public.b2b_company_accounts from anon;
    grant select, insert, update, delete on public.b2b_company_accounts to authenticated;
    grant all on public.b2b_company_accounts to service_role;
    create policy "b2b_company_owner_or_admin" on public.b2b_company_accounts for ALL to "authenticated" using (((owner_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin))) with check (((owner_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));
  end if;
end
$baseline$;

do $baseline$
begin
  if to_regclass('public.b2b_company_contacts') is null then
    create table public.b2b_company_contacts (
      "id" uuid default gen_random_uuid() not null,
      "company_id" uuid not null,
      "email" text not null,
      "full_name" text default ''::text not null,
      "role" text default 'ordering'::text not null,
      "can_place_orders" boolean default true not null,
      "can_view_all_orders" boolean default false not null,
      "invite_status" text default 'pending'::text not null,
      "created_at" timestamp with time zone default now() not null,
      "updated_at" timestamp with time zone default now() not null,
      constraint "b2b_company_contacts_company_id_email_key" UNIQUE (company_id, email),
      constraint "b2b_company_contacts_company_id_fkey" FOREIGN KEY (company_id) REFERENCES b2b_company_accounts(id) ON DELETE CASCADE,
      constraint "b2b_company_contacts_invite_status_check" CHECK ((invite_status = ANY (ARRAY['pending'::text, 'active'::text, 'revoked'::text]))),
      constraint "b2b_company_contacts_pkey" PRIMARY KEY (id),
      constraint "b2b_company_contacts_role_check" CHECK ((role = ANY (ARRAY['company_admin'::text, 'ordering'::text, 'viewer'::text])))
    );
    alter table public.b2b_company_contacts enable row level security;
    revoke all on public.b2b_company_contacts from anon;
    grant select, insert, update, delete on public.b2b_company_contacts to authenticated;
    grant all on public.b2b_company_contacts to service_role;
    CREATE INDEX b2b_company_contacts_company_idx ON public.b2b_company_contacts USING btree (company_id);
    create policy "b2b_contact_owner_or_admin" on public.b2b_company_contacts for ALL to "authenticated" using ((( SELECT is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM b2b_company_accounts company
  WHERE ((company.id = b2b_company_contacts.company_id) AND (company.owner_user_id = ( SELECT auth.uid() AS uid))))))) with check ((( SELECT is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM b2b_company_accounts company
  WHERE ((company.id = b2b_company_contacts.company_id) AND (company.owner_user_id = ( SELECT auth.uid() AS uid)))))));
  end if;
end
$baseline$;

do $baseline$
begin
  if to_regclass('public.b2b_company_locations') is null then
    create table public.b2b_company_locations (
      "id" uuid default gen_random_uuid() not null,
      "company_id" uuid not null,
      "location_name" text not null,
      "gstin" text,
      "shipping_address" jsonb default '{}'::jsonb not null,
      "billing_address" jsonb default '{}'::jsonb not null,
      "payment_terms" text default 'inherit'::text not null,
      "deposit_percent" numeric(5,2),
      "order_review_required" boolean,
      "is_default" boolean default false not null,
      "created_at" timestamp with time zone default now() not null,
      "updated_at" timestamp with time zone default now() not null,
      constraint "b2b_company_locations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES b2b_company_accounts(id) ON DELETE CASCADE,
      constraint "b2b_company_locations_deposit_percent_check" CHECK (((deposit_percent IS NULL) OR ((deposit_percent >= (0)::numeric) AND (deposit_percent <= (100)::numeric)))),
      constraint "b2b_company_locations_payment_terms_check" CHECK ((payment_terms = ANY (ARRAY['inherit'::text, 'due_on_order'::text, 'due_on_fulfillment'::text, 'net_7'::text, 'net_15'::text, 'net_30'::text, 'net_45'::text, 'net_60'::text, 'net_90'::text]))),
      constraint "b2b_company_locations_pkey" PRIMARY KEY (id)
    );
    alter table public.b2b_company_locations enable row level security;
    revoke all on public.b2b_company_locations from anon;
    grant select, insert, update, delete on public.b2b_company_locations to authenticated;
    grant all on public.b2b_company_locations to service_role;
    CREATE UNIQUE INDEX b2b_company_locations_one_default ON public.b2b_company_locations USING btree (company_id) WHERE is_default;
    CREATE INDEX b2b_company_locations_company_idx ON public.b2b_company_locations USING btree (company_id);
    create policy "b2b_location_owner_or_admin" on public.b2b_company_locations for ALL to "authenticated" using ((( SELECT is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM b2b_company_accounts company
  WHERE ((company.id = b2b_company_locations.company_id) AND (company.owner_user_id = ( SELECT auth.uid() AS uid))))))) with check ((( SELECT is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM b2b_company_accounts company
  WHERE ((company.id = b2b_company_locations.company_id) AND (company.owner_user_id = ( SELECT auth.uid() AS uid)))))));
  end if;
end
$baseline$;

do $baseline$
begin
  if to_regclass('public.message_threads') is null then
    create table public.message_threads (
      "id" uuid default gen_random_uuid() not null,
      "thread_number" bigint generated always as identity not null,
      "buyer_id" uuid not null,
      "seller_id" uuid not null,
      "subject" text default ''::text not null,
      "last_message" text default ''::text not null,
      "last_at" timestamp with time zone default now() not null,
      "unread_buyer" integer default 0 not null,
      "unread_seller" integer default 0 not null,
      "buyer_name" text default ''::text not null,
      "seller_name" text default ''::text not null,
      "status" text default 'open'::text not null,
      "created_at" timestamp with time zone default now() not null,
      "updated_at" timestamp with time zone default now() not null,
      constraint "message_threads_buyer_id_fkey" FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE CASCADE,
      constraint "message_threads_pkey" PRIMARY KEY (id),
      constraint "message_threads_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE,
      constraint "message_threads_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
    );
    alter table public.message_threads enable row level security;
    revoke all on public.message_threads from anon;
    grant select, insert, update, delete on public.message_threads to authenticated;
    grant all on public.message_threads to service_role;
    CREATE INDEX idx_message_threads_buyer_id ON public.message_threads USING btree (buyer_id);
    CREATE INDEX idx_message_threads_seller_id ON public.message_threads USING btree (seller_id);
    CREATE INDEX idx_message_threads_last_at ON public.message_threads USING btree (last_at DESC);
    create policy "thread_buyer_insert" on public.message_threads for INSERT to authenticated with check ((auth.uid() = buyer_id));
    create policy "thread_participant_select" on public.message_threads for SELECT to authenticated using (((auth.uid() = buyer_id) OR (auth.uid() = seller_id)));
    create policy "thread_participant_update" on public.message_threads for UPDATE to authenticated using (((auth.uid() = buyer_id) OR (auth.uid() = seller_id)));
  end if;
end
$baseline$;

do $baseline$
begin
  if to_regclass('public.messages') is null then
    create table public.messages (
      "id" uuid default gen_random_uuid() not null,
      "thread_id" uuid not null,
      "sender_id" uuid not null,
      "sender_role" text not null,
      "body" text not null,
      "read_at" timestamp with time zone,
      "created_at" timestamp with time zone default now() not null,
      constraint "messages_pkey" PRIMARY KEY (id),
      constraint "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
      constraint "messages_sender_role_check" CHECK ((sender_role = ANY (ARRAY['buyer'::text, 'seller'::text]))),
      constraint "messages_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES message_threads(id) ON DELETE CASCADE
    );
    alter table public.messages enable row level security;
    revoke all on public.messages from anon;
    grant select, insert, update, delete on public.messages to authenticated;
    grant all on public.messages to service_role;
    CREATE INDEX idx_messages_thread_id ON public.messages USING btree (thread_id);
    CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);
    create policy "message_participant_insert" on public.messages for INSERT to authenticated with check (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM message_threads t
  WHERE ((t.id = messages.thread_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid())))))));
    create policy "message_participant_select" on public.messages for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM message_threads t
  WHERE ((t.id = messages.thread_id) AND ((t.buyer_id = auth.uid()) OR (t.seller_id = auth.uid()))))));
  end if;
end
$baseline$;

do $baseline$
begin
  if to_regclass('public.seller_payout_requests') is null then
    create table public.seller_payout_requests (
      "id" uuid default gen_random_uuid() not null,
      "seller_id" uuid not null,
      "amount" numeric(12,2) not null,
      "bank_name" text not null,
      "account_number" text,
      "ifsc_code" text not null,
      "account_holder_name" text not null,
      "status" text default 'pending'::text not null,
      "submitted_at" timestamp with time zone default now() not null,
      "processed_at" timestamp with time zone,
      "admin_note" text,
      "razorpay_payout_id" text,
      "created_at" timestamp with time zone default now() not null,
      "updated_at" timestamp with time zone default now() not null,
      "bank_profile_id" uuid,
      "provider" text default 'razorpayx'::text not null,
      "idempotency_key" text,
      "provider_reference" text,
      "failure_reason" text,
      constraint "seller_payout_requests_amount_check" CHECK ((amount >= (100)::numeric)),
      constraint "seller_payout_requests_bank_profile_id_fkey" FOREIGN KEY (bank_profile_id) REFERENCES seller_bank_profiles(id) ON DELETE RESTRICT,
      constraint "seller_payout_requests_pkey" PRIMARY KEY (id),
      constraint "seller_payout_requests_seller_id_fkey" FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE,
      constraint "seller_payout_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'completed'::text, 'rejected'::text])))
    );
    alter table public.seller_payout_requests enable row level security;
    revoke all on public.seller_payout_requests from anon;
    grant select, insert, update, delete on public.seller_payout_requests to authenticated;
    grant all on public.seller_payout_requests to service_role;
    CREATE INDEX idx_seller_payout_requests_seller_id ON public.seller_payout_requests USING btree (seller_id);
    CREATE INDEX idx_seller_payout_requests_status ON public.seller_payout_requests USING btree (status);
    CREATE INDEX idx_seller_payout_requests_submitted_at ON public.seller_payout_requests USING btree (submitted_at DESC);
    CREATE UNIQUE INDEX seller_payout_requests_idempotency_uniq ON public.seller_payout_requests USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
    CREATE INDEX seller_payout_requests_bank_profile_id_idx ON public.seller_payout_requests USING btree (bank_profile_id);
    create policy "seller_payout_requests_admin_all" on public.seller_payout_requests for ALL to "authenticated" using (is_admin()) with check (is_admin());
    create policy "seller_payout_requests_seller_select" on public.seller_payout_requests for SELECT to "authenticated" using ((seller_id = my_seller_id()));
  end if;
end
$baseline$;

do $baseline$
begin
  if to_regclass('public.shopify_seller_order_items') is null then
    create table public.shopify_seller_order_items (
      "id" uuid default gen_random_uuid() not null,
      "order_id" uuid not null,
      "shopify_line_item_gid" text not null,
      "seller_product_id" uuid,
      "shopify_product_gid" text,
      "shopify_variant_gid" text,
      "title" text not null,
      "variant_title" text,
      "sku" text,
      "quantity" integer not null,
      "unit_price" numeric(14,2) default 0 not null,
      "line_total" numeric(14,2) default 0 not null,
      "metadata" jsonb default '{}'::jsonb not null,
      "created_at" timestamp with time zone default now() not null,
      "updated_at" timestamp with time zone default now() not null,
      constraint "shopify_seller_order_items_line_total_check" CHECK ((line_total >= (0)::numeric)),
      constraint "shopify_seller_order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      constraint "shopify_seller_order_items_order_id_shopify_line_item_gid_key" UNIQUE (order_id, shopify_line_item_gid),
      constraint "shopify_seller_order_items_pkey" PRIMARY KEY (id),
      constraint "shopify_seller_order_items_quantity_check" CHECK ((quantity > 0)),
      constraint "shopify_seller_order_items_seller_product_id_fkey" FOREIGN KEY (seller_product_id) REFERENCES seller_products(id) ON DELETE SET NULL,
      constraint "shopify_seller_order_items_unit_price_check" CHECK ((unit_price >= (0)::numeric))
    );
    alter table public.shopify_seller_order_items enable row level security;
    revoke all on public.shopify_seller_order_items from anon;
    grant select, insert, update, delete on public.shopify_seller_order_items to authenticated;
    grant all on public.shopify_seller_order_items to service_role;
    CREATE INDEX shopify_seller_order_items_order_idx ON public.shopify_seller_order_items USING btree (order_id);
    CREATE INDEX shopify_seller_order_items_product_idx ON public.shopify_seller_order_items USING btree (seller_product_id) WHERE (seller_product_id IS NOT NULL);
    create policy "shopify_seller_order_items_admin_all" on public.shopify_seller_order_items for ALL to "authenticated" using (is_admin()) with check (is_admin());
    create policy "shopify_seller_order_items_seller_read" on public.shopify_seller_order_items for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (orders o
     JOIN seller_profiles sp ON ((sp.id = o.seller_id)))
  WHERE ((o.id = shopify_seller_order_items.order_id) AND (sp.user_id = ( SELECT auth.uid() AS uid))))));
  end if;
end
$baseline$;

-- shopify_order_item_purchase_rule is installed by its recorded 20260828 migration.
-- These two nullable order fields were also present in production without a
-- recorded migration. The settlement trigger below depends on both fields.
alter table public.orders
  add column if not exists payment_status text,
  add column if not exists fulfillment_status text;
