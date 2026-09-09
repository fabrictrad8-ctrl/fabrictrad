import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MEDIA_BUCKET = 'seller-product-media';

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
    .select('id,is_active')
    .eq('user_id', user.id)
    .maybeSingle();
  const { data: profile } = await supabase.from('user_profiles').select('can_sell,is_active').eq('id', user.id).maybeSingle();
  if (sellerError || !seller?.id || seller.is_active !== true || profile?.is_active !== true || profile?.can_sell !== true) {
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

  // A seller who messaged a product in needs to know what happened to it, not
  // just that the message was received. These are real columns on
  // seller_products — nothing here is inferred or invented.
  const productIds = Array.from(
    new Set((data || []).map((item) => item.product_id).filter((value): value is string => Boolean(value)))
  );
  const productsById = new Map<
    string,
    { name: string | null; sku: string | null; status: string | null; approval_status: string | null; hsn_code: string | null }
  >();
  if (productIds.length) {
    const { data: products } = await admin
      .from('seller_products')
      .select('id,name,sku,status,approval_status,hsn_code')
      .eq('seller_id', seller.id)
      .in('id', productIds);
    (products || []).forEach((product) => {
      productsById.set(String(product.id), {
        name: product.name ?? null,
        sku: product.sku ?? null,
        status: product.status ?? null,
        approval_status: product.approval_status ?? null,
        hsn_code: product.hsn_code ?? null,
      });
    });
  }

  const items = await Promise.all(
    (data || []).map(async (item) => {
      let mediaUrl: string | null = null;
      if (item.media_storage_path) {
        const signed = await admin.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(item.media_storage_path, 60 * 30);
        mediaUrl = signed.data?.signedUrl || null;
      }
      return { ...item, mediaUrl, product: item.product_id ? productsById.get(String(item.product_id)) || null : null };
    })
  );

  return json({ items });
}
