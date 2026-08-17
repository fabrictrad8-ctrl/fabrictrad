import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MEDIA_BUCKET = 'seller-whatsapp-inbox';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Seller authentication required.' }, 401);

  const { data: seller, error: sellerError } = await supabase
    .from('seller_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (sellerError || !seller?.id) {
    return json({ error: 'Complete seller onboarding before using WhatsApp catalog sync.' }, 403);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('whatsapp_catalog_ingestions')
    .select(
      'id,wa_message_id,message_type,message_text,media_storage_path,media_mime_type,parsed_draft,product_id,status,error_message,received_at,processed_at'
    )
    .eq('user_id', user.id)
    .eq('seller_id', seller.id)
    .order('received_at', { ascending: false })
    .limit(50);
  if (error) return json({ error: 'WhatsApp catalogue inbox could not be loaded.' }, 503);

  const items = await Promise.all(
    (data || []).map(async (item) => {
      let mediaUrl: string | null = null;
      if (item.media_storage_path) {
        const signed = await admin.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(item.media_storage_path, 60 * 30);
        mediaUrl = signed.data?.signedUrl || null;
      }
      return { ...item, mediaUrl };
    })
  );

  return json({ items });
}
