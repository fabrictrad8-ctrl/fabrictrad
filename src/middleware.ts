import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_ADMIN_EMAIL = 'fabrictrad8@gmail.com';
const configuredAdminEmail = () =>
  process.env.ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL;
const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/admin-login',
  '/register',
  '/buyer-registration',
  '/seller-registration',
  '/auth/callback',
  '/auth/reset-password',
  '/help',
  '/how-to-use',
  '/how-to-use/start',
  '/privacy',
  '/terms',
]);
const AUTH_ENTRY_PATHS = new Set(['/', '/login', '/admin-login', '/register', '/buyer-registration']);

const withRefreshedCookies = (target: NextResponse, source: NextResponse) => {
  source.cookies.getAll().forEach(({ name, value }) => target.cookies.set(name, value));
  return target;
};

const clearStaleSupabaseCookies = (request: NextRequest, target: NextResponse) => {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')) {
      target.cookies.set(cookie.name, '', {
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
  }
  return target;
};

const redirect = (request: NextRequest, pathname: string) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
};

const adminApiError = (error: string, status: 401 | 403) =>
  NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );

const localRequest = (request: NextRequest) => {
  const hostname = request.nextUrl.hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isAdminApi = pathname.startsWith('/api/admin');
  const isBuyerRegistrationResume =
    pathname === '/buyer-registration' && searchParams.get('resume') === '1';

  if (pathname === '/' && (searchParams.has('code') || searchParams.has('error'))) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    return NextResponse.redirect(callbackUrl);
  }

  const demoCookieValue = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  const demoAccountsEnabled =
    localRequest(request) || process.env.FABRICTRAD_ENABLE_DEMO_ACCOUNTS === 'true';
  const auditAdminEnabled = process.env.FABRICTRAD_ENABLE_AUDIT_ADMIN === 'true';
  const isAuditAdmin = auditAdminEnabled && demoCookieValue === 'admin';
  const demoRole =
    demoAccountsEnabled && (demoCookieValue === 'buyer' || demoCookieValue === 'seller')
      ? demoCookieValue
      : null;

  if (isAuditAdmin) {
    if (AUTH_ENTRY_PATHS.has(pathname)) return redirect(request, '/admin-portal');
    if (pathname.startsWith('/seller-dashboard') || pathname.startsWith('/buyer-dashboard')) {
      return redirect(request, '/admin-portal');
    }
    return NextResponse.next({ request });
  }

  if (demoRole) {
    const canBuy = true;
    const canSell = demoRole === 'seller';
    if (isAdminApi) return adminApiError('Administrator access required.', 403);
    if (AUTH_ENTRY_PATHS.has(pathname) && !isBuyerRegistrationResume) return redirect(request, '/marketplace');
    if (pathname.startsWith('/admin-portal')) return redirect(request, '/marketplace');
    if (pathname.startsWith('/seller-dashboard') && !canSell) return redirect(request, '/seller-registration');
    if ((pathname.startsWith('/buyer-dashboard') || pathname.startsWith('/buyer-requirements')) && !canBuy) {
      return redirect(request, '/marketplace');
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isAdminApi) {
      return clearStaleSupabaseCookies(
        request,
        adminApiError('Administrator sign-in required.', 401)
      );
    }
    if (PUBLIC_PATHS.has(pathname)) return clearStaleSupabaseCookies(request, response);
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = pathname.startsWith('/admin-portal') ? '/admin-login' : '/login';
    loginUrl.search = '';
    if (pathname === '/custom-order' || pathname.startsWith('/buyer-')) {
      loginUrl.searchParams.set('role', 'buyer');
    } else if (pathname.startsWith('/seller-')) {
      loginUrl.searchParams.set('role', 'seller');
    }
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return clearStaleSupabaseCookies(
      request,
      withRefreshedCookies(NextResponse.redirect(loginUrl), response)
    );
  }

  const normalizedEmail = user.email?.trim().toLowerCase() || '';
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active,can_buy,can_sell')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_active === false) {
    if (isAdminApi) return adminApiError('Administrator account is inactive.', 403);
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = normalizedEmail === configuredAdminEmail() ? '/admin-login' : '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('error', 'account_inactive');
    return withRefreshedCookies(NextResponse.redirect(loginUrl), response);
  }

  const role = profile?.role || user.app_metadata?.role || user.user_metadata?.role || 'buyer';
  const hasAdminRole = role === 'admin_staff' || role === 'super_admin';
  const isAdmin =
    normalizedEmail === configuredAdminEmail() &&
    profile?.is_active === true &&
    hasAdminRole;
  const canBuy = !hasAdminRole && (profile?.can_buy ?? true);
  const canSell = !hasAdminRole && (profile?.can_sell ?? role === 'seller');

  if (isAdminApi && !isAdmin) {
    return adminApiError('This account is not authorised for FabricTrad administration.', 403);
  }

  if (AUTH_ENTRY_PATHS.has(pathname) && !isBuyerRegistrationResume) {
    const destination = isAdmin
      ? '/admin-portal'
      : normalizedEmail === configuredAdminEmail()
        ? '/admin-login'
        : '/marketplace';
    return withRefreshedCookies(redirect(request, destination), response);
  }
  if (pathname.startsWith('/admin-portal') && !isAdmin) {
    const destination = normalizedEmail === configuredAdminEmail()
      ? '/admin-login'
      : '/marketplace';
    return withRefreshedCookies(redirect(request, destination), response);
  }
  if (pathname.startsWith('/seller-dashboard') && !canSell) {
    return withRefreshedCookies(redirect(request, '/seller-registration'), response);
  }
  if ((pathname.startsWith('/buyer-dashboard') || pathname.startsWith('/buyer-requirements')) && !canBuy) {
    return withRefreshedCookies(redirect(request, '/marketplace'), response);
  }
  return response;
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
