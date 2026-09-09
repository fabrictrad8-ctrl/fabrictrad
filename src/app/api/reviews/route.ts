import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in as a buyer to leave a review.' }, 401);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sellerId = typeof body.sellerId === 'string' ? body.sellerId.trim() : '';
  const rating = Math.round(Number(body.rating));
  const title = String(body.title || '').trim();
  const reviewBody = String(body.body || '').trim();

  if (!sellerId) return json({ error: 'A seller reference is required.' }, 400);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: 'Rating must be between 1 and 5.' }, 400);
  }
  if (title.length < 3 || title.length > 120) {
    return json({ error: 'Review title must be 3-120 characters.' }, 400);
  }
  if (reviewBody.length < 10 || reviewBody.length > 2000) {
    return json({ error: 'Review must be 10-2000 characters.' }, 400);
  }

  const { data: buyerProfile, error: buyerError } = await supabase
    .from('buyer_profiles')
    .select('id,is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (buyerError) return json({ error: 'Buyer profile could not be checked.' }, 503);
  if (!buyerProfile?.id) return json({ error: 'An active buyer profile is required to leave a review.' }, 403);

  // is_verified_purchase is recomputed server-side by a database trigger
  // (compute_seller_review_verified_purchase) from real fulfilled-order
  // history, regardless of what is sent here.
  const { data: existing, error: existingError } = await supabase
    .from('seller_reviews')
    .select('id')
    .eq('seller_id', sellerId)
    .eq('buyer_id', buyerProfile.id)
    .maybeSingle();
  if (existingError) return json({ error: 'Existing review could not be checked.' }, 503);

  if (existing?.id) {
    const { data, error } = await supabase
      .from('seller_reviews')
      .update({ rating, title, body: reviewBody, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id,rating,title,body,is_verified_purchase,created_at,updated_at')
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ review: data, updated: true });
  }

  const { data, error } = await supabase
    .from('seller_reviews')
    .insert({ seller_id: sellerId, buyer_id: buyerProfile.id, rating, title, body: reviewBody })
    .select('id,rating,title,body,is_verified_purchase,created_at,updated_at')
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ review: data, updated: false }, 201);
}
