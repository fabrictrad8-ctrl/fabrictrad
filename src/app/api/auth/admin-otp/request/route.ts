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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !publishableKey) {
    return noStoreJson(
      {
        error: 'Administrator email OTP is not configured in the application environment.',
        code: 'SUPABASE_PUBLIC_CONFIGURATION_MISSING',
      },
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
    const retryAfter = error.status === 429 ? 60 : undefined;
    console.error('Supabase administrator OTP request failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    return noStoreJson(
      {
        error:
          error.status === 429
            ? 'An administrator OTP was requested recently. Wait a minute and try again.'
            : /smtp|email|mailer/i.test(error.message)
              ? 'Supabase could not send the administrator OTP. Check Authentication → SMTP Settings.'
              : 'The administrator OTP could not be sent. Check Supabase Auth logs and try again.',
        code: error.status === 429 ? 'OTP_RATE_LIMITED' : 'OTP_SEND_FAILED',
        ...(retryAfter ? { retryAfter } : {}),
      },
      error.status === 429 ? 429 : 503,
      retryAfter ? { 'Retry-After': String(retryAfter) } : {}
    );
  }

  return noStoreJson({
    sent: true,
    method: 'email_otp',
    destination: email.replace(/^(.{2}).*(@.*)$/, '$1••••$2'),
  });
}
