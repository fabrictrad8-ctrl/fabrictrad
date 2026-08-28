import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const EXPIRED_COOKIE = {
  path: '/',
  maxAge: 0,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

const expireKnownAuthCookies = (request: NextRequest, response: NextResponse) => {
  response.cookies.set('fabrictrad_oauth_role', '', EXPIRED_COOKIE);
  response.cookies.set('fabrictrad_buyer_type', '', EXPIRED_COOKIE);

  // Supabase SSR may split a large session across multiple sb-*-auth-token cookies.
  // Expire every matching cookie explicitly so an already-revoked refresh token
  // cannot survive logout and trigger refresh_token_not_found on the next page load.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')) {
      response.cookies.set(cookie.name, '', EXPIRED_COOKIE);
    }
  }
};

export async function GET(request: NextRequest) {
  const destination = new URL('/login?logged_out=1', request.url);
  const response = NextResponse.redirect(destination, 303);

  expireKnownAuthCookies(request, response);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return response;

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          });
        });
      },
    },
  });

  await Promise.race([
    supabase.auth.signOut({ scope: 'local' }),
    new Promise((resolve) => setTimeout(resolve, 1_500)),
  ]).catch(() => undefined);

  // signOut can fail when the refresh token is already revoked. Re-apply explicit
  // expiry after the attempt so stale auth cookies are still removed deterministically.
  expireKnownAuthCookies(request, response);

  return response;
}
