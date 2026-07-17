import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ─── Supabase REST helper (no SDK dependency) ───────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function supabaseQuery(path: string, method: string, body?: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${err}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Exponential backoff retry ───────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 200
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ─── Dead-letter queue: persist failed events ────────────────────────────────
async function sendToDeadLetterQueue(
  idempotencyKey: string,
  eventType: string,
  payload: unknown,
  error: string
) {
  try {
    await supabaseQuery('webhook_dead_letter_queue', 'POST', {
      idempotency_key: idempotencyKey,
      source: 'razorpay',
      event_type: eventType,
      payload,
      error_message: error,
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch (dlqErr) {
    console.error('[Razorpay Webhook] DLQ write failed:', dlqErr);
  }
}

// ─── Idempotency check ───────────────────────────────────────────────────────
async function isAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
  try {
    const rows = await supabaseQuery(
      `webhook_events?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id`,
      'GET'
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false; // fail open — process the event
  }
}

async function markProcessed(idempotencyKey: string, eventType: string, payload: unknown) {
  try {
    await supabaseQuery('webhook_events', 'POST', {
      idempotency_key: idempotencyKey,
      source: 'razorpay',
      event_type: eventType,
      payload,
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Razorpay Webhook] markProcessed failed:', err);
  }
}

// ─── Business logic handlers ─────────────────────────────────────────────────
async function handlePaymentCaptured(paymentEntity: Record<string, unknown>) {
  const orderId = paymentEntity?.order_id as string;
  const paymentId = paymentEntity?.id as string;
  const amount = (paymentEntity?.amount as number) / 100;

  await withRetry(() =>
    supabaseQuery(`orders?razorpay_order_id=eq.${orderId}`, 'PATCH', {
      payment_status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  );

  await withRetry(() =>
    supabaseQuery('payment_ledger', 'POST', {
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      amount,
      event_type: 'payment.captured',
      status: 'captured',
      recorded_at: new Date().toISOString(),
    })
  );

  console.log(`[Razorpay Webhook] ✅ payment.captured: ${paymentId} for order ${orderId}`);
}

async function handlePaymentFailed(paymentEntity: Record<string, unknown>) {
  const orderId = paymentEntity?.order_id as string;
  const paymentId = paymentEntity?.id as string;
  const errorDesc = (paymentEntity?.error_description as string) || 'Payment failed';

  await withRetry(() =>
    supabaseQuery(`orders?razorpay_order_id=eq.${orderId}`, 'PATCH', {
      payment_status: 'failed',
      failure_reason: errorDesc,
      updated_at: new Date().toISOString(),
    })
  );

  console.log(`[Razorpay Webhook] ❌ payment.failed: ${paymentId} — ${errorDesc}`);
}

async function handleRefundProcessed(refundEntity: Record<string, unknown>) {
  const refundId = refundEntity?.id as string;
  const paymentId = refundEntity?.payment_id as string;
  const amount = (refundEntity?.amount as number) / 100;

  await withRetry(() =>
    supabaseQuery('payment_ledger', 'POST', {
      razorpay_payment_id: paymentId,
      razorpay_refund_id: refundId,
      amount,
      event_type: 'refund.processed',
      status: 'refunded',
      recorded_at: new Date().toISOString(),
    })
  );

  console.log(`[Razorpay Webhook] 🔄 refund.processed: ${refundId}`);
}

async function handleTransferProcessed(transferEntity: Record<string, unknown>) {
  const transferId = transferEntity?.id as string;
  const linkedAccountId = transferEntity?.recipient as string;
  const amount = (transferEntity?.amount as number) / 100;

  await withRetry(() =>
    supabaseQuery(
      `seller_profiles?razorpay_linked_account_id=eq.${linkedAccountId}`,
      'PATCH',
      {
        last_transfer_id: transferId,
        last_transfer_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    )
  );

  await withRetry(() =>
    supabaseQuery('payment_ledger', 'POST', {
      razorpay_transfer_id: transferId,
      amount,
      event_type: 'transfer.processed',
      status: 'transferred',
      recorded_at: new Date().toISOString(),
    })
  );

  console.log(`[Razorpay Webhook] 💸 transfer.processed: ${transferId} → ${linkedAccountId}`);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  // 1. Verify signature
  if (webhookSecret) {
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    try {
      if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Signature comparison failed' }, { status: 400 });
    }
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.event as string;
  const paymentEntity = (event?.payload as Record<string, unknown>)?.payment as Record<string, unknown>;
  const refundEntity = (event?.payload as Record<string, unknown>)?.refund as Record<string, unknown>;
  const transferEntity = (event?.payload as Record<string, unknown>)?.transfer as Record<string, unknown>;

  // 2. Build idempotency key from event ID or content hash
  const eventId = (event.id as string) || crypto.createHash('sha256').update(body).digest('hex').slice(0, 32);
  const idempotencyKey = `rzp_${eventId}`;

  // 3. Idempotency check — skip if already processed
  const alreadyDone = await isAlreadyProcessed(idempotencyKey);
  if (alreadyDone) {
    console.log(`[Razorpay Webhook] ⏭ Duplicate event skipped: ${idempotencyKey}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  // 4. Process event with retry + DLQ fallback
  try {
    switch (eventType) {
      case 'payment.captured':
        await withRetry(() => handlePaymentCaptured(paymentEntity?.entity as Record<string, unknown> || paymentEntity || {}));
        break;
      case 'payment.failed':
        await withRetry(() => handlePaymentFailed(paymentEntity?.entity as Record<string, unknown> || paymentEntity || {}));
        break;
      case 'refund.processed':
        await withRetry(() => handleRefundProcessed(refundEntity?.entity as Record<string, unknown> || refundEntity || {}));
        break;
      case 'transfer.processed':
        await withRetry(() => handleTransferProcessed(transferEntity?.entity as Record<string, unknown> || transferEntity || {}));
        break;
      default:
        console.log(`[Razorpay Webhook] ℹ Unhandled event: ${eventType}`);
    }

    // 5. Mark as processed (idempotency record)
    await markProcessed(idempotencyKey, eventType, event);
    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Razorpay Webhook] ❌ All retries exhausted for ${eventType}:`, errMsg);

    // 6. Send to dead-letter queue
    await sendToDeadLetterQueue(idempotencyKey, eventType, event, errMsg);

    // Return 200 to prevent Razorpay from retrying (we handle retries ourselves)
    return NextResponse.json({ received: true, queued_for_retry: true });
  }
}
