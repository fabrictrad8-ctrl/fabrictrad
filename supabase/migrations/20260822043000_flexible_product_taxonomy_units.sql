alter table public.seller_products
  add column if not exists product_url text,
  add column if not exists fabric_name text,
  add column if not exists quality text,
  add column if not exists product_type text,
  add column if not exists unit_label text,
  add column if not exists custom_attributes jsonb not null default '{}'::jsonb;

alter table public.seller_product_variants
  add column if not exists unit_label text,
  add column if not exists custom_attributes jsonb not null default '{}'::jsonb;

alter table public.seller_products drop constraint if exists seller_products_unit_check;
alter table public.seller_products
  add constraint seller_products_unit_check
  check (unit = any (array['mtr'::text,'kg'::text,'piece'::text,'roll'::text,'yard'::text,'farma'::text,'custom'::text]));

alter table public.seller_product_variants drop constraint if exists seller_product_variants_unit_check;
alter table public.seller_product_variants
  add constraint seller_product_variants_unit_check
  check (unit = any (array['mtr'::text,'kg'::text,'piece'::text,'roll'::text,'yard'::text,'farma'::text,'custom'::text]));

alter table public.seller_products drop constraint if exists seller_products_package_format_check;
alter table public.seller_products
  add constraint seller_products_package_format_check
  check (char_length(trim(package_format)) between 1 and 160);

alter table public.seller_products
  add constraint seller_products_product_url_check
  check (product_url is null or trim(product_url) = '' or product_url ~* '^https?://[^[:space:]]+$'),
  add constraint seller_products_fabric_name_check
  check (fabric_name is null or char_length(trim(fabric_name)) between 1 and 160),
  add constraint seller_products_quality_check
  check (quality is null or char_length(trim(quality)) between 1 and 160),
  add constraint seller_products_product_type_check
  check (product_type is null or char_length(trim(product_type)) between 1 and 160),
  add constraint seller_products_unit_label_check
  check (unit_label is null or char_length(trim(unit_label)) between 1 and 80),
  add constraint seller_products_custom_attributes_object_check
  check (jsonb_typeof(custom_attributes) = 'object');

alter table public.seller_product_variants
  add constraint seller_product_variants_unit_label_check
  check (unit_label is null or char_length(trim(unit_label)) between 1 and 80),
  add constraint seller_product_variants_custom_attributes_object_check
  check (jsonb_typeof(custom_attributes) = 'object');
