import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { ensureAccountProvisioned } from '@/lib/accountProvisioning';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const bearerToken = (request: NextRequest) => {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
};

const adminClientOrNull = () => {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
};

const nonceValues = (body: { userId?: unknown; registrationNonce?: unknown }) => ({
  userId: typeof body.userId === 'string' ? body.userId.trim() : '',
  nonce: typeof body.registrationNonce === 'string' ? body.registrationNonce.trim() : '',
});

export async function POST(request: NextRequest) {
  const serverClient = await createClient();
  const token = bearerToken(request);
  let body: { userId?: unknown; registrationNonce?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  let user: User | null = null;
  let provisioningClient: SupabaseClient = serverClient;
  let nonceAuthenticated = false;

  if (token) {
    const { data, error } = await serverClient.auth.getUser(token);
    if (!error) user = data.user;
  }

  if (!user) {
    const { data, error } = await serverClient.auth.getUser();
    if (!error) user = data.user;
  }

  const admin = adminClientOrNull();
  const { userId, nonce } = nonceValues(body);
  if (!user && admin && userId && nonce) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const candidate = error ? null : data.user;
    const storedNonce = candidate?.user_metadata?.registration_nonce;
    const createdAt = candidate?.created_at ? new Date(candidate.created_at).getTime() : 0;
    const fresh = createdAt > Date.now() - 2 * 60 * 60 * 1000;
    if (candidate && fresh && storedNonce === nonce) {
      user = candidate;
      nonceAuthenticated = true;
    }
  }

  if (!user && userId && nonce) {
    const { data, error } = await serverClient.rpc('get_signup_account_by_nonce', {
      p_user_id: userId,
      p_nonce: nonce,
    });
    if (!error && data && typeof data === 'object') {
      return json(data as Record<string, unknown>);
    }
    const message = error?.message || 'Registration verification expired or invalid.';
    return json({ error: message }, error?.code === '42501' ? 401 : 500);
  }

  if (!user) {
    return json({ error: 'Authentication is required to finish account setup.' }, 401);
  }

  if (admin) provisioningClient = admin;

  try {
    const provisioned = await ensureAccountProvisioned(provisioningClient, user);

    if (nonceAuthenticated && admin) {
      const metadata = { ...(user.user_metadata || {}), registration_nonce: null };
      await admin.auth.admin.updateUserById(user.id, { user_metadata: metadata });
    }

    return json({ ready: true, ...provisioned });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account setup could not be completed.';
    return json({ error: message }, 500);
  }
}

export async function GET(request: NextRequest) {
  const serverClient = await createClient();
  const token = bearerToken(request);
  const { data, error } = token
    ? await serverClient.auth.getUser(token)
    : await serverClient.auth.getUser();
  if (error || !data.user) return json({ ready: false }, 401);

  const user = data.user;
  const { data: profile } = await serverClient
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = profile?.role || user.app_metadata?.role || user.user_metadata?.role || 'buyer';
  const table = role === 'seller' ? 'seller_profiles' : role === 'buyer' ? 'buyer_profiles' : null;
  if (!table) return json({ ready: true, role });

  const { data: roleProfile } = await serverClient
    .from(table)
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  return json({ ready: Boolean(roleProfile?.id), role });
}
