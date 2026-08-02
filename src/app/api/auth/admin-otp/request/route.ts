import { NextRequest, NextResponse } from 'next/server';
import { configuredAdminEmail } from '@/lib/adminAccess';
import { normalizeEmail } from '@/lib/authValidation';
import {
  createAdminClient,
  SupabaseServerConfigurationError,
} from '@/lib/supabase/admin';
import {
  assertAuthEmailServerConfigured,
  AuthEmailConfigurationError,
  AuthEmailDeliveryError,
  claimAuthEmailDelivery,
  sendAdminOtpEmail,
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

  try {
    // Check both trusted services before consuming a delivery allowance.
    assertAuthEmailServerConfigured();
    const supabase = createAdminClient();

    const rateLimit = await claimAuthEmailDelivery(supabase, email, 'admin_otp');
    if (!rateLimit.allowed) {
      const message = rateLimit.reason === 'daily_limit'
        ? 'The daily administrator OTP limit has been reached. Try again tomorrow.'
        : `An OTP was requested recently. Wait ${rateLimit.retryAfter} seconds and try again.`;
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

    if (
      profileError ||
      !profile ||
      profile.is_active === false ||
      (profile.role !== 'admin_staff' && profile.role !== 'super_admin')
    ) {
      console.error('Configured administrator profile is unavailable', {
        code: profileError?.code,
        profilePresent: Boolean(profile),
      });
      return noStoreJson(
        { error: 'The configured administrator account is not available. Contact the platform owner.' },
        503
      );
    }

    // Admin generateLink creates the real Supabase one-time token without asking
    // Supabase's hosted mailer to send its locked magic-link template.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${request.nextUrl.origin}/admin-login`,
      },
    });

    if (error) throw error;

    const otp = data.properties?.email_otp;
    if (!otp || !/^\d{6}$/.test(otp)) {
      throw new AuthEmailDeliveryError('Supabase did not generate a valid administrator OTP.');
    }

    const delivery = await sendAdminOtpEmail(email, otp);

    return noStoreJson({
      sent: true,
      method: 'email_otp',
      destination: email.replace(/^(.{2}).*(@.*)$/, '$1••••$2'),
      deliveryId: delivery.id,
    });
  } catch (error: unknown) {
    if (error instanceof AuthEmailConfigurationError) {
      console.error('Administrator SMTP configuration is incomplete', {
        message: error.message,
      });
      return noStoreJson(
        {
          error: 'Administrator email delivery is not configured. Add a valid SMTP_PASS production secret.',
          code: 'SMTP_NOT_CONFIGURED',
        },
        503
      );
    }

    if (error instanceof SupabaseServerConfigurationError) {
      console.error('Administrator Supabase server configuration is incomplete', {
        message: error.message,
      });
      return noStoreJson(
        {
          error: 'Administrator OTP generation is not configured. Add the Supabase server secret in production.',
          code: 'SUPABASE_SERVER_SECRET_MISSING',
        },
        503
      );
    }

    if (error instanceof AuthEmailDeliveryError) {
      console.error('Administrator OTP email delivery failed', {
        status: error.providerStatus,
        smtpCode: error.smtpCode,
        message: error.message,
      });
      return noStoreJson(
        {
          error: 'The administrator OTP was generated but could not be emailed. Check the Resend SMTP key and delivery log.',
          code: 'SMTP_DELIVERY_FAILED',
        },
        error.providerStatus && error.providerStatus >= 500 ? 502 : 503
      );
    }

    const authError = error as { code?: string; status?: number; message?: string };
    console.error('Administrator OTP generation failed', {
      code: authError.code,
      status: authError.status,
      message: authError.message,
    });
    return noStoreJson(
      {
        error: 'The administrator OTP could not be generated. Check the Supabase server credentials and try again.',
        code: 'OTP_GENERATION_FAILED',
      },
      503
    );
  }
}
