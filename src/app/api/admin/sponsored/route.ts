import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FUNDED_BY = ['Seller', 'FabricTrad', 'Shared 50/50', 'Custom Split'] as const;
const NOTES_MAX = 500;

type AdminAccess = { user: User; error?: never } | { user?: never; error: NextResponse };

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

async function requireAdministrator(): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: 'Administrator sign-in required.' }, 401) };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();

  const allowed = profile?.is_active === true && (profile.role === 'super_admin' || profile.role === 'admin_staff');
  if (!allowed) return { error: json({ error: 'Administrator access required.' }, 403) };
  return { user };
}

function displayStatus(row: { status: string; start_date: string; end_date: string }): string {
  if (row.status === 'paused') return 'paused';
  const today = new Date().toISOString().slice(0, 10);
  if (row.end_date < today) return 'expired';
  if (row.start_date > today) return 'scheduled';
  return 'active';
}

export async function GET() {
  const access = await requireAdministrator();
  if (access.error) return access.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sponsored_placements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 503);

  const rows = data || [];
  const productIds = [...new Set(rows.map((row) => row.product_id).filter(Boolean))];
  const sellerIds = [...new Set(rows.map((row) => row.seller_id).filter(Boolean))];

  const [{ data: products }, { data: sellers }] = await Promise.all([
    productIds.length
      ? supabase.from('seller_products').select('id,name,sku').in('id', productIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; sku: string | null }[] }),
    sellerIds.length
      ? supabase.from('seller_profiles').select('id,display_name,legal_business_name').in('id', sellerIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; legal_business_name: string | null }[] }),
  ]);

  const productMap = new Map((products || []).map((product) => [product.id, product]));
  const sellerMap = new Map((sellers || []).map((seller) => [seller.id, seller]));

  const placements = rows.map((row) => {
    const product = productMap.get(row.product_id);
    const seller = sellerMap.get(row.seller_id);
    return {
      ...row,
      displayStatus: displayStatus(row),
      product_name: product?.name || 'Unknown product',
      product_sku: product?.sku || null,
      seller_name: seller?.display_name || seller?.legal_business_name || 'Unknown seller',
    };
  });

  return json({ placements });
}

export async function POST(request: NextRequest) {
  const access = await requireAdministrator();
  if (access.error) return access.error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const productId = String(body.productId || '').trim();
  const startDate = String(body.startDate || '');
  const endDate = String(body.endDate || '');
  const fundedBy = String(body.fundedBy || 'Seller');
  const dailyRate = body.dailyRate === '' || body.dailyRate == null ? null : Number(body.dailyRate);
  const notes = body.notes == null ? null : String(body.notes).trim() || null;

  if (!productId) return json({ error: 'A product is required.' }, 400);
  if (!startDate || !endDate || endDate < startDate) return json({ error: 'End date must be on or after the start date.' }, 400);
  if (!FUNDED_BY.includes(fundedBy as (typeof FUNDED_BY)[number])) return json({ error: 'Invalid funding source.' }, 400);
  if (dailyRate !== null && (!Number.isFinite(dailyRate) || dailyRate < 0)) return json({ error: 'Daily rate is invalid.' }, 400);
  if (notes !== null && notes.length > NOTES_MAX) return json({ error: `Notes must be ${NOTES_MAX} characters or fewer.` }, 400);

  const supabase = await createClient();

  // Never trust a client-supplied seller_id — derive it from the product itself,
  // and only allow sponsoring a product that is actually live on the marketplace.
  const { data: product, error: productError } = await supabase
    .from('seller_products')
    .select('id,seller_id,status,approval_status')
    .eq('id', productId)
    .maybeSingle();
  if (productError) return json({ error: 'The product could not be looked up.' }, 503);
  if (!product) return json({ error: 'That product does not exist.' }, 400);
  if (product.status !== 'active' || product.approval_status !== 'approved') {
    return json({ error: 'Only live, approved products can be sponsored.' }, 400);
  }

  const { data, error } = await supabase
    .from('sponsored_placements')
    .insert({
      product_id: product.id,
      seller_id: product.seller_id,
      start_date: startDate,
      end_date: endDate,
      funded_by: fundedBy,
      daily_rate: dailyRate,
      notes,
      status: 'active',
      created_by: access.user.id,
    })
    .select('*')
    .single();
  if (error) return json({ error: error.message }, 400);

  return json({ placement: { ...data, displayStatus: displayStatus(data) } }, 201);
}
