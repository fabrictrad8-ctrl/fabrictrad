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
    return noStoreJson({ error: 'Administrator email access is temporarily unavailable.' }, 503);
  }

  // Email-code authentication must never depend on the service-role secret.
  // The configured administrator is an existing, confirmed Supabase user and
  // shouldCreateUser=false prevents this public route from creating accounts.
  // Profile/role repair remains a separate trusted-server operation.
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const redirectBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${redirectBase}/admin-login`,
    },
  });

  if (error) {
    console.error('Administrator email-code request failed', {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    const message = /rate limit/i.test(error.message)
      ? 'Too many code requests. Please wait a few minutes and try again.'
      : /signup|not found|registered/i.test(error.message)
        ? 'The configured administrator account is not available. Contact the platform owner.'
        : 'The administrator code could not be sent. Please try again shortly.';
    return noStoreJson({ error: message }, error.status && error.status >= 400 ? error.status : 400);
  }

  return noStoreJson({
    sent: true,
    destination: email.replace(/^(.{2}).*(@.*)$/, '$1••••$2'),
  });
}
