import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { configuredAdminEmail } from '@/lib/adminAccess';
import { normalizeEmail } from '@/lib/authValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStoreJson = (
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {}
) =>
  NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      ...headers,
    },
  });

const acceptedResponse = () =>
  noStoreJson({
    sent: true,
    method: 'password_recovery',
  });

export async function POST(request: NextRequest) {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return noStoreJson({ error: 'Invalid request body.' }, 400);
  }

  if (typeof body.email !== 'string') {
    return noStoreJson({ error: 'Email is required.' }, 400);
  }

  const email = normalizeEmail(body.email);
  if (!email || !email.includes('@')) {
    return noStoreJson({ error: 'Enter a valid email address.' }, 400);
  }

  // Administrator access is intentionally isolated on /admin-login.
  if (email === configuredAdminEmail()) {
    return acceptedResponse();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !publishableKey) {
    return noStoreJson(
      { error: 'Password recovery is not configured in the application environment.' },
      503
    );
  }

  const redirectBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin;

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${redirectBase}/auth/reset-password`,
  });

  if (error) {
    if (error.status === 429) {
      return noStoreJson(
        {
          error: 'A password-reset email was requested recently. Wait a minute and try again.',
          retryAfter: 60,
        },
        429,
        { 'Retry-After': '60' }
      );
    }

    console.error('Supabase password-recovery request failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    return noStoreJson(
      {
        error: /smtp|email|mailer/i.test(error.message)
          ? 'Supabase could not send the password-reset email. Check Authentication → SMTP Settings.' :'Password recovery is temporarily unavailable. Please try again shortly.',
      },
      503
    );
  }

  // Keep this response non-enumerating whether or not the account exists.
  return acceptedResponse();
}
