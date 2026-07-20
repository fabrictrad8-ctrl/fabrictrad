import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';

async function getShiprocketToken() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) throw new Error('Shiprocket is not configured.');

  const response = await fetch(`${SHIPROCKET_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) throw new Error('Shiprocket authentication failed.');
  return String(data.token);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });

    const body = (await request.json()) as { bulkOrderId?: string };
    if (!body.bulkOrderId) {
      return NextResponse.json({ success: false, error: 'bulkOrderId is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: sellerProfile } = await admin
      .from('seller_profiles')
      .select('id,pickup_address')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!sellerProfile) {
      return NextResponse.json({ success: false, error: 'Seller account required.' }, { status: 403 });
    }

    const { data: order, error: orderError } = await admin
      .from('bulk_orders')
      .select(
        'id,buyer_id,seller_id,status,buyer_name,buyer_email,buyer_phone,shipping_address,net_total,bulk_order_items(product_name,sku,quantity_mtrs,price_per_mtr)'
      )
      .eq('id', body.bulkOrderId)
      .eq('seller_id', sellerProfile.id)
      .maybeSingle();
    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }
    if (order.status !== 'paid') {
      return NextResponse.json({ success: false, error: 'Only paid orders can be shipped.' }, { status: 409 });
    }

    const address = (order.shipping_address || {}) as Record<string, string>;
    const pickup = (sellerProfile.pickup_address || {}) as Record<string, string>;
    if (!order.buyer_phone || !address.line1 || !address.city || !address.state || !address.pincode) {
      return NextResponse.json(
        { success: false, error: 'Buyer shipping address and phone are incomplete.' },
        { status: 409 }
      );
    }

    const existing = await admin
      .from('seller_shipments')
      .select('shiprocket_order_id,shiprocket_shipment_id,awb_number,status')
      .eq('order_id', order.id)
      .maybeSingle();
    if (existing.data?.shiprocket_order_id) {
      return NextResponse.json({ success: true, existing: true, shipment: existing.data });
    }

    const token = await getShiprocketToken();
    const items = Array.isArray(order.bulk_order_items) ? order.bulk_order_items : [];
    if (!items.length) {
      return NextResponse.json({ success: false, error: 'Order has no line items.' }, { status: 409 });
    }

    const payload = {
      order_id: order.id,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_location: pickup.name || 'Primary',
      billing_customer_name: order.buyer_name || 'FabricTrad Buyer',
      billing_last_name: '',
      billing_address: address.line1,
      billing_address_2: address.line2 || '',
      billing_city: address.city,
      billing_pincode: address.pincode,
      billing_state: address.state,
      billing_country: 'India',
      billing_email: order.buyer_email || '',
      billing_phone: order.buyer_phone,
      shipping_is_billing: true,
      order_items: items.map((item: Record<string, unknown>) => ({
        name: String(item.product_name || 'Textile product').slice(0, 120),
        sku: String(item.sku || order.id).slice(0, 50),
        units: Number(item.quantity_mtrs || 1),
        selling_price: Number(item.price_per_mtr || 0),
        discount: 0,
        tax: 0,
        hsn: 5007,
      })),
      payment_method: 'Prepaid',
      sub_total: Number(order.net_total || 0),
      length: Number(process.env.DEFAULT_SHIPMENT_LENGTH_CM || 10),
      breadth: Number(process.env.DEFAULT_SHIPMENT_BREADTH_CM || 10),
      height: Number(process.env.DEFAULT_SHIPMENT_HEIGHT_CM || 10),
      weight: Number(process.env.DEFAULT_SHIPMENT_WEIGHT_KG || 0.5),
    };

    const response = await fetch(`${SHIPROCKET_API}/orders/create/adhoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.order_id || !data.shipment_id) {
      console.error('Shiprocket order rejected:', response.status, data?.message);
      return NextResponse.json(
        { success: false, error: 'Courier order creation failed.' },
        { status: 502 }
      );
    }

    const { error: saveError } = await admin.from('seller_shipments').upsert(
      {
        order_id: order.id,
        buyer_id: order.buyer_id,
        seller_id: sellerProfile.id,
        courier_type: 'shiprocket',
        courier_name: data.courier_name || null,
        awb_number: data.awb_code || null,
        shiprocket_order_id: String(data.order_id),
        shiprocket_shipment_id: String(data.shipment_id),
        status: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'order_id' }
    );
    if (saveError) throw saveError;

    return NextResponse.json({
      success: true,
      shiprocketOrderId: data.order_id,
      shipmentId: data.shipment_id,
      awb: data.awb_code || null,
      courierName: data.courier_name || null,
    });
  } catch (error) {
    console.error('Shiprocket order creation failed:', error);
    const unavailable = error instanceof Error && error.message.includes('not configured');
    return NextResponse.json(
      { success: false, error: unavailable ? 'Courier service is not configured.' : 'Courier order creation failed.' },
      { status: unavailable ? 503 : 500 }
    );
  }
}
