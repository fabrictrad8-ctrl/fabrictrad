import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';
const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const positiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

async function getShiprocketToken() {
  const email = process.env.SHIPROCKET_EMAIL?.trim();
  const password = process.env.SHIPROCKET_PASSWORD?.trim();
  if (!email || !password) throw new Error('Shiprocket is not configured.');

  const response = await fetch(`${SHIPROCKET_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json().catch(() => ({}))) as {
    token?: string;
    message?: string;
  };
  if (!response.ok || !data.token) {
    throw new Error(data.message || 'Shiprocket authentication failed.');
  }
  return data.token;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ success: false, error: 'Authentication required.' }, 401);

    let body: { orderId?: unknown; bulkOrderId?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ success: false, error: 'Invalid shipment request.' }, 400);
    }
    const orderId =
      typeof body.orderId === 'string'
        ? body.orderId.trim()
        : typeof body.bulkOrderId === 'string'
          ? body.bulkOrderId.trim()
          : '';
    if (!orderId) {
      return json({ success: false, error: 'Order reference is required.' }, 400);
    }

    const admin = createAdminClient();
    const { data: sellerProfile, error: sellerError } = await admin
      .from('seller_profiles')
      .select('id,pickup_address,is_active,verification_status,gstin_verified')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !sellerProfile) {
      return json({ success: false, error: 'Seller account required.' }, 403);
    }
    const sellerEligible =
      sellerProfile.is_active === true &&
      sellerProfile.gstin_verified === true &&
      ['approved', 'verified', 'active'].includes(
        String(sellerProfile.verification_status || '').toLowerCase()
      );
    if (!sellerEligible) {
      return json(
        { success: false, error: 'An active GST-verified seller account is required for dispatch.' },
        403
      );
    }

    const { data: order, error: orderError } = await admin
      .from('bulk_orders')
      .select(
        'id,buyer_id,seller_id,status,payment_status,buyer_name,buyer_email,buyer_phone,shipping_address,net_total,created_at,bulk_order_items(product_name,sku,quantity_mtrs,price_per_mtr,gst_rate,line_total)'
      )
      .eq('id', orderId)
      .eq('seller_id', sellerProfile.id)
      .maybeSingle();
    if (orderError || !order) {
      return json({ success: false, error: 'Order not found.' }, 404);
    }
    if (order.status !== 'paid' || order.payment_status !== 'paid') {
      return json(
        { success: false, error: 'Only fully captured paid orders can be shipped.' },
        409
      );
    }

    const rawAddress = (order.shipping_address || {}) as Record<string, unknown>;
    const address = {
      line1: String(
        rawAddress.line1 || rawAddress.addressLine1 || rawAddress.address_line1 || ''
      ).trim(),
      line2: String(
        rawAddress.line2 || rawAddress.addressLine2 || rawAddress.address_line2 || ''
      ).trim(),
      city: String(rawAddress.city || '').trim(),
      state: String(rawAddress.state || '').trim(),
      pincode: String(rawAddress.pincode || rawAddress.postalCode || '').trim(),
    };
    const pickup = (sellerProfile.pickup_address || {}) as Record<string, unknown>;
    if (!order.buyer_phone || !address.line1 || !address.city || !address.state || !address.pincode) {
      return json(
        { success: false, error: 'Buyer shipping address and phone are incomplete.' },
        409
      );
    }

    const { data: existing } = await admin
      .from('seller_shipments')
      .select(
        'shiprocket_order_id,shiprocket_shipment_id,awb_number,courier_name,tracking_url,status'
      )
      .eq('bulk_order_id', order.id)
      .maybeSingle();
    if (existing?.shiprocket_order_id) {
      return json({ success: true, existing: true, shipment: existing });
    }

    const items = Array.isArray(order.bulk_order_items) ? order.bulk_order_items : [];
    if (!items.length) {
      return json({ success: false, error: 'Order has no line items.' }, 409);
    }
    const invalidItem = items.find(
      (item: Record<string, unknown>) =>
        Number(item.quantity_mtrs || 0) <= 0 || Number(item.price_per_mtr || 0) < 0
    );
    if (invalidItem) {
      return json({ success: false, error: 'Order line quantity or price is invalid.' }, 409);
    }

    const token = await getShiprocketToken();
    const payload = {
      order_id: order.id,
      order_date: new Date(order.created_at || Date.now()).toISOString().slice(0, 10),
      pickup_location: String(pickup.name || pickup.locationName || 'Primary').slice(0, 50),
      billing_customer_name: order.buyer_name || 'FabricTrad Buyer',
      billing_last_name: '',
      billing_address: address.line1,
      billing_address_2: address.line2,
      billing_city: address.city,
      billing_pincode: address.pincode,
      billing_state: address.state,
      billing_country: 'India',
      billing_email: order.buyer_email || '',
      billing_phone: String(order.buyer_phone),
      shipping_is_billing: true,
      order_items: items.map((item: Record<string, unknown>) => ({
        name: String(item.product_name || 'Textile product').slice(0, 120),
        sku: String(item.sku || order.id).slice(0, 50),
        units: Number(item.quantity_mtrs || 1),
        selling_price: Number(item.price_per_mtr || 0),
        discount: 0,
        tax: Number(item.gst_rate || 0),
      })),
      payment_method: 'Prepaid',
      sub_total: Number(order.net_total || 0),
      length: positiveNumber(process.env.DEFAULT_SHIPMENT_LENGTH_CM, 10),
      breadth: positiveNumber(process.env.DEFAULT_SHIPMENT_BREADTH_CM, 10),
      height: positiveNumber(process.env.DEFAULT_SHIPMENT_HEIGHT_CM, 10),
      weight: positiveNumber(process.env.DEFAULT_SHIPMENT_WEIGHT_KG, 0.5),
    };

    const response = await fetch(`${SHIPROCKET_API}/orders/create/adhoc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await response.json().catch(() => ({}))) as {
      order_id?: string | number;
      shipment_id?: string | number;
      awb_code?: string;
      courier_name?: string;
      tracking_url?: string;
      message?: string;
    };
    if (!response.ok || !data.order_id || !data.shipment_id) {
      console.error('Shiprocket order rejected', {
        status: response.status,
        message: data.message,
        orderId: order.id,
      });
      return json(
        { success: false, error: data.message || 'Courier order creation failed.' },
        502
      );
    }

    const { error: saveError } = await admin.from('seller_shipments').upsert(
      {
        order_id: order.id,
        bulk_order_id: order.id,
        catalog_order_id: null,
        buyer_id: order.buyer_id,
        seller_id: sellerProfile.id,
        courier_type: 'shiprocket',
        courier_name: data.courier_name || null,
        awb_number: data.awb_code || null,
        tracking_url: data.tracking_url || null,
        shiprocket_order_id: String(data.order_id),
        shiprocket_shipment_id: String(data.shipment_id),
        status: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'bulk_order_id' }
    );
    if (saveError) throw saveError;

    return json({
      success: true,
      shiprocketOrderId: data.order_id,
      shipmentId: data.shipment_id,
      awb: data.awb_code || null,
      courierName: data.courier_name || null,
      trackingUrl: data.tracking_url || null,
    });
  } catch (error) {
    console.error('Shiprocket order creation failed:', error);
    const unavailable = error instanceof Error && error.message.includes('not configured');
    return json(
      {
        success: false,
        error: unavailable ? 'Courier service is not configured.' : 'Courier order creation failed.',
      },
      unavailable ? 503 : 500
    );
  }
}
