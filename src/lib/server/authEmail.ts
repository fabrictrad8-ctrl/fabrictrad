import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthEmailPurpose = 'admin_otp' | 'password_recovery';

type RateLimitResult = {
  allowed?: boolean;
  reason?: 'accepted' | 'cooldown' | 'daily_limit';
  retryAfter?: number;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencySeed: string;
};

export class AuthEmailConfigurationError extends Error {
  constructor(message = 'The FabricTrad email server is not configured.') {
    super(message);
    this.name = 'AuthEmailConfigurationError';
  }
}

export class AuthEmailDeliveryError extends Error {
  readonly providerStatus?: number;

  constructor(message = 'The authentication email could not be delivered.', providerStatus?: number) {
    super(message);
    this.name = 'AuthEmailDeliveryError';
    this.providerStatus = providerStatus;
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] || character;
  });

const emailConfiguration = () => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.FABRICTRAD_AUTH_EMAIL_FROM?.trim();
  const replyTo = process.env.FABRICTRAD_AUTH_EMAIL_REPLY_TO?.trim();

  if (!apiKey || !from) {
    throw new AuthEmailConfigurationError();
  }

  return { apiKey, from, replyTo };
};

export const assertAuthEmailServerConfigured = () => {
  emailConfiguration();
};

const brandedEmail = (content: string) => `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0d1117;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d1117;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#151a21;border:1px solid #2c3440;border-radius:22px;overflow:hidden;">
            <tr>
              <td style="padding:26px 30px;border-bottom:1px solid #2c3440;">
                <div style="font-size:22px;font-weight:800;color:#ffffff;">FabricTrad</div>
                <div style="margin-top:5px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#fb923c;">Secure account email</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;line-height:1.65;color:#cbd5e1;">${content}</td>
            </tr>
            <tr>
              <td style="padding:20px 30px;border-top:1px solid #2c3440;font-size:12px;line-height:1.6;color:#7f8a9a;">
                This automated security email was requested from FabricTrad. Never share an administrator code or password-reset link with anyone.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const sendEmail = async ({ to, subject, html, text, idempotencySeed }: SendEmailInput) => {
  const { apiKey, from, replyTo } = emailConfiguration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const idempotencyKey = `fabrictrad-auth-${createHash('sha256')
    .update(idempotencySeed)
    .digest('hex')
    .slice(0, 48)}`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };

    if (!response.ok || !payload.id) {
      console.error('Resend authentication email delivery failed', {
        status: response.status,
        providerError: payload.name || payload.message || 'unknown_error',
      });
      throw new AuthEmailDeliveryError(
        'The FabricTrad email server rejected the message.',
        response.status
      );
    }

    return { id: payload.id };
  } catch (error: unknown) {
    if (error instanceof AuthEmailDeliveryError || error instanceof AuthEmailConfigurationError) {
      throw error;
    }
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'The FabricTrad email server timed out.'
      : 'The FabricTrad email server could not be reached.';
    throw new AuthEmailDeliveryError(message);
  } finally {
    clearTimeout(timeout);
  }
};

export const claimAuthEmailDelivery = async (
  supabase: SupabaseClient,
  email: string,
  purpose: AuthEmailPurpose
): Promise<Required<RateLimitResult>> => {
  const policy = purpose === 'admin_otp'
    ? { cooldown: 60, dailyLimit: 20 }
    : { cooldown: 60, dailyLimit: 5 };

  const { data, error } = await supabase.rpc('claim_auth_email_delivery', {
    p_email: email,
    p_purpose: purpose,
    p_cooldown_seconds: policy.cooldown,
    p_daily_limit: policy.dailyLimit,
  });

  if (error) {
    console.error('Authentication email rate-limit check failed', {
      purpose,
      code: error.code,
      message: error.message,
    });
    throw new AuthEmailDeliveryError('The authentication email service is temporarily unavailable.');
  }

  const result = (data || {}) as RateLimitResult;
  return {
    allowed: result.allowed === true,
    reason: result.reason || 'cooldown',
    retryAfter: Math.max(1, Number(result.retryAfter) || policy.cooldown),
  };
};

export const sendAdminOtpEmail = async (email: string, otp: string) => {
  const safeOtp = escapeHtml(otp);
  const html = brandedEmail(`
    <h1 style="margin:0 0 14px;font-size:25px;line-height:1.25;color:#ffffff;">Your administrator sign-in code</h1>
    <p style="margin:0 0 22px;">Enter this one-time code on the FabricTrad administrator login page:</p>
    <div style="margin:0 0 22px;padding:18px;text-align:center;border:1px solid #f97316;border-radius:14px;background:#201812;font-size:34px;font-weight:800;letter-spacing:.28em;color:#fdba74;">${safeOtp}</div>
    <p style="margin:0;">The code expires shortly and can be used only once. Ignore this email when you did not request administrator access.</p>
  `);

  return sendEmail({
    to: email,
    subject: 'Your FabricTrad administrator code',
    html,
    text: `Your FabricTrad administrator sign-in code is ${otp}. It expires shortly and can be used only once.`,
    idempotencySeed: `admin-otp:${email}:${otp}`,
  });
};

export const sendPasswordRecoveryEmail = async (email: string, actionLink: string) => {
  const safeLink = escapeHtml(actionLink);
  const html = brandedEmail(`
    <h1 style="margin:0 0 14px;font-size:25px;line-height:1.25;color:#ffffff;">Reset your FabricTrad password</h1>
    <p style="margin:0 0 22px;">A password reset was requested for this FabricTrad account. The button below opens the secure new-password screen; it does not sign you into the marketplace.</p>
    <p style="margin:0 0 22px;">
      <a href="${safeLink}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#c65330;color:#ffffff;text-decoration:none;font-weight:700;">Choose a new password</a>
    </p>
    <p style="margin:0 0 12px;">This link expires shortly and can be used only once.</p>
    <p style="margin:0;font-size:12px;word-break:break-all;color:#94a3b8;">${safeLink}</p>
  `);

  return sendEmail({
    to: email,
    subject: 'Reset your FabricTrad password',
    html,
    text: `Reset your FabricTrad password using this one-time link: ${actionLink}\n\nThis link does not sign you into the marketplace and expires shortly.`,
    idempotencySeed: `password-recovery:${email}:${actionLink}`,
  });
};
