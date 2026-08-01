import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({ error: 'Sign in to view seller verification.' }, 401);
  }

  const { data, error } = await supabase.rpc('ensure_current_seller_verification_state');
  if (error) {
    const status = error.code === '42501' ? 403 : 400;
    return json({ error: error.message || 'Seller verification status is unavailable.' }, status);
  }

  return json({ status: data });
}
