import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const getSiteOrigin = (request: NextRequest) => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured && !configured.includes('localhost')) return configured;

  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === 'fabrictrad.com' || requestUrl.hostname === 'www.fabrictrad.com') {
    return 'https://fabrictrad.com';
  }

  return requestUrl.origin;
};

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const roleParam = request.nextUrl.searchParams.get('role');
  const role = roleParam === 'seller' ? 'seller' : 'buyer';

  if (!supabaseUrl) {
    const loginUrl = new URL('/login', getSiteOrigin(request));
    loginUrl.searchParams.set('error', 'missing_supabase_env');
    return NextResponse.redirect(loginUrl);
  }

  const siteOrigin = getSiteOrigin(request);
  const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);
  authorizeUrl.searchParams.set('provider', 'google');
  authorizeUrl.searchParams.set('redirect_to', `${siteOrigin}/auth/callback?role=${role}`);
  authorizeUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set('fabrictrad_oauth_role', role, {
    path: '/',
    maxAge: 600,
    sameSite: 'lax',
    secure: siteOrigin.startsWith('https://'),
  });

  return response;
}
