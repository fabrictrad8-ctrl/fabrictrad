import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';
type OrderType = 'bulk' | 'catalog';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const positiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const text = (value: unknown) => String(value || '').trim();

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

    let body: { orderId?: unknown; bulkOrderId?: unknown; orderType?: unknown };
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
    const orderType: OrderType = body.orderType === 'catalog' ? 'catalog' : 'bulk';
    if (!orderId) return json({ success: false, error: 'Order reference is required.' }, 400);

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

    let buyerId = '';
    let buyerName = '';
    let buyerEmail = '';
    let buyerPhone = '';
    let rawAddress: Record<string, unknown> = {};
    let orderTotal = 0;
    let orderCreatedAt: string | null = null;
    let items: Array<Record<string, unknown>> = [];
    let shipmentLookupColumn: 'bulk_order_id' | 'catalog_order_id' = 'bulk_order_id';

    if (orderType === 'catalog') {
      shipmentLookupColumn = 'catalog_order_id';
      const { data: catalogOrder, error: catalogError } = await admin
        .from('catalog_order_requests')
        .select(
          'id,buyer_id,seller_id,product_id,variant_id,status,payment_status,quantity,unit,price_per_unit,gst_rate,total_amount,subtotal,created_at,seller_products!catalog_order_requests_product_id_fkey(name,sku)'
        )
        .eq('id', orderId)
        .eq('seller_id', sellerProfile.id)
        .maybeSingle();
      if (catalogError || !catalogOrder) {
        return json({ success: false, error: 'Catalogue order not found.' }, 404);
      }
      if (catalogOrder.status !== 'paid' || catalogOrder.payment_status !== 'paid') {
        return json(
          { success: false, error: 'Only fully captured paid orders can be shipped.' },
          409
        );
      }

      buyerId = String(catalogOrder.buyer_id);
      orderTotal = Number(catalogOrder.total_amount || 0);
      orderCreatedAt = catalogOrder.created_at;

      const [{ data: buyerUser, error: buyerUserError }, { data: buyerProfile }] = await Promise.all([
        admin
          .from('user_profiles')
          .select('full_name,email,phone,address_line1,address_line2,city,state,pincode')
          .eq('id', buyerId)
          .maybeSingle(),
        admin
          .from('buyer_profiles')
          .select('billing_address')
          .eq('user_id', buyerId)
          .maybeSingle(),
      ]);
      if (buyerUserError || !buyerUser) {
        return json({ success: false, error: 'Buyer delivery profile could not be loaded.' }, 409);
      }

      buyerName = text(buyerUser.full_name) || 'FabricTrad Buyer';
      buyerEmail = text(buyerUser.email);
      buyerPhone = text(buyerUser.phone);
      const billing = (buyerProfile?.billing_address || {}) as Record<string, unknown>;
      rawAddress = {
        line1: billing.line1 || billing.addressLine1 || billing.address_line1 || buyerUser.address_line1,
        line2: billing.line2 || billing.addressLine2 || billing.address_line2 || buyerUser.address_line2,
        city: billing.city || buyerUser.city,
        state: billing.state || buyerUser.state,
        pincode: billing.pincode || billing.postalCode || buyerUser.pincode,
      };

      const product = catalogOrder.seller_products as unknown as {
        name?: string | null;
        sku?: string | null;
      } | null;
      let variantLabel = '';
      let variantCode = '';
      if (catalogOrder.variant_id) {
        const { data: variant } = await admin
          .from('seller_product_variants')
          .select('color_name,design_name,variant_code')
          .eq('id', catalogOrder.variant_id)
          .maybeSingle();
        variantLabel = [variant?.color_name, variant?.design_name].filter(Boolean).join(' / ');
        variantCode = text(variant?.variant_code);
      }

      items = [
        {
          product_name: `${text(product?.name) || 'Textile product'}${variantLabel ? ` · ${variantLabel}` : ''}`,
          sku: variantCode || text(product?.sku) || String(catalogOrder.product_id),
          quantity: Number(catalogOrder.quantity || 1),
          unit: text(catalogOrder.unit) || 'unit',
          price: Number(catalogOrder.price_per_unit || 0),
          gst_rate: Number(catalogOrder.gst_rate || 0),
        },
      ];
    } else {
      const { data: bulkOrder, error: bulkError } = await admin
        .from('bulk_orders')
        .select(
          'id,buyer_id,seller_id,status,payment_status,buyer_name,buyer_email,buyer_phone,shipping_address,net_total,created_at,bulk_order_items(product_name,sku,quantity_mtrs,price_per_mtr,gst_rate,line_total)'
        )
        .eq('id', orderId)
        .eq('seller_id', sellerProfile.id)
        .maybeSingle();
      if (bulkError || !bulkOrder) {
        return json({ success: false, error: 'Bulk order not found.' }, 404);
      }
      if (bulkOrder.status !== 'paid' || bulkOrder.payment_status !== 'paid') {
        return json(
          { success: false, error: 'Only fully captured paid orders can be shipped.' },
          409
        );
      }

      buyerId = text(bulkOrder.buyer_id);
      buyerName = text(bulkOrder.buyer_name) || 'FabricTrad Buyer';
      buyerEmail = text(bulkOrder.buyer_email);
      buyerPhone = text(bulkOrder.buyer_phone);
      rawAddress = (bulkOrder.shipping_address || {}) as Record<string, unknown>;
      orderTotal = Number(bulkOrder.net_total || 0);
      orderCreatedAt = bulkOrder.created_at;
      items = (Array.isArray(bulkOrder.bulk_order_items) ? bulkOrder.bulk_order_items : []).map(
        (item: Record<string, unknown>) => ({
          product_name: item.product_name,
          sku: item.sku,
          quantity: Number(item.quantity_mtrs || 1),
          unit: 'mtr',
          price: Number(item.price_per_mtr || 0),
          gst_rate: Number(item.gst_rate || 0),
        })
      );
    }

    const address = {
      line1: text(rawAddress.line1 || rawAddress.addressLine1 || rawAddress.address_line1),
      line2: text(rawAddress.line2 || rawAddress.addressLine2 || rawAddress.address_line2),
      city: text(rawAddress.city),
      state: text(rawAddress.state),
      pincode: text(rawAddress.pincode || rawAddress.postalCode),
    };
    if (!buyerPhone || !address.line1 || !address.city || !address.state || !address.pincode) {
      return json(
        {
          success: false,
          error: 'Buyer shipping address and phone are incomplete. Ask the buyer to update Profile & settings before dispatch.',
        },
        409
      );
    }
    if (!items.length || items.some((item) => Number(item.quantity || 0) <= 0 || Number(item.price || 0) < 0)) {
      return json({ success: false, error: 'Order line quantity or price is invalid.' }, 409);
    }

    const { data: existing } = await admin
      .from('seller_shipments')
      .select('shiprocket_order_id,shiprocket_shipment_id,awb_number,courier_name,tracking_url,status')
      .eq(shipmentLookupColumn, orderId)
      .maybeSingle();
    if (existing?.shiprocket_order_id) {
      return json({ success: true, existing: true, shipment: existing });
    }

    const pickup = (sellerProfile.pickup_address || {}) as Record<string, unknown>;
    const token = await getShiprocketToken();
    const payload = {
      order_id: `FT-${orderType === 'catalog' ? 'CAT' : 'BULK'}-${orderId}`.slice(0, 50),
      order_date: new Date(orderCreatedAt || Date.now()).toISOString().slice(0, 10),
      pickup_location: text(pickup.name || pickup.locationName || pickup.location_name || 'Primary').slice(0, 50),
      billing_customer_name: buyerName,
      billing_last_name: '',
      billing_address: address.line1,
      billing_address_2: address.line2,
      billing_city: address.city,
      billing_pincode: address.pincode,
      billing_state: address.state,
      billing_country: 'India',
      billing_email: buyerEmail,
      billing_phone: buyerPhone,
      shipping_is_billing: true,
      order_items: items.map((item) => ({
        name: `${text(item.product_name) || 'Textile product'}${item.unit ? ` (${Number(item.quantity)} ${text(item.unit)})` : ''}`.slice(0, 120),
        sku: (text(item.sku) || orderId).slice(0, 50),
        units: Number(item.quantity || 1),
        selling_price: Number(item.price || 0),
        discount: 0,
        tax: Number(item.gst_rate || 0),
      })),
      payment_method: 'Prepaid',
      sub_total: orderTotal,
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
        orderId,
        orderType,
      });
      return json(
        { success: false, error: data.message || 'Courier order creation failed.' },
        502
      );
    }

    const shipmentPayload = {
      order_id: orderId,
      bulk_order_id: orderType === 'bulk' ? orderId : null,
      catalog_order_id: orderType === 'catalog' ? orderId : null,
      buyer_id: buyerId || null,
      seller_id: sellerProfile.id,
      courier_type: 'shiprocket',
      courier_name: data.courier_name || null,
      awb_number: data.awb_code || null,
      tracking_url: data.tracking_url || null,
      shiprocket_order_id: String(data.order_id),
      shiprocket_shipment_id: String(data.shipment_id),
      status: 'pending',
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await admin
      .from('seller_shipments')
      .upsert(shipmentPayload, { onConflict: shipmentLookupColumn });
    if (saveError) throw saveError;

    return json({
      success: true,
      orderType,
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
