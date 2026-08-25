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

const maskEmail = (email: string) =>
  email.replace(/^(.{2}).*(@.*)$/, '$1••••$2');

const acceptedResponse = (email: string) =>
  noStoreJson({
    sent: true,
    method: 'email_otp',
    destination: maskEmail(email),
  });

export async function POST(request: NextRequest) {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return noStoreJson({ error: 'Invalid request body.' }, 400);
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (!email || !email.includes('@')) {
    return noStoreJson({ error: 'Enter a valid email address.' }, 400);
  }

  // Administrator access remains isolated on /admin-login and does not use a password.
  // Keep the response non-enumerating rather than exposing whether this address is privileged.
  if (email === configuredAdminEmail()) {
    return acceptedResponse(email);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !publishableKey) {
    return noStoreJson(
      { error: 'Password recovery is not configured in the application environment.' },
      503
    );
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    if (error.status === 429) {
      return noStoreJson(
        {
          error: 'A password-reset OTP was requested recently. Wait a minute and try again.',
          retryAfter: 60,
        },
        429,
        { 'Retry-After': '60' }
      );
    }

    // Supabase intentionally obscures several account-existence cases. Preserve that behavior
    // so this public endpoint cannot be used to enumerate registered FabricTrad accounts.
    if (
      error.status === 400 ||
      error.status === 404 ||
      error.status === 422 ||
      /user.*not.*found|signups?.*not.*allowed|email.*not.*found/i.test(error.message)
    ) {
      return acceptedResponse(email);
    }

    console.error('Supabase password-reset OTP request failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    return noStoreJson(
      {
        error: /smtp|email|mailer/i.test(error.message)
          ? 'Supabase could not send the password-reset OTP. Check Authentication → SMTP Settings.' :'Password recovery is temporarily unavailable. Please try again shortly.',
      },
      503
    );
  }

  return acceptedResponse(email);
}
