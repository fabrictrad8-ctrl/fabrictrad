import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
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

  if (typeof body.email !== 'string') {
    return noStoreJson({ error: 'Email is required.' }, 400);
  }

  const email = normalizeEmail(body.email);
  if (!email || !email.includes('@')) {
    return noStoreJson({ error: 'Enter a valid email address.' }, 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    return noStoreJson(
      { error: 'Password recovery is temporarily unavailable. Please contact FabricTrad support.' },
      503
    );
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const redirectBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${redirectBase}/auth/reset-password`,
  });

  if (error) {
    const rawMessage = error.message || 'Unable to send the password reset email.';
    const message = /rate limit|security purposes/i.test(rawMessage)
      ? 'A reset email was requested recently. Please wait about one minute and try again.'
      : 'The password reset email could not be sent. Please try again shortly.';
    return noStoreJson({ error: message }, error.status && error.status >= 400 ? error.status : 400);
  }

  // Keep the response non-enumerating: Supabase intentionally does not reveal
  // whether an address belongs to an account.
  return noStoreJson({
    sent: true,
    method: 'password_recovery',
  });
}
