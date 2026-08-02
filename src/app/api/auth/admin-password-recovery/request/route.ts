import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { configuredAdminEmail } from '@/lib/adminAccess';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStoreJson = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !publishableKey) {
    return noStoreJson({ error: 'Administrator password recovery is not configured.' }, 503);
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

  const { error } = await supabase.auth.resetPasswordForEmail(configuredAdminEmail(), {
    redirectTo: `${redirectBase}/auth/reset-password?admin=1`,
  });

  if (error) {
    const status = error.status === 429 ? 429 : 503;
    return noStoreJson(
      {
        error:
          status === 429
            ? 'A recovery email was requested recently. Please wait before trying again.'
            : 'The administrator recovery email could not be sent. Please try again shortly.',
      },
      status
    );
  }

  return noStoreJson({
    sent: true,
    method: 'supabase_password_recovery',
  });
}
