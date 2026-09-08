import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in to see your Virtual Drape balance.' }, 401);

  const { data, error } = await supabase.rpc('get_drape_credit_balance');
  if (error) return json({ error: 'Virtual Drape balance is unavailable right now.' }, 503);

  return json({
    freeTrialsRemaining: data?.freeTrialsRemaining ?? 0,
    purchasedCredits: data?.purchasedCredits ?? 0,
    totalRemaining: data?.totalRemaining ?? 0,
  });
}
