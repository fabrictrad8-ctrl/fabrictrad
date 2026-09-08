import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED_HANDLES = new Set(['admin', 'api', 'store', 'stores', 'marketplace', 'vendors', 'seller', 'sellers', 'login', 'logout', 'settings', 'new', 'null', 'undefined', 'fabrictrad']);

const clean = (value: unknown, max = 300) =>
  (typeof value === 'string' ? value.trim() : '').replace(/\s+/g, ' ').slice(0, max);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

async function authSeller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const [{ data: profile }, { data: seller }] = await Promise.all([
    admin.from('user_profiles').select('id,can_sell,is_active').eq('id', user.id).maybeSingle(),
    admin.from('seller_profiles').select('id,store_name,store_handle,store_bio,store_banner_url,display_name,legal_business_name,verification_status,is_early_bird,early_bird_rank,is_active').eq('user_id', user.id).maybeSingle(),
  ]);
  if (!profile?.id || !seller?.id || profile.is_active !== true || profile.can_sell !== true || seller.is_active !== true) return null;
  return { user, seller, admin };
}

const shape = (seller: Record<string, unknown>) => ({
  storeName: (seller.store_name as string) || '',
  storeHandle: (seller.store_handle as string) || '',
  storeBio: (seller.store_bio as string) || '',
  storeBannerUrl: (seller.store_banner_url as string) || '',
  fallbackName: (seller.display_name as string) || (seller.legal_business_name as string) || 'FabricTrad seller',
  isVerified: seller.verification_status === 'verified',
  isEarlyBird: seller.is_early_bird === true,
  earlyBirdRank: seller.early_bird_rank ?? null,
  publicUrl: seller.store_handle ? `/store/${seller.store_handle}` : null,
});

export async function GET() {
  const auth = await authSeller();
  if (!auth) return json({ error: 'Active seller access is required.' }, 403);
  return json(shape(auth.seller as unknown as Record<string, unknown>));
}

export async function PUT(request: NextRequest) {
  const auth = await authSeller();
  if (!auth) return json({ error: 'Active seller access is required.' }, 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: 'Invalid store details.' }, 400);

  const storeName = clean(body.storeName, 80);
  const storeBio = clean(body.storeBio, 280);
  const storeBannerUrl = clean(body.storeBannerUrl, 600);
  let storeHandle = slugify(clean(body.storeHandle, 60));

  if (!storeName) return json({ error: 'Enter a store name.' }, 400);
  if (storeName.length < 2) return json({ error: 'Store name is too short.' }, 400);

  if (storeHandle) {
    if (storeHandle.length < 3) return json({ error: 'Store handle must be at least 3 characters.' }, 400);
    if (!HANDLE_PATTERN.test(storeHandle)) return json({ error: 'Store handle can only use lowercase letters, numbers and hyphens, and must start and end with a letter or number.' }, 400);
    if (RESERVED_HANDLES.has(storeHandle)) return json({ error: 'That store handle is reserved. Choose a different one.' }, 409);

    const { data: existing, error: lookupError } = await auth.admin
      .from('seller_profiles')
      .select('id')
      .ilike('store_handle', storeHandle)
      .neq('id', auth.seller.id)
      .maybeSingle();
    if (lookupError) return json({ error: 'Store handle could not be checked. Please retry.' }, 500);
    if (existing) return json({ error: 'That store handle is already taken. Choose a different one.' }, 409);
  } else {
    storeHandle = null as unknown as string;
  }

  if (storeBannerUrl && !/^https?:\/\//i.test(storeBannerUrl)) {
    return json({ error: 'Store banner must be a valid image URL.' }, 400);
  }

  const { data: updated, error: updateError } = await auth.admin
    .from('seller_profiles')
    .update({
      store_name: storeName,
      store_handle: storeHandle || null,
      store_bio: storeBio || null,
      store_banner_url: storeBannerUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.seller.id)
    .select('store_name,store_handle,store_bio,store_banner_url,display_name,legal_business_name,verification_status,is_early_bird,early_bird_rank')
    .single();

  if (updateError || !updated) {
    const message = String(updateError?.message || '');
    if (message.includes('duplicate key') || message.includes('store_handle')) {
      return json({ error: 'That store handle is already taken. Choose a different one.' }, 409);
    }
    if (message.includes('store_handle_format')) {
      return json({ error: 'Store handle can only use lowercase letters, numbers and hyphens.' }, 400);
    }
    return json({ error: 'Store details could not be saved.' }, 500);
  }

  return json({ saved: true, ...shape(updated as unknown as Record<string, unknown>) });
}
