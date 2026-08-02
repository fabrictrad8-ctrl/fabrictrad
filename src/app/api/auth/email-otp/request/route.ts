import { NextRequest, NextResponse } from 'next/server';
import { configuredAdminEmail } from '@/lib/adminAccess';
import { normalizeEmail } from '@/lib/authValidation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  assertAuthEmailServerConfigured,
  AuthEmailConfigurationError,
  AuthEmailDeliveryError,
  claimAuthEmailDelivery,
  sendPasswordRecoveryEmail,
} from '@/lib/server/authEmail';

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

  try {
    // Check global configuration before account lookup so the response does not
    // reveal whether a submitted address belongs to a FabricTrad account.
    assertAuthEmailServerConfigured();

    const supabase = createAdminClient();
    const rateLimit = await claimAuthEmailDelivery(supabase, email, 'password_recovery');
    if (!rateLimit.allowed) {
      const message = rateLimit.reason === 'daily_limit'
        ? 'The daily password-recovery limit has been reached. Try again tomorrow.'
        : `A reset email was requested recently. Wait ${rateLimit.retryAfter} seconds and try again.`;
      return noStoreJson(
        { error: message, retryAfter: rateLimit.retryAfter },
        429,
        { 'Retry-After': String(rateLimit.retryAfter) }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role,is_active')
      .eq('email', email)
      .maybeSingle();

    // Keep the response deliberately non-enumerating. Administrator access uses
    // its dedicated OTP page and inactive or unknown accounts receive no email.
    if (
      profileError ||
      !profile ||
      profile.is_active === false ||
      profile.role === 'admin_staff' ||
      profile.role === 'super_admin' ||
      email === configuredAdminEmail()
    ) {
      if (profileError) {
        console.error('Password-recovery profile lookup failed', { code: profileError.code });
      }
      return acceptedResponse();
    }

    const redirectBase =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || request.nextUrl.origin;

    // Generate the one-time Supabase recovery link without using Supabase's
    // hosted mail template. FabricTrad's own email server delivers the message.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${redirectBase}/auth/reset-password`,
      },
    });

    if (error) {
      if (/not found|does not exist|registered/i.test(error.message)) {
        return acceptedResponse();
      }
      throw error;
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink || !actionLink.startsWith('https://')) {
      throw new AuthEmailDeliveryError('Supabase did not generate a valid recovery link.');
    }

    await sendPasswordRecoveryEmail(email, actionLink);
    return acceptedResponse();
  } catch (error: unknown) {
    if (error instanceof AuthEmailConfigurationError) {
      return noStoreJson(
        { error: 'Password-recovery email delivery is not configured yet.' },
        503
      );
    }

    if (error instanceof AuthEmailDeliveryError) {
      console.error('Password-recovery email delivery failed', {
        status: error.providerStatus,
        message: error.message,
      });
      return noStoreJson(
        { error: 'The password-reset email could not be delivered. Please try again shortly.' },
        error.providerStatus && error.providerStatus >= 500 ? 502 : 503
      );
    }

    const authError = error as { code?: string; status?: number; message?: string };
    console.error('Password-recovery link generation failed', {
      code: authError.code,
      status: authError.status,
      message: authError.message,
    });
    return noStoreJson(
      { error: 'Password recovery is temporarily unavailable. Please try again shortly.' },
      503
    );
  }
}
