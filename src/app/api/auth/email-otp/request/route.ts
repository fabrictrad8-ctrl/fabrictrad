import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ensureConfiguredAdminAccount, isConfiguredAdminEmail } from '@/lib/adminAccess';
import { normalizeEmail } from '@/lib/authValidation';

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

  try {
    if (isConfiguredAdminEmail(email)) {
      await ensureConfiguredAdminAccount(email);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      throw new Error('Authentication is not configured.');
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const redirectBase =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${redirectBase}/auth/callback`,
      },
    });

    if (error) throw error;

    return noStoreJson({ sent: true });
  } catch (caughtError: unknown) {
    const message = caughtError instanceof Error ? caughtError.message : 'Unable to send the sign-in code.';
    return noStoreJson({ error: message }, 400);
  }
}
