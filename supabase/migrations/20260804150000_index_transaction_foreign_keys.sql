create index if not exists discount_campaign_redemptions_order_id_idx
  on public.discount_campaign_redemptions (order_id);

create index if not exists disputes_bulk_order_id_idx
  on public.disputes (bulk_order_id);

create index if not exists disputes_catalog_order_id_idx
  on public.disputes (catalog_order_id);

create index if not exists seller_billing_documents_buyer_user_id_idx
  on public.seller_billing_documents (buyer_user_id);

create index if not exists seller_billing_documents_catalog_order_id_idx
  on public.seller_billing_documents (catalog_order_id);

create index if not exists seller_tax_invoices_issued_by_user_id_idx
  on public.seller_tax_invoices (issued_by_user_id);
