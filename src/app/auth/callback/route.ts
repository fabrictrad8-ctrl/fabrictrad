import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

type UserRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';

const isUserRole = (role: unknown): role is UserRole =>
  role === 'buyer' || role === 'seller' || role === 'admin_staff' || role === 'super_admin';

const getRequestedRole = (request: NextRequest, roleParam: string | null): 'buyer' | 'seller' => {
  if (roleParam === 'seller' || roleParam === 'buyer') return roleParam;

  const roleCookie = request.cookies.get('fabrictrad_oauth_role')?.value;
  if (roleCookie === 'seller' || roleCookie === 'buyer') return roleCookie;

  return 'buyer';
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

const destinationForRole = (origin: string, role: UserRole) => {
  if (role === 'seller') return `${origin}/seller-dashboard`;
  if (role === 'admin_staff' || role === 'super_admin') return `${origin}/admin-portal`;
  return `${origin}/buyer-dashboard`;
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const providerError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const roleParam = searchParams.get('role');
  const roleCookie = request.cookies.get('fabrictrad_oauth_role')?.value;
  const requestedRole = getRequestedRole(request, roleParam);

  if (providerError) {
    return redirectAfterAuth(loginErrorUrl(origin, errorDescription || providerError));
  }

  if (!code) {
    return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));
  }

  const normalizedEmail = user.email?.trim().toLowerCase() || '';

  if (normalizedEmail === ADMIN_EMAIL && user.email_confirmed_at) {
    return redirectAfterAuth(`${origin}/admin-portal`);
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, phone, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return redirectAfterAuth(loginErrorUrl(origin, 'auth_failed'));
  }

  if (!profile) {
    await supabase.auth.signOut();
    return redirectAfterAuth(loginErrorUrl(origin, 'account_not_found'));
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    return redirectAfterAuth(loginErrorUrl(origin, 'account_inactive'));
  }

  const resolvedRole = isUserRole(profile.role) ? profile.role : requestedRole;
  const hasGoogleIdentity =
    user.app_metadata?.provider === 'google' ||
    user.identities?.some((identity) => identity.provider === 'google') === true;
  const isGoogleCallback =
    hasGoogleIdentity &&
    (roleParam === 'buyer' || roleParam === 'seller' || roleCookie === 'buyer' || roleCookie === 'seller');

  if (isGoogleCallback && resolvedRole !== 'buyer') {
    await supabase.auth.signOut();
    return redirectAfterAuth(loginErrorUrl(origin, 'google_buyer_only'));
  }

  if (!profile.phone && resolvedRole !== 'admin_staff' && resolvedRole !== 'super_admin') {
    return redirectAfterAuth(`${origin}/auth/phone?role=${resolvedRole}`);
  }

  return redirectAfterAuth(destinationForRole(origin, resolvedRole));
}
