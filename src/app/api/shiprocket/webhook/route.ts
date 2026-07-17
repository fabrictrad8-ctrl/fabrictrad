import { NextRequest, NextResponse } from 'next/server';

// Normalize Shiprocket status to FabricTrad status
function normalizeStatus(shiprocketStatus: string): string {
  const statusMap: Record<string, string> = {
    'NEW': 'Order Created',
    'PICKUP PENDING': 'Pickup Scheduled',
    'PICKUP QUEUED': 'Pickup Scheduled',
    'PICKED UP': 'Picked Up',
    'IN TRANSIT': 'In Transit',
    'OUT FOR DELIVERY': 'Out for Delivery',
    'DELIVERED': 'Delivered',
    'DELIVERY FAILED': 'Delivery Attempt Failed',
    'UNDELIVERED': 'Delivery Attempt Failed',
    'DELAYED': 'Delayed',
    'RETURNED': 'Returned to Origin',
    'RTO INITIATED': 'Returned to Origin',
    'RTO DELIVERED': 'Returned to Origin',
    'CANCELLED': 'Cancelled',
  };
  return statusMap[shiprocketStatus?.toUpperCase()] || shiprocketStatus;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      awb,
      current_status,
      shipment_id,
      order_id,
      location,
      scans,
    } = body;

    const normalizedStatus = normalizeStatus(current_status || '');

    console.log(`[Shiprocket Webhook] AWB: ${awb}, Status: ${current_status} → ${normalizedStatus}`);

    // TODO: Update shipments table in Supabase with new status
    // TODO: Insert into shipment_tracking_events (idempotent via webhook_event_id)
    // TODO: Trigger buyer notification email via Resend

    const trackingEvent = {
      awb,
      shipmentId: shipment_id,
      orderId: order_id,
      rawStatus: current_status,
      normalizedStatus,
      location,
      scans,
      processedAt: new Date().toISOString(),
    };

    console.log('[Shiprocket Webhook] Processed:', JSON.stringify(trackingEvent));

    return NextResponse.json({ received: true, status: normalizedStatus });
  } catch (error: unknown) {
    console.error('[Shiprocket Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
