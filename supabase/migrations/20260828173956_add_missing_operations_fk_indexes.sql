create index if not exists seller_payout_requests_bank_profile_id_idx
  on public.seller_payout_requests(bank_profile_id);

create index if not exists shiprocket_shipment_operations_requested_by_idx
  on public.shiprocket_shipment_operations(requested_by);

create index if not exists shopify_refund_operations_requested_by_idx
  on public.shopify_refund_operations(requested_by);
