import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

async function authenticatedBuyer() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { user: null, buyer: null, error: 'Authentication required.' };

  const admin = createAdminClient();
  const [{ data: access, error: accessError }, { data: buyer, error: buyerError }] = await Promise.all([
    admin.from('user_profiles').select('is_active,can_buy').eq('id', auth.user.id).maybeSingle(),
    admin.from('buyer_profiles').select('id,is_active,buyer_type').eq('user_id', auth.user.id).maybeSingle(),
  ]);
  if (accessError || buyerError || !access?.is_active || access.can_buy === false || !buyer?.id || buyer.is_active === false) {
    return { user: auth.user, buyer: null, error: 'An active buyer profile is required.' };
  }
  return { user: auth.user, buyer, error: '' };
}

export async function GET() {
  const access = await authenticatedBuyer();
  if (!access.user) return json({ error: access.error }, 401);
  if (!access.buyer) return json({ error: access.error }, 403);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bespoke_orders')
    .select('id,source,stage,product_id,buyer_store_id,reference_image_path,fabric_selection,customization,measurement,quotation,quoted_amount,advance_amount,paid_amount,balance_amount,payment_choice,payment_status,stitching_status,embroidery_status,human_action_required,human_action_reason,delivery_mode,delivery_details,review_rating,review_text,follow_up_due_at,created_at,updated_at')
    .eq('user_id', access.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return json({ error: 'Custom orders could not be loaded.' }, 503);
  return json({ orders: data || [] });
}

export async function POST(request: NextRequest) {
  const access = await authenticatedBuyer();
  if (!access.user) return json({ error: access.error }, 401);
  if (!access.buyer) return json({ error: access.error }, 403);

  const body = (await request.json().catch(() => ({}))) as {
    productId?: string;
    storeId?: string;
    source?: string;
  };
  const productId = typeof body.productId === 'string' && body.productId ? body.productId : null;
  const storeId = typeof body.storeId === 'string' && body.storeId ? body.storeId : null;
  const source = 'website';
  const admin = createAdminClient();

  if (productId) {
    const { data: product, error: productError } = await admin
      .from('seller_products')
      .select('id,status,approval_status')
      .eq('id', productId)
      .maybeSingle();
    if (productError || !product || product.status !== 'active' || product.approval_status !== 'approved') {
      return json({ error: 'Choose an active approved catalogue product.' }, 400);
    }
  }

  if (storeId) {
    const { data: store, error: storeError } = await admin
      .from('buyer_stores')
      .select('id')
      .eq('id', storeId)
      .eq('user_id', access.user.id)
      .maybeSingle();
    if (storeError || !store?.id) return json({ error: 'That store identity does not belong to this account.' }, 403);
  }

  const { data, error } = await admin
    .from('bespoke_orders')
    .insert({
      user_id: access.user.id,
      buyer_id: access.buyer.id,
      buyer_store_id: storeId,
      product_id: productId,
      source,
      stage: productId ? 'reference_image' : 'catalogue',
    })
    .select('*')
    .single();
  if (error || !data) return json({ error: error?.message || 'Custom order could not be started.' }, 500);

  return json({ created: true, order: data }, 201);
}
