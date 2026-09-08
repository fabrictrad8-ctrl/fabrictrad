-- The buyer-seller "in-website chat" UI (product inquiries, requirement
-- responses, seller inbox) previously ran on client-only React state: nothing
-- was persisted, nothing synced between the two participants, and the seller
-- inbox always rendered an empty, hardcoded thread list. This migration makes
-- the existing chat_threads/chat_messages tables (created earlier but never
-- wired to the UI) safe and complete enough to actually back the feature.

-- One thread per (context, buyer, seller) so the UI can find-or-create safely.
create unique index if not exists chat_threads_unique_context
  on public.chat_threads(context_type, context_id, buyer_id, seller_id);

-- Defense in depth: the client already warns and blocks obvious contact-info
-- sharing, but that check is trivially bypassed client-side, so the same rule
-- is enforced again at the database layer.
create or replace function public.block_chat_contact_info()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  digits_only text;
begin
  if new.message_text is not null then
    digits_only := regexp_replace(new.message_text, '[^0-9]', '', 'g');
    if length(digits_only) >= 10
      or new.message_text ~ '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
      or new.message_text ~* '(whatsapp|wa\.me|telegram|t\.me)'
    then
      raise exception 'CONTACT_INFO_BLOCKED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists block_chat_contact_info_trigger on public.chat_messages;
create trigger block_chat_contact_info_trigger
  before insert on public.chat_messages
  for each row execute function public.block_chat_contact_info();

-- Keep the parent thread's preview/unread state consistent with its messages
-- server-side, instead of trusting each client to compute and write it.
create or replace function public.touch_chat_thread_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_threads
    set last_message = coalesce(
          new.message_text,
          case new.file_type
            when 'image' then '📷 Photo'
            when 'video' then '🎥 Video'
            else '📎 Attachment'
          end
        ),
        last_message_at = new.created_at,
        buyer_unread = case when new.sender_role = 'seller' then buyer_unread + 1 else buyer_unread end,
        seller_unread = case when new.sender_role = 'buyer' then seller_unread + 1 else seller_unread end
    where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists touch_chat_thread_on_message_trigger on public.chat_messages;
create trigger touch_chat_thread_on_message_trigger
  after insert on public.chat_messages
  for each row execute function public.touch_chat_thread_on_message();

-- chat_messages had no UPDATE policy at all (so is_read could never be set).
-- chat_threads had an UPDATE policy but no column limits, so a participant
-- could rewrite any column including buyer_id/seller_id/last_message. Lock
-- both down to exactly the "mark as read" columns each side legitimately owns.
drop policy if exists "Thread participants can mark messages read" on public.chat_messages;
create policy "Thread participants can mark messages read"
  on public.chat_messages for update
  using (
    exists (
      select 1 from public.chat_threads ct
      where ct.id = thread_id
        and (ct.buyer_id = auth.uid() or ct.seller_id = auth.uid())
    )
  );

revoke update on public.chat_messages from authenticated;
grant update (is_read) on public.chat_messages to authenticated;

revoke update on public.chat_threads from authenticated;
grant update (buyer_unread, seller_unread) on public.chat_threads to authenticated;

-- A buyer only ever sees a seller's opaque seller_profiles.id (via
-- seller_directory / product listings), never their auth user id, by design.
-- Starting a chat thread needs that user id, so expose exactly that one field
-- for exactly the sellers a buyer is already allowed to see and buy from.
create or replace function public.seller_user_id_for_chat(p_seller_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.seller_profiles
  where id = p_seller_id and is_active = true and verification_status = 'verified';
$$;

revoke all on function public.seller_user_id_for_chat(uuid) from public, anon;
grant execute on function public.seller_user_id_for_chat(uuid) to authenticated;

-- Chat attachments bucket, private, scoped to the thread's two participants.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists chat_attachments_participant_read on storage.objects;
drop policy if exists chat_attachments_participant_upload on storage.objects;

create policy chat_attachments_participant_read on storage.objects
for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and exists (
    select 1 from public.chat_threads ct
    where ct.id::text = (storage.foldername(name))[1]
      and (ct.buyer_id = auth.uid() or ct.seller_id = auth.uid())
  )
);

create policy chat_attachments_participant_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and exists (
    select 1 from public.chat_threads ct
    where ct.id::text = (storage.foldername(name))[1]
      and (ct.buyer_id = auth.uid() or ct.seller_id = auth.uid())
  )
);

-- Live sync for both sides of a conversation.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_threads'
  ) then
    alter publication supabase_realtime add table public.chat_threads;
  end if;
end $$;
