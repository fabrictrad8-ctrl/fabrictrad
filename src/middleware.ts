import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/buyer-registration',
  '/seller-registration',
  '/admin-login',
  '/auth/callback',
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

  if (PUBLIC_PATHS.has(pathname)) {
    return response;
  }

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return withRefreshedCookies(NextResponse.redirect(loginUrl), response);
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role || user.app_metadata?.role || user.user_metadata?.role;
  const destination = roleDestination(role);

  const isAdminRoute = pathname.startsWith('/admin-portal');
  const isSellerRoute = pathname.startsWith('/seller-dashboard');
  const isBuyerRoute =
    pathname.startsWith('/buyer-dashboard') || pathname.startsWith('/buyer-requirements');

  const roleMismatch =
    (isAdminRoute && role !== 'admin_staff' && role !== 'super_admin') ||
    (isSellerRoute && role !== 'seller') ||
    (isBuyerRoute && role !== 'buyer');

  if (roleMismatch) {
    const destinationUrl = request.nextUrl.clone();
    destinationUrl.pathname = destination;
    destinationUrl.search = '';
    return withRefreshedCookies(NextResponse.redirect(destinationUrl), response);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
