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
  if (requestedNext) return requestedNext;
  return role === 'seller' ? '/account' : '/marketplace';
};

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
            ? 'Too many sign-in attempts. Wait a minute and try again.'
            : 'The email or password is incorrect.',
        ...(retryAfter ? { retryAfter } : {}),
      },
      error?.status === 429 ? 429 : 401,
      retryAfter ? { 'Retry-After': String(retryAfter) } : {}
    );
  }

  const requestedRole =
    data.user.app_metadata?.role === 'seller' || data.user.user_metadata?.role === 'seller'
      ? 'seller'
      : 'buyer';
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
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role,is_active')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile?.is_active === false) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return respond({ error: 'This account is inactive. Contact FabricTrad support.' }, 403);
    }

    if (
      profile?.role === 'seller' ||
      profile?.role === 'admin_staff' ||
      profile?.role === 'super_admin' ||
      profile?.role === 'buyer'
    ) {
      role = profile.role;
    } else {
      return respond({
        authenticated: true,
        ready: false,
        role: requestedRole,
        destination: `/auth/setup?role=${requestedRole}&reason=profile_setup`,
        code: 'profile_setup_required',
      });
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
