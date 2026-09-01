import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { storeKey, storeSuggestionSeeds, validateStoreName } from '@/lib/buyerStores';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

async function suggestionsFor(admin: ReturnType<typeof createAdminClient>, name: string) {
  const seeds = storeSuggestionSeeds(name);
  const keys = seeds.map((item) => storeKey(item.storeName));
  const { data } = await admin.from('buyer_stores').select('store_key').in('store_key', keys);
  const used = new Set((data || []).map((row) => String(row.store_key || '')));
  return seeds.filter((item) => !used.has(storeKey(item.storeName))).slice(0, 5);
}

export async function GET() {
  const user = await getUser();
  if (!user) return json({ error: 'Sign in to view your store names.' }, 401);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('buyer_stores')
      .select('id,store_name,store_handle,is_primary,source,whatsapp_phone,created_at,updated_at')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return json({ stores: data || [] });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Store names could not be loaded.' }, 500);
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return json({ error: 'Sign in before claiming a store name.' }, 401);

  const body = (await request.json().catch(() => ({}))) as {
    storeName?: string;
    source?: string;
    whatsappPhone?: string;
    primary?: boolean;
  };
  const validation = validateStoreName(body.storeName);
  if (!validation.valid) return json({ error: validation.error }, 400);

  try {
    const admin = createAdminClient();
    const { data: buyer } = await admin
      .from('buyer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: existingPrimary } = await admin
      .from('buyer_stores')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .maybeSingle();

    const shouldBePrimary = body.primary === true || !existingPrimary?.id;
    const source = ['onboarding', 'profile', 'whatsapp', 'admin'].includes(String(body.source || ''))
      ? String(body.source)
      : 'profile';
    const whatsappPhone = String(body.whatsappPhone || '').replace(/\D/g, '').slice(-15) || null;

    const { data, error } = await admin
      .from('buyer_stores')
      .insert({
        user_id: user.id,
        buyer_id: buyer?.id || null,
        store_name: validation.storeName,
        store_key: validation.key,
        store_handle: validation.handle,
        is_primary: shouldBePrimary,
        source,
        whatsapp_phone: whatsappPhone,
      })
      .select('id,store_name,store_handle,is_primary,source,whatsapp_phone,created_at')
      .single();

    if (error) {
      if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
        return json(
          {
            error: 'That store name is already taken.',
            available: false,
            suggestions: await suggestionsFor(admin, validation.storeName),
          },
          409
        );
      }
      throw error;
    }

    return json({ created: true, store: data }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Store name could not be saved.' }, 500);
  }
}
