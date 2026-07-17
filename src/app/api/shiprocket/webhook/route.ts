import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

// ─── Dead-letter queue ───────────────────────────────────────────────────────
async function sendToDeadLetterQueue(
  idempotencyKey: string,
  eventType: string,
  payload: unknown,
  error: string
) {
  try {
    await supabaseQuery('webhook_dead_letter_queue', 'POST', {
      idempotency_key: idempotencyKey,
      source: 'shiprocket',
      event_type: eventType,
      payload,
      error_message: error,
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch (dlqErr) {
    console.error('[Shiprocket Webhook] DLQ write failed:', dlqErr);
  }
}

// ─── Idempotency ─────────────────────────────────────────────────────────────
async function isAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
  try {
    const rows = await supabaseQuery(
      `webhook_events?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id`,
      'GET'
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function markProcessed(idempotencyKey: string, eventType: string, payload: unknown) {
  try {
    await supabaseQuery('webhook_events', 'POST', {
      idempotency_key: idempotencyKey,
      source: 'shiprocket',
      event_type: eventType,
      payload,
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Shiprocket Webhook] markProcessed failed:', err);
  }
}

// ─── Status normalizer ───────────────────────────────────────────────────────
function normalizeStatus(shiprocketStatus: string): string {
  const statusMap: Record<string, string> = {
    NEW: 'Order Created',
    'PICKUP PENDING': 'Pickup Scheduled',
    'PICKUP QUEUED': 'Pickup Scheduled',
    'PICKED UP': 'Picked Up',
    'IN TRANSIT': 'In Transit',
    'OUT FOR DELIVERY': 'Out for Delivery',
    DELIVERED: 'Delivered',
    'DELIVERY FAILED': 'Delivery Attempt Failed',
    UNDELIVERED: 'Delivery Attempt Failed',
    DELAYED: 'Delayed',
    RETURNED: 'Returned to Origin',
    'RTO INITIATED': 'Returned to Origin',
    'RTO DELIVERED': 'Returned to Origin',
    CANCELLED: 'Cancelled',
    EXCEPTION: 'Exception',
  };
  return statusMap[shiprocketStatus?.toUpperCase()] || shiprocketStatus;
}

// ─── Business logic ───────────────────────────────────────────────────────────
async function processTrackingUpdate(body: Record<string, unknown>) {
  const awb = body.awb as string;
  const currentStatus = body.current_status as string;
  const shipmentId = body.shipment_id as string;
  const orderId = body.order_id as string;
  const location = body.location as string;
  const scans = body.scans;
  const normalizedStatus = normalizeStatus(currentStatus || '');

  // Update shipments table
  await withRetry(() =>
    supabaseQuery(`shipments?shiprocket_shipment_id=eq.${shipmentId}`, 'PATCH', {
      status: normalizedStatus,
      raw_status: currentStatus,
      current_location: location,
      updated_at: new Date().toISOString(),
    })
  );

  // Insert tracking event (idempotent via unique constraint on awb + status + timestamp)
  await withRetry(() =>
    supabaseQuery('shipment_tracking_events', 'POST', {
      awb,
      shipment_id: shipmentId,
      order_id: orderId,
      raw_status: currentStatus,
      normalized_status: normalizedStatus,
      location,
      scans: scans ? JSON.stringify(scans) : null,
      event_at: new Date().toISOString(),
    })
  );

  // Trigger buyer notification via Supabase Edge Function
  try {
    const edgeFnUrl = `${SUPABASE_URL}/functions/v1/shiprocket-tracking-email`;
    await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ awb, orderId, normalizedStatus, location }),
    });
  } catch (emailErr) {
    console.warn('[Shiprocket Webhook] Email notification failed (non-fatal):', emailErr);
  }

  console.log(`[Shiprocket Webhook] ✅ AWB: ${awb} → ${normalizedStatus}`);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  const rawBody = await request.text();

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const awb = body.awb as string;
  const currentStatus = body.current_status as string;
  const shipmentId = body.shipment_id as string;

  // Build idempotency key from AWB + status + timestamp
  const eventHash = crypto
    .createHash('sha256')
    .update(`${awb}_${currentStatus}_${shipmentId}_${body.timestamp || Date.now()}`)
    .digest('hex')
    .slice(0, 32);
  const idempotencyKey = `srkt_${eventHash}`;

  // Idempotency check
  const alreadyDone = await isAlreadyProcessed(idempotencyKey);
  if (alreadyDone) {
    console.log(`[Shiprocket Webhook] ⏭ Duplicate event skipped: ${idempotencyKey}`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await processTrackingUpdate(body);
    await markProcessed(idempotencyKey, currentStatus, body);
    return NextResponse.json({ received: true, status: normalizeStatus(currentStatus) });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Shiprocket Webhook] ❌ All retries exhausted:`, errMsg);
    await sendToDeadLetterQueue(idempotencyKey, currentStatus, body, errMsg);
    return NextResponse.json({ received: true, queued_for_retry: true });
  }
}
