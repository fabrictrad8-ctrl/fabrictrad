import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });

const validFlow = (value: unknown): value is 'buyer' | 'seller' =>
  value === 'buyer' || value === 'seller';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return noStore({ error: 'Authentication required.' }, 401);

  const flow = request.nextUrl.searchParams.get('flow');
  if (!validFlow(flow)) return noStore({ error: 'A valid onboarding flow is required.' }, 400);

  const { data, error } = await supabase
    .from('onboarding_drafts')
    .select('flow,step,payload,updated_at')
    .eq('user_id', user.id)
    .eq('flow', flow)
    .maybeSingle();
  if (error) return noStore({ error: 'The saved onboarding draft could not be loaded.' }, 503);

  return noStore({ draft: data || null });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return noStore({ error: 'Authentication required.' }, 401);

  let body: { flow?: unknown; step?: unknown; payload?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return noStore({ error: 'Invalid draft request.' }, 400);
  }

  if (!validFlow(body.flow)) return noStore({ error: 'A valid onboarding flow is required.' }, 400);
  const step = typeof body.step === 'string' ? body.step.trim().slice(0, 64) : '';
  const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
    ? body.payload
    : null;
  if (!step || !payload) return noStore({ error: 'Draft step and payload are required.' }, 400);

  const serialized = JSON.stringify(payload);
  if (serialized.length > 64_000) return noStore({ error: 'The onboarding draft is too large.' }, 413);

  const { data, error } = await supabase
    .from('onboarding_drafts')
    .upsert(
      {
        user_id: user.id,
        flow: body.flow,
        step,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,flow' }
    )
    .select('flow,step,updated_at')
    .single();
  if (error) return noStore({ error: 'The onboarding draft could not be saved.' }, 503);

  return noStore({ saved: true, draft: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return noStore({ error: 'Authentication required.' }, 401);

  const flow = request.nextUrl.searchParams.get('flow');
  if (!validFlow(flow)) return noStore({ error: 'A valid onboarding flow is required.' }, 400);

  const { error } = await supabase
    .from('onboarding_drafts')
    .delete()
    .eq('user_id', user.id)
    .eq('flow', flow);
  if (error) return noStore({ error: 'The onboarding draft could not be cleared.' }, 503);

  return noStore({ deleted: true });
}
