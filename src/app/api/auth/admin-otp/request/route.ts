import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { configuredAdminEmail } from '@/lib/adminAccess';
import { normalizeEmail } from '@/lib/authValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStoreJson = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function POST(request: NextRequest) {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return noStoreJson({ error: 'Invalid request body.' }, 400);
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (!email || email !== configuredAdminEmail()) {
    return noStoreJson({ error: 'Use the configured FabricTrad administrator email.' }, 403);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) {
    return noStoreJson({ error: 'Administrator email OTP is temporarily unavailable.' }, 503);
  }

  // The configured Supabase Magic Link / OTP template contains {{ .Token }}, so
  // signInWithOtp sends a six-digit email OTP. This endpoint never creates users
  // and remains restricted to the configured administrator address.
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
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
    console.error('Administrator email OTP request failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    const message = /rate limit|security purposes/i.test(error.message)
      ? 'An OTP was requested recently. Wait about one minute, then request a new code.'
      : /signup|not found|registered/i.test(error.message)
        ? 'The configured administrator account is not available. Contact the platform owner.'
        : 'The administrator email OTP could not be sent. Please try again shortly.';
    return noStoreJson({ error: message }, error.status && error.status >= 400 ? error.status : 400);
  }

  return noStoreJson({
    sent: true,
    method: 'email_otp',
    destination: email.replace(/^(.{2}).*(@.*)$/, '$1••••$2'),
  });
}
