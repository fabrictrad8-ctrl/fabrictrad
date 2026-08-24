import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

type JsonObject = Record<string, unknown>;

type ShiprocketTokenRow = {
  webhook_token?: string | null;
};

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

async function loadExpectedWebhookToken() {
  const workerToken = process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim();
  if (workerToken) return workerToken;

  const hasSupabaseServerSecret = Boolean(
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  if (!hasSupabaseServerSecret) return '';

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_server_shiprocket_webhook_token');
    if (error) {
      console.error('Shiprocket webhook Vault lookup failed:', error.message);
      return '';
    }

    const row = (Array.isArray(data) ? data[0] : data) as ShiprocketTokenRow | null;
    return String(row?.webhook_token || '').trim();
  } catch (error) {
    console.error(
      'Shiprocket webhook Vault lookup failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return '';
  }
}

export async function POST(request: NextRequest) {
  const hasSupabaseServerSecret = Boolean(
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  const expectedToken = await loadExpectedWebhookToken();
  if (!expectedToken || !hasSupabaseServerSecret) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const suppliedToken =
    request.headers.get('x-api-key') || request.headers.get('x-shiprocket-token') || bearer;
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
    return NextResponse.json(
      { error: 'Shipment identifier and status are required.' },
      { status: 400 }
    );
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
  if (previous) return NextResponse.json({ received: true, duplicate: true }, { status: 200 });

  try {
    let query = admin.from('seller_shipments').select('*');
    query = awb ? query.eq('awb_number', awb) : query.eq('shiprocket_shipment_id', shipmentId);
    const { data: shipment, error: shipmentError } = await query.maybeSingle();
    if (shipmentError) throw shipmentError;

    // The Shiprocket dashboard uses a synthetic AWB/shipment when “Test Webhook” is pressed.
    // It will not exist in FabricTrad, but a valid authenticated test must still receive 200.
    if (!shipment) {
      return NextResponse.json(
        {
          received: true,
          matched: false,
          testOrUnknownShipment: true,
          status: normalizeStatus(rawStatus),
        },
        { status: 200 }
      );
    }

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

    if (shipment.catalog_order_id) {
      if (status === 'delivered') {
        const { error: catalogUpdateError } = await admin
          .from('catalog_order_requests')
          .update({
            status: 'fulfilled',
            fulfilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', shipment.catalog_order_id)
          .eq('payment_status', 'paid')
          .in('status', ['paid', 'fulfilled']);
        if (catalogUpdateError) throw catalogUpdateError;
      }
    } else if (shipment.bulk_order_id) {
      if (status === 'delivered') {
        const { error: deliveredError } = await admin
          .from('bulk_orders')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('id', shipment.bulk_order_id)
          .in('status', ['paid', 'shipped', 'delivered']);
        if (deliveredError) throw deliveredError;
      } else if (['picked_up', 'in_transit', 'out_for_delivery'].includes(status)) {
        const { error: shippedError } = await admin
          .from('bulk_orders')
          .update({ status: 'shipped', updated_at: new Date().toISOString() })
          .eq('id', shipment.bulk_order_id)
          .in('status', ['paid', 'shipped']);
        if (shippedError) throw shippedError;
      }
    }

    const { error: eventError } = await admin.from('webhook_events').insert({
      idempotency_key: idempotencyKey,
      source: 'shiprocket',
      event_type: rawStatus,
      payload: body,
      processed_at: new Date().toISOString(),
    });
    if (eventError && eventError.code !== '23505') throw eventError;

    return NextResponse.json(
      {
        received: true,
        matched: true,
        status,
        orderType: shipment.catalog_order_id ? 'catalog' : 'bulk',
        orderId: shipment.catalog_order_id || shipment.bulk_order_id || shipment.order_id,
      },
      { status: 200 }
    );
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

    // Persist the failure for retry, but acknowledge receipt so the provider does not hammer
    // the callback with duplicate events.
    return NextResponse.json(
      { received: true, queuedForRetry: true },
      { status: 200 }
    );
  }
}
