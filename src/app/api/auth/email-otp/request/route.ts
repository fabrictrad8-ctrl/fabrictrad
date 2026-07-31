import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return noStoreJson(
      { error: 'Password recovery is temporarily unavailable. Please contact FabricTrad support.' },
      503
    );
  }

  try {
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
    const message = caughtError instanceof Error ? caughtError.message : '';
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('rate limit')) {
      return noStoreJson({ error: 'Please wait a minute before requesting another code.' }, 429);
    }

    return noStoreJson(
      { error: 'We could not send the reset code. Confirm the email address and try again.' },
      400
    );
  }
}
