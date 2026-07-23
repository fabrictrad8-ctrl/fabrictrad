import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/buyer-registration',
  '/seller-registration',
  '/auth/callback',
]);

const AUTH_ENTRY_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/buyer-registration',
  '/seller-registration',
]);

const roleDestination = (role?: string | null) => {
  if (role === 'seller') return '/seller-dashboard';
  if (role === 'admin_staff' || role === 'super_admin') return '/admin-portal';
  return '/buyer-dashboard';
};

const withRefreshedCookies = (target: NextResponse, source: NextResponse) => {
  source.cookies.getAll().forEach(({ name, value }) => target.cookies.set(name, value));
  return target;
};

const redirectToRoleHome = (request: NextRequest, role: string) => {
  const destinationUrl = request.nextUrl.clone();
  destinationUrl.pathname = roleDestination(role);
  destinationUrl.search = '';
  return NextResponse.redirect(destinationUrl);
};

const isRoleMismatch = (pathname: string, role: string) => {
  const isAdminRoute = pathname.startsWith('/admin-portal');
  const isSellerRoute = pathname.startsWith('/seller-dashboard');
  const isBuyerRoute =
    pathname.startsWith('/buyer-dashboard') || pathname.startsWith('/buyer-requirements');

  return (
    (isAdminRoute && role !== 'admin_staff' && role !== 'super_admin') ||
    (isSellerRoute && role !== 'seller') ||
    (isBuyerRoute && role !== 'buyer')
  );
};

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === '/' && (searchParams.has('code') || searchParams.has('error'))) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    return NextResponse.redirect(callbackUrl);
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (PUBLIC_PATHS.has(pathname)) return response;

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return withRefreshedCookies(NextResponse.redirect(loginUrl), response);
  }

  const normalizedEmail = user.email?.trim().toLowerCase() || '';
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_active === false && normalizedEmail !== ADMIN_EMAIL) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('error', 'account_inactive');
    return withRefreshedCookies(NextResponse.redirect(loginUrl), response);
  }

  const role =
    normalizedEmail === ADMIN_EMAIL
      ? 'super_admin'
      : profile?.role || user.app_metadata?.role || user.user_metadata?.role || 'buyer';

  if (AUTH_ENTRY_PATHS.has(pathname)) {
    return withRefreshedCookies(redirectToRoleHome(request, role), response);
  }

  if (PUBLIC_PATHS.has(pathname)) return response;

  if (isRoleMismatch(pathname, role)) {
    return withRefreshedCookies(redirectToRoleHome(request, role), response);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
