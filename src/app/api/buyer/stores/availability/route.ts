import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  storeKey,
  storeSuggestionSeeds,
  validateStoreName,
  type StoreNameSuggestion,
} from '@/lib/buyerStores';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('name') || '';
  const validation = validateStoreName(value);
  if (!validation.valid) {
    return json({ available: false, error: validation.error, suggestions: [] }, 400);
  }

  try {
    const admin = createAdminClient();
    const { data: exact, error: exactError } = await admin
      .from('buyer_stores')
      .select('id')
      .eq('store_key', validation.key)
      .limit(1)
      .maybeSingle();
    if (exactError) throw exactError;

    if (!exact?.id) {
      return json({
        available: true,
        storeName: validation.storeName,
        handle: validation.handle,
        suggestions: [],
      });
    }

    const seeds = storeSuggestionSeeds(validation.storeName);
    const keys = seeds.map((item) => storeKey(item.storeName));
    const { data: collisions, error: collisionError } = await admin
      .from('buyer_stores')
      .select('store_key')
      .in('store_key', keys);
    if (collisionError) throw collisionError;
    const used = new Set((collisions || []).map((row) => String(row.store_key || '')));

    const suggestions: StoreNameSuggestion[] = seeds
      .filter((item) => !used.has(storeKey(item.storeName)))
      .slice(0, 5);

    return json({
      available: false,
      storeName: validation.storeName,
      handle: validation.handle,
      suggestions,
      message: 'That store name is already taken. Choose one of these available names or try another.',
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Store-name availability could not be checked.' },
      500
    );
  }
}
