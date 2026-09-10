import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resend delivery webhooks.
 *
 * Until this existed, email_status 'sent' was the end of the story, and it only
 * ever meant Resend accepted the message. A mistyped buyer address bounces
 * moments later, and the invoice would read 'sent' permanently — a buyer who
 * never received their GST document looked exactly like one who did. These
 * events are the only way to tell the two apart.
 *
 * Resend signs with Svix. The signed payload is id.timestamp.body, so the raw
 * body must be read before anything parses it.
 */

/** Reject anything older than this so a captured request cannot be replayed. */
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

type ResendEvent = {
  type?: string;
  data?: { email_id?: string; to?: string[] | string; bounce?: { message?: string; type?: string } };
};

/**
 * How each provider event lands on the invoice.
 *
 * delivered/bounced/complained are all terminal and none of them appear in
 * retryUndeliveredInvoiceEmails, which is the point: re-sending a hard bounce
 * hurts domain reputation, and re-sending after a spam complaint is what gets a
 * sending domain blocked. A wrong address needs correcting, not retrying.
 *
 * email.sent, opened and clicked are deliberately absent. The first is already
 * recorded at the point of sending, and the other two say nothing about whether
 * delivery succeeded.
 */
const EVENT_STATUS: Record<string, 'delivered' | 'bounced' | 'complained'> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

/** Timing-safe compare that tolerates differing lengths without throwing. */
const signatureMatches = (expected: Buffer, supplied: Buffer) =>
  expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);

function verifySvixSignature(secret: string, id: string, timestamp: string, body: string, header: string) {
  // Svix secrets are 'whsec_' followed by the base64 key.
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  // The header carries a space-separated list so a secret can be rotated
  // without dropping events signed by the outgoing one.
  return header
    .split(' ')
    .map((part) => part.split(',', 2))
    .filter(([version]) => version === 'v1')
    .some(([, value]) => value && signatureMatches(expected, Buffer.from(value, 'base64')));
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });

  const id = request.headers.get('svix-id') || '';
  const timestamp = request.headers.get('svix-timestamp') || '';
  const signature = request.headers.get('svix-signature') || '';
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: 'Missing signature headers.' }, { status: 400 });
  }

  const sentAt = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_SIGNATURE_AGE_MS) {
    return NextResponse.json({ error: 'Signature timestamp is outside the accepted window.' }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!verifySvixSignature(secret, id, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const status = EVENT_STATUS[String(event.type || '')];
  const providerId = String(event.data?.email_id || '').trim();
  // Acknowledge events this route has no opinion on. A non-2xx would make Resend
  // retry an open, forever.
  if (!status || !providerId) return NextResponse.json({ received: true, ignored: true });

  const admin = createAdminClient();

  // Svix redelivers on any non-2xx, so the same bounce can arrive repeatedly.
  const idempotencyKey = `resend_${id}`;
  const { data: prior } = await admin
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (prior) return NextResponse.json({ received: true, duplicate: true });

  const bounceReason = event.data?.bounce?.message || event.data?.bounce?.type || null;
  const { data: updated, error } = await admin
    .from('seller_tax_invoices')
    .update({
      email_status: status,
      email_last_error: status === 'delivered' ? null : bounceReason || `Recipient reported ${status}.`,
      updated_at: new Date().toISOString(),
    })
    .eq('email_provider_id', providerId)
    // A later event must not overwrite a bounce with an earlier 'delivered'
    // that arrived out of order, and nothing here should touch an invoice the
    // cron is mid-send on.
    .in('email_status', ['sent', 'delivered'])
    .select('id,invoice_number')
    .maybeSingle();

  if (error) {
    console.error('Invoice delivery event could not be recorded', { providerId, status, message: error.message });
    // 500 asks Svix to redeliver, which is what a transient database failure wants.
    return NextResponse.json({ error: 'Could not record the delivery event.' }, { status: 500 });
  }

  await admin.from('webhook_events').insert({
    idempotency_key: idempotencyKey,
    source: 'resend',
    event_type: String(event.type),
    payload: event as unknown as Record<string, unknown>,
    processed_at: new Date().toISOString(),
  });

  if (updated && status !== 'delivered') {
    console.error('Invoice email did not reach the buyer', {
      invoiceNumber: updated.invoice_number,
      status,
      reason: bounceReason,
    });
  }

  return NextResponse.json({ received: true, matched: Boolean(updated) });
}
