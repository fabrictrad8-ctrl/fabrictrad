import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const EXPIRED_COOKIE = {
  path: '/',
  maxAge: 0,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function GET(request: NextRequest) {
  const destination = new URL('/login?logged_out=1', request.url);
  const response = NextResponse.redirect(destination, 303);

  response.cookies.set('fabrictrad_demo_role', '', { ...EXPIRED_COOKIE, httpOnly: true });
  response.cookies.set('fabrictrad_oauth_role', '', EXPIRED_COOKIE);

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

  return response;
}
