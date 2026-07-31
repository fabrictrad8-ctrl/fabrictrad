import { createClient } from '@/lib/supabase/server';
import {
  ensureAuthenticatedAccountProvisioned,
  type AuthenticatedProvisionedAccount,
} from '@/lib/accountProvisioning';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type UserRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';

const getRequestedRole = (request: NextRequest, roleParam: string | null): 'buyer' | 'seller' => {
  if (roleParam === 'seller' || roleParam === 'buyer') return roleParam;
  const roleCookie = request.cookies.get('fabrictrad_oauth_role')?.value;
  return roleCookie === 'seller' || roleCookie === 'buyer' ? roleCookie : 'buyer';
};

const redirectAfterAuth = (url: string) => {
  const response = NextResponse.redirect(url);
  response.cookies.set('fabrictrad_oauth_role', '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
};

const loginErrorUrl = (origin: string, code: string) => {
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('error', code);
  return loginUrl.toString();
};

const setupRecoveryUrl = (origin: string, requestedRole: 'buyer' | 'seller') => {
  const setupUrl = new URL('/auth/setup', origin);
  setupUrl.searchParams.set('role', requestedRole);
  setupUrl.searchParams.set('reason', 'profile_setup');
  return setupUrl.toString();
};

const destinationForAccount = (
  origin: string,
  requestedRole: 'buyer' | 'seller',
  account: AuthenticatedProvisionedAccount
) => {
  if (account.role === 'admin_staff' || account.role === 'super_admin') return `${origin}/admin-portal`;
  if (!account.phonePresent) return `${origin}/auth/phone?role=${requestedRole}`;
  if (requestedRole === 'seller' && !account.canSell) return `${origin}/seller-registration`;
  return `${origin}/marketplace`;
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const providerError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const requestedRole = getRequestedRole(request, searchParams.get('role'));

  if (providerError) {
    return redirectAfterAuth(loginErrorUrl(origin, errorDescription || providerError));
  }
  if (!code) return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));

  const normalizedEmail = user.email?.trim().toLowerCase() || '';
  if (normalizedEmail === ADMIN_EMAIL && user.email_confirmed_at) {
    // The database profile trigger promotes this exact configured mailbox to
    // super_admin when profile provisioning runs on the first portal request.
    try {
      await ensureAuthenticatedAccountProvisioned(supabase, 'buyer');
    } catch (error) {
      console.error('Administrator profile bootstrap failed', {
        userId: user.id,
        code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
      });
      return redirectAfterAuth(setupRecoveryUrl(origin, 'buyer'));
    }
    return redirectAfterAuth(`${origin}/admin-portal`);
  }

  let account: AuthenticatedProvisionedAccount;
  try {
    // OAuth uses the authenticated self-service path. ensureAccountProvisioned
    // remains the trusted administrative/registration fallback elsewhere.
    account = await ensureAuthenticatedAccountProvisioned(supabase, requestedRole);
  } catch (error) {
    // The OAuth session is valid. Preserve it and move to a retry-safe repair
    // screen instead of converting an optional profile problem into a logout.
    console.error('OAuth account provisioning failed', {
      userId: user.id,
      requestedRole,
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
    });
    return redirectAfterAuth(setupRecoveryUrl(origin, requestedRole));
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return redirectAfterAuth(setupRecoveryUrl(origin, requestedRole));
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    return redirectAfterAuth(loginErrorUrl(origin, 'account_inactive'));
  }

  return redirectAfterAuth(destinationForAccount(origin, requestedRole, account));
}
