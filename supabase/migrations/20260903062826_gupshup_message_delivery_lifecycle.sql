alter table public.whatsapp_buyer_messages
  add column if not exists provider text not null default 'meta',
  add column if not exists provider_message_id text,
  add column if not exists whatsapp_message_id text,
  add column if not exists delivery_status text,
  add column if not exists delivery_status_at timestamptz,
  add column if not exists provider_error_code text,
  add column if not exists provider_error_message text;

alter table public.whatsapp_buyer_messages
  drop constraint if exists whatsapp_buyer_messages_provider_check;
alter table public.whatsapp_buyer_messages
  add constraint whatsapp_buyer_messages_provider_check
  check (provider in ('meta', 'gupshup'));

alter table public.whatsapp_buyer_messages
  drop constraint if exists whatsapp_buyer_messages_delivery_status_check;
alter table public.whatsapp_buyer_messages
  add constraint whatsapp_buyer_messages_delivery_status_check
  check (delivery_status is null or delivery_status in ('submitted', 'enqueued', 'sent', 'delivered', 'read', 'failed', 'deleted'));

create index if not exists whatsapp_buyer_messages_provider_message_idx
  on public.whatsapp_buyer_messages (provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists whatsapp_buyer_messages_whatsapp_message_idx
  on public.whatsapp_buyer_messages (whatsapp_message_id)
  where whatsapp_message_id is not null;

create index if not exists whatsapp_buyer_messages_delivery_status_idx
  on public.whatsapp_buyer_messages (delivery_status, delivery_status_at desc)
  where direction = 'outbound' and delivery_status is not null;

comment on column public.whatsapp_buyer_messages.provider is 'Transport provider used for this message. Historical rows default to meta; new Gupshup rows must set gupshup explicitly.';
comment on column public.whatsapp_buyer_messages.provider_message_id is 'Provider-side message identifier, such as the Gupshup messageId/gsId.';
comment on column public.whatsapp_buyer_messages.whatsapp_message_id is 'WhatsApp network message identifier when supplied by the provider.';
comment on column public.whatsapp_buyer_messages.delivery_status is 'Provider delivery lifecycle, independent of FabricTrad processing_status.';
