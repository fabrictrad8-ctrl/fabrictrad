import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateManualShipment } from '@/lib/shippingValidation';

export const dynamic = 'force-dynamic';
const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Seller sign-in required.' }, 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || Array.isArray(body)) return json({ error: 'Invalid shipment details.' }, 400);
  const error = validateManualShipment(body);
  if (error) return json({ error }, 400);

  // The database checks active seller ownership and full captured payment under
  // an order lock. Buyer/seller IDs and Shiprocket IDs are never client inputs.
  const result = await supabase.rpc('save_my_manual_shipment', {
    p_order_id: body.orderId,
    p_order_kind: body.orderType,
    p_courier_name: String(body.courierName).trim(),
    p_awb_number: String(body.awbNumber).trim(),
    p_tracking_url: String(body.trackingUrl).trim(),
    p_estimated_delivery: body.estimatedDelivery || null,
    p_status: body.status,
  });
  if (result.error) {
    const known = ['SELLER_ACCESS_REQUIRED', 'ORDER_NOT_AVAILABLE', 'FULL_PAYMENT_REQUIRED', 'SHIPMENT_ALREADY_BOOKED', 'DELIVERED_SHIPMENT_LOCKED'];
    const code = known.find(value => result.error.message.includes(value));
    const messages: Record<string, string> = {
      SELLER_ACCESS_REQUIRED: 'Active seller access is required.',
      ORDER_NOT_AVAILABLE: 'This order is not available to your seller account.',
      FULL_PAYMENT_REQUIRED: 'Full captured payment is required before shipping.',
      SHIPMENT_ALREADY_BOOKED: 'This order already has a Shiprocket booking. Cancel that booking with support before changing it.',
      DELIVERED_SHIPMENT_LOCKED: 'A delivered shipment cannot be rewritten. Contact support for a correction.',
    };
    console.error('Manual shipment save failed', { code: result.error.code, reason: code || 'database_error' });
    return json({ error: code ? messages[code] : 'Shipment could not be saved. Please retry.', code }, code === 'SELLER_ACCESS_REQUIRED' ? 403 : code ? 409 : 503);
  }
  return json({ success: true, shipment: result.data });
}
