import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';
const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';

const PUBLIC_PATHS = new Set([
  '/', '/login', '/register', '/buyer-registration', '/seller-registration', '/auth/callback',
]);
const AUTH_ENTRY_PATHS = new Set(['/', '/login', '/register', '/buyer-registration']);

const withRefreshedCookies = (target: NextResponse, source: NextResponse) => {
  source.cookies.getAll().forEach(({ name, value }) => target.cookies.set(name, value));
  return target;
};

const redirect = (request: NextRequest, pathname: string) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
};

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === '/' && (searchParams.has('code') || searchParams.has('error'))) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    return NextResponse.redirect(callbackUrl);
  }

  const demoCookieValue = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  const demoRole = demoCookieValue === 'buyer' || demoCookieValue === 'seller' ? demoCookieValue : null;
  if (demoRole) {
    const canBuy = true;
    const canSell = demoRole === 'seller';
    if (AUTH_ENTRY_PATHS.has(pathname)) return redirect(request, '/marketplace');
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

  const { data: { user } } = await supabase.auth.getUser();
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
    .select('role,is_active,can_buy,can_sell')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_active === false && normalizedEmail !== ADMIN_EMAIL) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('error', 'account_inactive');
    return withRefreshedCookies(NextResponse.redirect(loginUrl), response);
  }

  const role = normalizedEmail === ADMIN_EMAIL
    ? 'super_admin'
    : profile?.role || user.app_metadata?.role || user.user_metadata?.role || 'buyer';
  const isAdmin = role === 'admin_staff' || role === 'super_admin';
  const canBuy = !isAdmin && (profile?.can_buy ?? true);
  const canSell = !isAdmin && (profile?.can_sell ?? role === 'seller');

  if (AUTH_ENTRY_PATHS.has(pathname)) {
    return withRefreshedCookies(redirect(request, isAdmin ? '/admin-portal' : '/marketplace'), response);
  }
  if (pathname.startsWith('/admin-portal') && !isAdmin) {
    return withRefreshedCookies(redirect(request, '/marketplace'), response);
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
