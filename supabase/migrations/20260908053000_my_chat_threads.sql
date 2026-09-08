create or replace function public.my_chat_threads()
 returns table(id uuid, context_type text, context_id text, context_title text, role text, other_party_id uuid, other_party_name text, other_party_avatar text, last_message text, last_message_at timestamp with time zone, unread integer, created_at timestamp with time zone)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select
    ct.id,
    ct.context_type,
    ct.context_id,
    ct.context_title,
    case when ct.buyer_id = auth.uid() then 'buyer' else 'seller' end as role,
    case when ct.buyer_id = auth.uid() then ct.seller_id else ct.buyer_id end as other_party_id,
    coalesce(up.full_name, 'FabricTrad user') as other_party_name,
    coalesce(up.avatar_url, '') as other_party_avatar,
    ct.last_message,
    ct.last_message_at,
    case when ct.buyer_id = auth.uid() then ct.buyer_unread else ct.seller_unread end as unread,
    ct.created_at
  from public.chat_threads ct
  join public.user_profiles up
    on up.id = case when ct.buyer_id = auth.uid() then ct.seller_id else ct.buyer_id end
  where ct.buyer_id = auth.uid() or ct.seller_id = auth.uid()
  order by ct.last_message_at desc nulls last, ct.created_at desc;
$function$;

grant execute on function public.my_chat_threads() to authenticated;
