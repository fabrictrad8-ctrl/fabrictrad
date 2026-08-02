import { createHash, randomUUID } from 'node:crypto';
import { connect, type TLSSocket } from 'node:tls';
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

type SmtpConfiguration = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  fromAddress: string;
  replyTo?: string;
  ehloName: string;
};

type SmtpResponse = {
  code: number;
  lines: string[];
};

export class AuthEmailConfigurationError extends Error {
  constructor(message = 'The FabricTrad SMTP server is not configured.') {
    super(message);
    this.name = 'AuthEmailConfigurationError';
  }
}

export class AuthEmailDeliveryError extends Error {
  readonly providerStatus?: number;
  readonly smtpCode?: number;

  constructor(
    message = 'The authentication email could not be delivered.',
    providerStatus?: number,
    smtpCode?: number
  ) {
    super(message);
    this.name = 'AuthEmailDeliveryError';
    this.providerStatus = providerStatus;
    this.smtpCode = smtpCode;
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

const singleLineHeader = (value: string, field: string) => {
  const normalized = value.trim();
  if (!normalized || /[\r\n]/.test(normalized)) {
    throw new AuthEmailConfigurationError(`Invalid ${field} email configuration.`);
  }
  return normalized;
};

const extractMailbox = (value: string) => {
  const bracketed = value.match(/<([^<>]+)>/);
  const mailbox = (bracketed?.[1] || value).trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(mailbox)) {
    throw new AuthEmailConfigurationError('FABRICTRAD_AUTH_EMAIL_FROM must contain a valid email address.');
  }
  return mailbox;
};

const emailConfiguration = (): SmtpConfiguration => {
  // RESEND_API_KEY remains a convenient compatibility option, but delivery is
  // still performed over Resend's authenticated SMTP endpoint rather than its
  // HTTP API. Explicit SMTP_* settings take precedence and also support
  // Cloudflare Email Service, Google Workspace, SES, Postmark and similar hosts.
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const host = process.env.SMTP_HOST?.trim() || (resendKey ? 'smtp.resend.com' : '');
  const portValue = process.env.SMTP_PORT?.trim() || '465';
  const user = process.env.SMTP_USER?.trim() || (resendKey ? 'resend' : '');
  const password = process.env.SMTP_PASS?.trim() || resendKey || '';
  const from = process.env.FABRICTRAD_AUTH_EMAIL_FROM?.trim() || '';
  const replyTo = process.env.FABRICTRAD_AUTH_EMAIL_REPLY_TO?.trim();
  const ehloName = process.env.SMTP_EHLO_NAME?.trim() || 'fabrictrad.com';
  const port = Number(portValue);

  if (!host || !user || !password || !from) {
    throw new AuthEmailConfigurationError();
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AuthEmailConfigurationError('SMTP_PORT must be a valid TCP port.');
  }
  // The Worker deliberately uses implicit TLS. Cloudflare Email Service and
  // Resend both support port 465, avoiding plaintext SMTP and STARTTLS downgrade
  // mistakes in production authentication mail.
  if (port !== 465 && port !== 2465) {
    throw new AuthEmailConfigurationError('FabricTrad authentication SMTP requires implicit TLS on port 465 or 2465.');
  }
  if (!/^[a-z0-9.-]+$/i.test(host) || !/^[a-z0-9.-]+$/i.test(ehloName)) {
    throw new AuthEmailConfigurationError('Invalid SMTP host configuration.');
  }

  return {
    host,
    port,
    user: singleLineHeader(user, 'SMTP user'),
    password: singleLineHeader(password, 'SMTP password'),
    from: singleLineHeader(from, 'sender'),
    fromAddress: extractMailbox(from),
    replyTo: replyTo ? singleLineHeader(replyTo, 'reply-to') : undefined,
    ehloName,
  };
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

const wrapBase64 = (value: string) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .match(/.{1,76}/g)
    ?.join('\r\n') || '';

const buildMimeMessage = (
  input: SendEmailInput,
  config: SmtpConfiguration,
  messageId: string
) => {
  const to = singleLineHeader(input.to, 'recipient');
  const subject = singleLineHeader(input.subject, 'subject');
  const boundary = `fabrictrad_${randomUUID().replace(/-/g, '')}`;
  const headers = [
    `From: ${config.from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}@fabrictrad.com>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    'X-Auto-Response-Suppress: All',
    'Auto-Submitted: auto-generated',
    `X-Entity-Ref-ID: ${messageId}`,
  ];
  if (config.replyTo) headers.splice(3, 0, `Reply-To: ${config.replyTo}`);

  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(input.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(input.html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
};

const smtpSession = (socket: TLSSocket) => {
  let buffer = '';
  let responseLines: string[] = [];
  const queued: SmtpResponse[] = [];
  const waiting: Array<{
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  const rejectAll = (error: Error) => {
    while (waiting.length) {
      const waiter = waiting.shift();
      if (!waiter) continue;
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  };

  const publish = (response: SmtpResponse) => {
    const waiter = waiting.shift();
    if (!waiter) {
      queued.push(response);
      return;
    }
    clearTimeout(waiter.timer);
    waiter.resolve(response);
  };

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let boundary = buffer.indexOf('\r\n');
    while (boundary >= 0) {
      const line = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      responseLines.push(line);
      const complete = /^(\d{3}) /.exec(line);
      if (complete) {
        publish({ code: Number(complete[1]), lines: responseLines });
        responseLines = [];
      }
      boundary = buffer.indexOf('\r\n');
    }
  });
  socket.on('error', (error) => rejectAll(error));
  socket.on('close', () => rejectAll(new Error('SMTP connection closed unexpectedly.')));

  const nextResponse = async (allowedCodes: number[], timeoutMs = 12_000) => {
    const response = queued.shift() || await new Promise<SmtpResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = waiting.findIndex((entry) => entry.resolve === resolve);
        if (index >= 0) waiting.splice(index, 1);
        reject(new Error('SMTP server response timed out.'));
      }, timeoutMs);
      waiting.push({ resolve, reject, timer });
    });

    if (!allowedCodes.includes(response.code)) {
      const safeMessage = response.lines.join(' ').replace(/[\r\n]/g, ' ').slice(0, 300);
      throw new AuthEmailDeliveryError(
        `SMTP server rejected the message (${response.code}: ${safeMessage}).`,
        502,
        response.code
      );
    }
    return response;
  };

  const command = async (value: string, allowedCodes: number[]) => {
    socket.write(`${value}\r\n`);
    return nextResponse(allowedCodes);
  };

  return { nextResponse, command, rejectAll };
};

const sendEmail = async (input: SendEmailInput) => {
  const config = emailConfiguration();
  const recipient = singleLineHeader(input.to, 'recipient').toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)) {
    throw new AuthEmailDeliveryError('The recipient email address is invalid.');
  }

  const messageId = createHash('sha256')
    .update(`${input.idempotencySeed}:${Date.now()}:${randomUUID()}`)
    .digest('hex')
    .slice(0, 40);
  const message = buildMimeMessage(input, config, messageId);
  const socket = connect({
    host: config.host,
    port: config.port,
    servername: config.host,
  });
  const session = smtpSession(socket);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SMTP TLS connection timed out.')), 12_000);
      socket.once('secureConnect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    await session.nextResponse([220]);
    await session.command(`EHLO ${config.ehloName}`, [250]);
    await session.command('AUTH LOGIN', [334]);
    await session.command(Buffer.from(config.user, 'utf8').toString('base64'), [334]);
    await session.command(Buffer.from(config.password, 'utf8').toString('base64'), [235]);
    await session.command(`MAIL FROM:<${config.fromAddress}>`, [250]);
    await session.command(`RCPT TO:<${recipient}>`, [250, 251]);
    await session.command('DATA', [354]);

    const dotStuffed = message.replace(/^\./gm, '..');
    socket.write(`${dotStuffed}\r\n.\r\n`);
    await session.nextResponse([250], 20_000);
    await session.command('QUIT', [221]).catch(() => undefined);
    socket.end();

    return { id: messageId };
  } catch (error: unknown) {
    socket.destroy();
    if (error instanceof AuthEmailDeliveryError || error instanceof AuthEmailConfigurationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown SMTP error.';
    console.error('FabricTrad authentication SMTP delivery failed', {
      host: config.host,
      port: config.port,
      message,
    });
    throw new AuthEmailDeliveryError('The FabricTrad SMTP server could not deliver the message.', 502);
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
