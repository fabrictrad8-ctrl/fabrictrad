import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Sign in to browse the FabricTrad catalogue.' }, 401);

  const admin = createAdminClient();
  const { data: access, error: accessError } = await admin
    .from('user_profiles')
    .select('is_active,can_buy')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (accessError || !access?.is_active || access.can_buy === false) {
    return json({ error: 'An active buyer account is required.' }, 403);
  }

  const query = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 120);
  let productsQuery = admin
    .from('seller_products')
    .select('id,name,sku,category,description,price_per_unit,unit,image_url,image_urls,fabric_name,quality,product_type,work_type,origin_city,origin_state')
    .eq('status', 'active')
    .eq('approval_status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(60);

  if (query) {
    const escaped = query.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (escaped) productsQuery = productsQuery.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%,category.ilike.%${escaped}%,fabric_name.ilike.%${escaped}%`);
  }

  const { data, error } = await productsQuery;
  if (error) return json({ error: 'Catalogue could not be loaded.' }, 503);
  return json({ products: data || [] });
}
