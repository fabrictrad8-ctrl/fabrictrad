import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

type JsonObject = Record<string, unknown>;

const normalizeStatus = (status: string) => {
  const value = status.toUpperCase();
  if (value === 'PICKED UP') return 'picked_up';
  if (value === 'IN TRANSIT') return 'in_transit';
  if (value === 'OUT FOR DELIVERY') return 'out_for_delivery';
  if (value === 'DELIVERED') return 'delivered';
  if (
    value.includes('FAILED') ||
    value === 'UNDELIVERED' ||
    value.includes('RTO') ||
    value === 'CANCELLED' ||
    value === 'EXCEPTION'
  ) {
    return 'failed';
  }
  return 'pending';
};

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export async function POST(request: NextRequest) {
  const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  if (!expectedToken || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const suppliedToken = request.headers.get('x-api-key') || request.headers.get('x-shiprocket-token') || bearer;
  if (!safeEqual(expectedToken, suppliedToken)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: JsonObject;
  try {
    body = (await request.json()) as JsonObject;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const awb = String(body.awb || body.awb_code || '');
  const shipmentId = String(body.shipment_id || '');
  const rawStatus = String(body.current_status || body.status || '');
  if ((!awb && !shipmentId) || !rawStatus) {
    return NextResponse.json({ error: 'Shipment identifier and status are required.' }, { status: 400 });
  }

  const eventTimestamp = String(body.timestamp || body.updated_at || new Date().toISOString());
  const idempotencyKey = `srkt_${crypto
    .createHash('sha256')
    .update(`${awb}|${shipmentId}|${rawStatus}|${eventTimestamp}`)
    .digest('hex')}`;
  const admin = createAdminClient();

  const { data: previous } = await admin
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (previous) return NextResponse.json({ received: true, duplicate: true });

  try {
    let query = admin.from('seller_shipments').select('*');
    query = awb ? query.eq('awb_number', awb) : query.eq('shiprocket_shipment_id', shipmentId);
    const { data: shipment, error: shipmentError } = await query.maybeSingle();
    if (shipmentError || !shipment) throw new Error('Shipment record not found.');

    const status = normalizeStatus(rawStatus);
    const oldEvents = Array.isArray(shipment.tracking_events) ? shipment.tracking_events : [];
    const event = {
      status,
      raw_status: rawStatus,
      location: body.location || body.current_location || null,
      timestamp: eventTimestamp,
      awb: awb || shipment.awb_number || null,
    };

    const { error: updateError } = await admin
      .from('seller_shipments')
      .update({
        status,
        awb_number: awb || shipment.awb_number,
        tracking_events: [...oldEvents.slice(-99), event],
        last_tracked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipment.id);
    if (updateError) throw updateError;

    if (status === 'delivered') {
      await admin
        .from('bulk_orders')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', shipment.order_id)
        .in('status', ['paid', 'shipped', 'delivered']);
    } else if (['picked_up', 'in_transit', 'out_for_delivery'].includes(status)) {
      await admin
        .from('bulk_orders')
        .update({ status: 'shipped', updated_at: new Date().toISOString() })
        .eq('id', shipment.order_id)
        .in('status', ['paid', 'shipped']);
    }

    const { error: eventError } = await admin.from('webhook_events').insert({
      idempotency_key: idempotencyKey,
      source: 'shiprocket',
      event_type: rawStatus,
      payload: body,
      processed_at: new Date().toISOString(),
    });
    if (eventError && eventError.code !== '23505') throw eventError;

    return NextResponse.json({ received: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    console.error('Shiprocket webhook failed:', message);
    await admin.from('webhook_dead_letter_queue').insert({
      idempotency_key: idempotencyKey,
      source: 'shiprocket',
      event_type: rawStatus,
      payload: body,
      error_message: message.slice(0, 2000),
      retry_count: 0,
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
    });
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
