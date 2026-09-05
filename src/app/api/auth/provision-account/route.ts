import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  ensureAccountProvisioned,
  type CommerceRole,
} from '@/lib/accountProvisioning';
import { provisionAuthenticatedAccountWithRecovery } from '@/lib/server/accountProvisioningRecovery';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BuyerType = 'retail_store' | 'end_user';

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

const requestedRoleFrom = (value: unknown): CommerceRole => value === 'seller' ? 'seller' : 'buyer';

const buyerTypeFrom = (request: NextRequest, value: unknown): BuyerType | null => {
  const candidate = typeof value === 'string'
    ? value
    : request.cookies.get('fabrictrad_buyer_type')?.value;
  return candidate === 'retail_store' || candidate === 'end_user' ? candidate : null;
};

const persistBuyerType = async (
  client: SupabaseClient,
  userId: string,
  buyerType: BuyerType | null
) => {
  if (!buyerType) return;

  const { error: buyerError } = await client
    .from('buyer_profiles')
    .update({ buyer_type: buyerType, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (buyerError) throw buyerError;

  // A retail-store buyer is a business account. Never downgrade an account
  // that may already have seller access when the user chooses End User.
  if (buyerType === 'retail_store') {
    const { error: profileError } = await client
      .from('user_profiles')
      .update({ account_kind: 'business', updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (profileError) throw profileError;
  }
};

export async function POST(request: NextRequest) {
  const serverClient = await createClient();
  const token = bearerToken(request);
  let body: {
    userId?: unknown;
    registrationNonce?: unknown;
    requestedRole?: unknown;
    buyerType?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const requestedRole = requestedRoleFrom(body.requestedRole);
  const buyerType = buyerTypeFrom(request, body.buyerType);
  let user: User | null = null;
  let hasCookieSession = false;
  let nonceAuthenticated = false;

  if (token) {
    const { data, error } = await serverClient.auth.getUser(token);
    if (!error) user = data.user;
  }

  const { data: cookieData, error: cookieError } = await serverClient.auth.getUser();
  if (!cookieError && cookieData.user) {
    user = cookieData.user;
    hasCookieSession = true;
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
    if (!error && data && typeof data === 'object') return json(data as Record<string, unknown>);
    return json(
      { error: 'Registration verification expired or invalid.', code: 'registration_verification_failed' },
      error?.code === '42501' ? 401 : 500
    );
  }

  if (!user) {
    return json({ error: 'Authentication is required to finish account setup.', code: 'authentication_required' }, 401);
  }

  try {
    if (hasCookieSession && !nonceAuthenticated) {
      const { account: provisioned, recovered } = await provisionAuthenticatedAccountWithRecovery(
        serverClient,
        user,
        requestedRole
      );
      const persistenceClient = admin || serverClient;
      await persistBuyerType(persistenceClient, user.id, buyerType);
      return json({ ...provisioned, buyerType, recovered });
    }

    if (!admin) {
      return json(
        { error: 'Account setup needs an authenticated browser session.', code: 'browser_session_required' },
        401
      );
    }

    const provisioned = await ensureAccountProvisioned(admin as SupabaseClient, user);
    await persistBuyerType(admin as SupabaseClient, user.id, buyerType);
    if (nonceAuthenticated) {
      const metadata = { ...(user.user_metadata || {}), registration_nonce: null };
      await admin.auth.admin.updateUserById(user.id, { user_metadata: metadata });
    }
    return json({ ready: true, phonePresent: Boolean(user.user_metadata?.phone), buyerType, recovered: false, ...provisioned });
  } catch (error) {
    console.error('Account provisioning endpoint failed', {
      userId: user.id,
      requestedRole,
      buyerType,
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
    });
    return json(
      {
        error: 'Your sign-in is valid, but FabricTrad could not finish the workspace repair yet. Retry safely from the account setup screen.',
        code: 'profile_setup_failed',
        recoverable: true,
      },
      503
    );
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
  let { data: profile } = await serverClient
    .from('user_profiles')
    .select('role,can_buy,can_sell,phone')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile && !token) {
    const requestedRole: CommerceRole =
      user.app_metadata?.role === 'seller' || user.user_metadata?.role === 'seller'
        ? 'seller'
        : 'buyer';
    try {
      await provisionAuthenticatedAccountWithRecovery(serverClient, user, requestedRole);
      const refreshed = await serverClient
        .from('user_profiles')
        .select('role,can_buy,can_sell,phone')
        .eq('id', user.id)
        .maybeSingle();
      profile = refreshed.data;
    } catch {
      return json({
        ready: false,
        authenticated: true,
        destination: `/auth/setup?role=${requestedRole}&reason=profile_setup`,
        code: 'profile_setup_failed',
      });
    }
  }

  const role = profile?.role || user.app_metadata?.role || 'buyer';
  if (role === 'admin_staff' || role === 'super_admin') return json({ ready: true, role });

  const { data: buyerProfile } = await serverClient
    .from('buyer_profiles')
    .select('id,buyer_type')
    .eq('user_id', user.id)
    .maybeSingle();
  const { data: sellerProfile } = profile?.can_sell
    ? await serverClient.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle()
    : { data: null };

  const ready = Boolean(buyerProfile?.id) && (!profile?.can_sell || Boolean(sellerProfile?.id));
  return json({
    ready,
    role,
    canBuy: profile?.can_buy ?? true,
    canSell: profile?.can_sell ?? false,
    buyerType: buyerProfile?.buyer_type || 'end_user',
    phonePresent: Boolean(profile?.phone),
    ...(!ready
      ? {
          authenticated: true,
          destination: `/auth/setup?role=${role === 'seller' ? 'seller' : 'buyer'}&reason=profile_setup`,
        }
      : {}),
  });
}
