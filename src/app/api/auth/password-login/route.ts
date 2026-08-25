import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { type AccountRole } from '@/lib/accountProvisioning';
import { provisionAuthenticatedAccountWithRecovery } from '@/lib/server/accountProvisioningRecovery';
import { normalizeEmail } from '@/lib/authValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const respond = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      ...headers,
    },
  });

const safeNextPath = (value: unknown) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, 'https://fabrictrad.com');
    if (parsed.origin !== 'https://fabrictrad.com') return null;
    if (parsed.pathname === '/login' || parsed.pathname.startsWith('/auth/')) return null;
    if (parsed.pathname.startsWith('/admin-')) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const destinationFor = (role: AccountRole, requestedNext: string | null) => {
  if (role === 'admin_staff' || role === 'super_admin') return '/admin-portal';
  if (role === 'seller') return '/seller-dashboard';
  if (requestedNext) return requestedNext;
  return '/marketplace';
};

const setupRequired = (requestedRole: 'buyer' | 'seller') =>
  respond({
    authenticated: true,
    ready: false,
    role: requestedRole,
    destination: `/auth/setup?role=${requestedRole}&reason=profile_setup`,
    code: 'profile_setup_required',
  });

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown; next?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return respond({ error: 'Invalid login request.' }, 400);
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) return respond({ error: 'Enter your registered email and password.' }, 400);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const retryAfter = error?.status === 429 ? 60 : undefined;
    return respond(
      {
        error:
          error?.status === 429
            ? 'Too many sign-in attempts. Wait a minute and try again.' :'The email or password is incorrect.',
        ...(retryAfter ? { retryAfter } : {}),
      },
      error?.status === 429 ? 429 : 401,
      retryAfter ? { 'Retry-After': String(retryAfter) } : {}
    );
  }

  const requestedRole =
    data.user.app_metadata?.role === 'seller' || data.user.user_metadata?.role === 'seller' ?'seller' :'buyer';
  const requestedNext = safeNextPath(body.next);

  let role: AccountRole = requestedRole;
  let recovered = false;
  try {
    const result = await provisionAuthenticatedAccountWithRecovery(
      supabase,
      data.user,
      requestedRole
    );
    role = result.account.role;
    recovered = result.recovered;
  } catch {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role,is_active,can_buy,can_sell')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile?.is_active === false) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return respond({ error: 'This account is inactive. Contact FabricTrad support.' }, 403);
    }
    if (profileError || !profile) return setupRequired(requestedRole);

    if (
      profile.role !== 'seller' &&
      profile.role !== 'admin_staff' &&
      profile.role !== 'super_admin' &&
      profile.role !== 'buyer'
    ) {
      return setupRequired(requestedRole);
    }
    role = profile.role;

    if (role !== 'admin_staff' && role !== 'super_admin') {
      const canBuy = role === 'seller' ? false : (profile.can_buy ?? role === 'buyer');
      const canSell = profile.can_sell ?? role === 'seller';
      const [buyerResult, sellerResult] = await Promise.all([
        canBuy
          ? supabase.from('buyer_profiles').select('id').eq('user_id', data.user.id).eq('is_active', true).maybeSingle()
          : Promise.resolve({ data: { id: 'not-required' }, error: null }),
        canSell
          ? supabase.from('seller_profiles').select('id').eq('user_id', data.user.id).maybeSingle()
          : Promise.resolve({ data: { id: 'not-required' }, error: null }),
      ]);
      if (
        buyerResult.error ||
        sellerResult.error ||
        !buyerResult.data?.id ||
        !sellerResult.data?.id
      ) {
        return setupRequired(role === 'seller' ? 'seller' : requestedRole);
      }
    }
  }

  return respond({
    authenticated: true,
    ready: true,
    recovered,
    role,
    destination: destinationFor(role, requestedNext),
  });
}
