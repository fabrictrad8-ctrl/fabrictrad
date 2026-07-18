import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const parseGoogleClientId = (url: string) => {
  try {
    return new URL(url).searchParams.get('client_id');
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { origin } = new URL(request.url);

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      {
        configured: false,
        code: 'missing_supabase_env',
        message: 'Supabase URL or anon key is missing.',
      },
      { status: 503 }
    );
  }

  const normalizedSupabaseUrl = supabaseUrl.replace(/\/$/, '');
  const requiredRedirectUri = `${normalizedSupabaseUrl}/auth/v1/callback`;
  const authorizeUrl = new URL(`${requiredRedirectUri.replace('/callback', '/authorize')}`);
  authorizeUrl.searchParams.set('provider', 'google');
  authorizeUrl.searchParams.set('redirect_to', `${origin}/auth/callback?role=buyer`);

  try {
    const supabaseResponse = await fetch(authorizeUrl.toString(), {
      headers: { apikey: anonKey },
      redirect: 'manual',
      cache: 'no-store',
    });
    const googleLocation = supabaseResponse.headers.get('location');

    if (!googleLocation) {
      return NextResponse.json(
        {
          configured: false,
          code: 'google_provider_unavailable',
          message: 'Supabase did not return a Google OAuth redirect.',
          requiredRedirectUri,
        },
        { status: 503 }
      );
    }

    const googleResponse = await fetch(googleLocation, {
      redirect: 'follow',
      cache: 'no-store',
    });

    if (googleResponse.url.includes('/signin/oauth/error')) {
      const body = await googleResponse.text();
      const isRedirectMismatch =
        googleResponse.url.includes('redirect_uri_mismatch') ||
        body.includes('redirect_uri_mismatch');

      return NextResponse.json(
        {
          configured: false,
          code: isRedirectMismatch ? 'redirect_uri_mismatch' : 'google_oauth_error',
          googleClientId: parseGoogleClientId(googleLocation),
          requiredRedirectUri,
          message: isRedirectMismatch
            ? `Google OAuth is enabled in Supabase, but Google Cloud must allow this redirect URI: ${requiredRedirectUri}`
            : 'Google rejected the OAuth request.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      configured: true,
      googleClientId: parseGoogleClientId(googleLocation),
      requiredRedirectUri,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        code: 'oauth_status_check_failed',
        message: error instanceof Error ? error.message : 'Unable to verify Google OAuth.',
        requiredRedirectUri,
      },
      { status: 503 }
    );
  }
}
