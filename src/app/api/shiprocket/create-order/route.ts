import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getShiprocketCredentials } from '@/lib/shiprocketCredentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API = 'https://apiv2.shiprocket.in/v1/external';
type OrderType = 'bulk' | 'catalog';
type JsonMap = Record<string, unknown>;

type Address = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

type BuyerUser = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  business_name?: string | null;
};

type BuyerProfile = {
  business_name?: string | null;
  gstin?: string | null;
  gstin_verified?: boolean | null;
  billing_address?: JsonMap | null;
};

type CompanyLocation = {
  shipping_address?: JsonMap | null;
  billing_address?: JsonMap | null;
  gstin?: string | null;
};

type Courier = {
  courier_company_id?: number | string;
  courier_name?: string;
  freight_charge?: number | string;
  rate?: number | string;
  etd?: string;
  rating?: number | string;
};

const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const text = (value: unknown) => String(value ?? '').trim();
const numeric = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const positive = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const money = (value: number) => Math.round(value * 100) / 100;

const phone = (value: unknown) => {
  let digits = text(value).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(-10);
  return /^\d{10}$/.test(digits) ? digits : '';
};

const pincode = (value: unknown) => {
  let digits = text(value).replace(/\D/g, '').slice(0, 6);
  return /^\d{6}$/.test(digits) ? digits : '';
};

const address = (raw?: JsonMap | null): Address => ({
  line1: text(raw?.line1 || raw?.addressLine1 || raw?.address_line1 || raw?.address),
  line2: text(raw?.line2 || raw?.addressLine2 || raw?.address_line2),
  city: text(raw?.city),
  state: text(raw?.state),
  pincode: pincode(raw?.pincode || raw?.postalCode || raw?.postal_code || raw?.pin_code),
  country: text(raw?.country) || 'India',
});

const addressComplete = (value: Address) =>
  value.line1.length >= 3 && Boolean(value.city && value.state && value.pincode);

const addressesMatch = (a: Address, b: Address) =>
  a.line1.toLowerCase() === b.line1.toLowerCase() &&
  a.city.toLowerCase() === b.city.toLowerCase() &&
  a.state.toLowerCase() === b.state.toLowerCase() &&
  a.pincode === b.pincode;

const uniquePickupName = (existing: unknown, sellerRef: unknown, sellerId: string) => {
  const saved = text(existing).replace(/[^a-zA-Z0-9]/g, '').slice(0, 36);
  if (saved) return saved;
  const seed = text(sellerRef).replace(/[^a-zA-Z0-9]/g, '') || sellerId.replace(/-/g, '');
  return `FT${seed}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 36);
};

async function authenticate() {
  const credentials = await getShiprocketCredentials();
  if (!credentials) throw new Error('Shiprocket is not configured.');

  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    token?: string;
    message?: string;
  };
  if (!response.ok || !payload.token) {
    throw new Error(payload.message || 'Shiprocket authentication failed.');
  }
  return { token: payload.token, source: credentials.source };
}

async function serviceableCourier(params: {
  token: string;
  pickup: string;
  delivery: string;
  weight: number;
  length: number;
  breadth: number;
  height: number;
  value: number;
}) {
  const url = new URL(`${API}/courier/serviceability/`);
  url.searchParams.set('pickup_postcode', params.pickup);
  url.searchParams.set('delivery_postcode', params.delivery);
  url.searchParams.set('cod', '0');
  url.searchParams.set('weight', String(params.weight));
  url.searchParams.set('length', String(params.length));
  url.searchParams.set('breadth', String(params.breadth));
  url.searchParams.set('height', String(params.height));
  url.searchParams.set('declared_value', String(Math.max(params.value, 1)));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${params.token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: {
      recommended_courier_company_id?: number | string;
      available_courier_companies?: Courier[];
    };
  };
  if (!response.ok) throw new Error(payload.message || 'Courier serviceability check failed.');

  const options = Array.isArray(payload.data?.available_courier_companies)
    ? payload.data?.available_courier_companies || []
    : [];
  if (!options.length) {
    throw new Error('No prepaid courier is currently serviceable for this pickup and delivery route.');
  }

  const recommended = text(payload.data?.recommended_courier_company_id);
  let selected = recommended
    ? options.find((item) => text(item.courier_company_id) === recommended)
    : undefined;
  if (!selected) {
    selected = [...options].sort((left, right) => {
      const leftCost = positive(left.freight_charge ?? left.rate, Number.MAX_SAFE_INTEGER);
      const rightCost = positive(right.freight_charge ?? right.rate, Number.MAX_SAFE_INTEGER);
      if (leftCost !== rightCost) return leftCost - rightCost;
      return numeric(right.rating) - numeric(left.rating);
    })[0];
  }

  const id = text(selected?.courier_company_id);
  if (!id) throw new Error('Shiprocket did not return a usable courier.');

  return {
    id,
    name: text(selected?.courier_name) || 'Shiprocket courier',
    cost: money(positive(selected?.freight_charge ?? selected?.rate, 0)),
    etd: text(selected?.etd),
    snapshot: {
      recommended_courier_company_id: recommended || null,
      available_count: options.length,
      selected: {
        courier_company_id: id,
        courier_name: text(selected?.courier_name),
        freight_charge: positive(selected?.freight_charge ?? selected?.rate, 0),
        etd: text(selected?.etd),
        rating: numeric(selected?.rating),
      },
    },
  };
}

const unpackForwardResponse = (value: unknown) => {
  const root = value && typeof value === 'object' ? (value as JsonMap) : {};
  const nested = root.data && typeof root.data === 'object' ? (root.data as JsonMap) : {};
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      if (root[key] !== null && root[key] !== undefined) return root[key];
      if (nested[key] !== null && nested[key] !== undefined) return nested[key];
    }
    return null;
  };
  return {
    orderId: pick('order_id', 'orderId'),
    shipmentId: pick('shipment_id', 'shipmentId'),
    awb: text(pick('awb_code', 'awb', 'awb_number')),
    courierName: text(pick('courier_name', 'courier')),
    labelUrl: text(pick('label_url', 'label')),
    manifestUrl: text(pick('manifest_url', 'manifest')),
    message: text(pick('message', 'error')),
  };
};

export async function POST(request: NextRequest) {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) return reply({ success: false, error: 'Authentication required.' }, 401);

    let input: { orderId?: unknown; bulkOrderId?: unknown; orderType?: unknown };
    try {
      input = (await request.json()) as typeof input;
    } catch {
      return reply({ success: false, error: 'Invalid shipment request.' }, 400);
    }

    const orderId =
      typeof input.orderId === 'string'
        ? input.orderId.trim()
        : typeof input.bulkOrderId === 'string'
          ? input.bulkOrderId.trim()
          : '';
    const orderType: OrderType = input.orderType === 'catalog' ? 'catalog' : 'bulk';
    if (!orderId) return reply({ success: false, error: 'Order reference is required.' }, 400);

    const admin = createAdminClient();
    const { data: rawSeller, error: sellerError } = await admin
      .from('seller_profiles')
      .select(
        'id,user_id,seller_ref,display_name,legal_business_name,gstin,gstin_verified,pickup_address,is_active,verification_status,shiprocket_pickup_location,shiprocket_pickup_registered'
      )
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !rawSeller) return reply({ success: false, error: 'Seller account required.' }, 403);

    const seller = rawSeller as unknown as {
      id: string;
      user_id: string;
      seller_ref?: string | null;
      display_name?: string | null;
      legal_business_name?: string | null;
      gstin?: string | null;
      gstin_verified?: boolean | null;
      pickup_address?: JsonMap | null;
      is_active?: boolean | null;
      verification_status?: string | null;
      shiprocket_pickup_location?: string | null;
      shiprocket_pickup_registered?: boolean | null;
    };

    const eligible =
      seller.is_active === true &&
      seller.gstin_verified === true &&
      ['approved', 'verified', 'active'].includes(text(seller.verification_status).toLowerCase());
    if (!eligible) {
      return reply(
        { success: false, error: 'An active GST-verified seller account is required for dispatch.' },
        403
      );
    }

    const [sellerUserResult, registrationResult] = await Promise.all([
      admin
        .from('user_profiles')
        .select('full_name,email,phone,address_line1,address_line2,city,state,pincode')
        .eq('id', seller.user_id)
        .maybeSingle(),
      admin
        .from('seller_registrations')
        .select('owner_name,email,phone,address,city,state,pincode')
        .eq('user_id', seller.user_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const rawSellerUser = sellerUserResult.data;
    const rawRegistration = registrationResult.data;
    const sellerUser = (rawSellerUser || {}) as unknown as BuyerUser;
    const registration = (rawRegistration || {}) as unknown as {
      owner_name?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
    };
    const pickupJson = (seller.pickup_address || {}) as JsonMap;
    const sellerPickup = address({
      line1: pickupJson.line1 || pickupJson.address || registration.address || sellerUser.address_line1,
      line2: pickupJson.line2 || sellerUser.address_line2,
      city: pickupJson.city || registration.city || sellerUser.city,
      state: pickupJson.state || registration.state || sellerUser.state,
      pincode: pickupJson.pincode || registration.pincode || sellerUser.pincode,
      country: pickupJson.country || 'India',
    });
    const sellerName =
      text(seller.display_name) ||
      text(seller.legal_business_name) ||
      text(registration.owner_name) ||
      text(sellerUser.full_name) ||
      'FabricTrad Seller';
    const sellerEmail = text(sellerUser.email) || text(registration.email);
    const sellerPhone = phone(sellerUser.phone || registration.phone);
    if (!addressComplete(sellerPickup) || sellerPickup.line1.length < 10 || !sellerEmail || !sellerPhone) {
      return reply(
        {
          success: false,
          error: 'Seller pickup address, email and mobile number are incomplete. Update Business settings before dispatch.',
        },
        409
      );
    }

    let buyerId = '';
    let buyerName = '';
    let buyerCompany = '';
    let buyerEmail = '';
    let buyerPhone = '';
    let buyerGstin = '';
    let billing = address();
    let shipping = address();
    let orderTotal = 0;
    let orderDate = new Date().toISOString();
    let items: Array<{
      name: string;
      sku: string;
      quantity: number;
      unit: string;
      price: number;
      tax: number;
      hsn: string;
    }> = [];
    let shipmentKey: 'catalog_order_id' | 'bulk_order_id' = 'bulk_order_id';
    let weightKg = positive(process.env.DEFAULT_SHIPMENT_WEIGHT_KG, 0.5);
    let lengthCm = positive(process.env.DEFAULT_SHIPMENT_LENGTH_CM, 20);
    let breadthCm = positive(process.env.DEFAULT_SHIPMENT_BREADTH_CM, 20);
    let heightCm = positive(process.env.DEFAULT_SHIPMENT_HEIGHT_CM, 10);

    if (orderType === 'catalog') {
      shipmentKey = 'catalog_order_id';
      const { data: rawOrder, error: orderError } = await admin
        .from('catalog_order_requests')
        .select(
          'id,buyer_id,seller_id,product_id,variant_id,company_id,company_location_id,status,payment_status,quantity,unit,price_per_unit,gst_rate,total_amount,created_at,buyer_gstin,buyer_gstin_verified,hsn_code,seller_products!catalog_order_requests_product_id_fkey(name,sku,gsm,width_inches,hsn_code,custom_attributes)'
        )
        .eq('id', orderId)
        .eq('seller_id', seller.id)
        .maybeSingle();
      if (orderError || !rawOrder) return reply({ success: false, error: 'Catalogue order not found.' }, 404);

      const order = rawOrder as unknown as {
        buyer_id: string;
        product_id: string;
        variant_id?: string | null;
        company_id?: string | null;
        company_location_id?: string | null;
        status: string;
        payment_status: string;
        quantity: number;
        unit: string;
        price_per_unit: number;
        gst_rate: number;
        total_amount: number;
        created_at: string;
        buyer_gstin?: string | null;
        buyer_gstin_verified?: boolean | null;
        hsn_code?: string | null;
        seller_products?: {
          name?: string | null;
          sku?: string | null;
          gsm?: number | null;
          width_inches?: number | null;
          hsn_code?: string | null;
          custom_attributes?: JsonMap | null;
        } | null;
      };
      if (order.status !== 'paid' || order.payment_status !== 'paid') {
        return reply({ success: false, error: 'Only fully captured paid orders can be shipped.' }, 409);
      }

      buyerId = order.buyer_id;
      orderTotal = numeric(order.total_amount);
      orderDate = order.created_at;

      const [buyerUserResult, buyerProfileResult] = await Promise.all([
        admin
          .from('user_profiles')
          .select('full_name,email,phone,address_line1,address_line2,city,state,pincode,business_name')
          .eq('id', buyerId)
          .maybeSingle(),
        admin
          .from('buyer_profiles')
          .select('business_name,gstin,gstin_verified,billing_address')
          .eq('user_id', buyerId)
          .maybeSingle(),
      ]);
      const buyerError = buyerUserResult.error;
      const rawBuyerUser = buyerUserResult.data;
      const rawBuyerProfile = buyerProfileResult.data;
      if (buyerError || !rawBuyerUser) {
        return reply({ success: false, error: 'Buyer delivery profile could not be loaded.' }, 409);
      }
      const buyerUser = rawBuyerUser as unknown as BuyerUser;
      const buyerProfile = (rawBuyerProfile || {}) as unknown as BuyerProfile;

      let companyName = '';
      let companyLocation: CompanyLocation | null = null;
      if (order.company_id) {
        const { data } = await admin
          .from('b2b_company_accounts')
          .select('company_name,gstin')
          .eq('id', order.company_id)
          .maybeSingle();
        const company = data as unknown as { company_name?: string | null; gstin?: string | null } | null;
        companyName = text(company?.company_name);
      }
      if (order.company_location_id) {
        const { data } = await admin
          .from('b2b_company_locations')
          .select('shipping_address,billing_address,gstin')
          .eq('id', order.company_location_id)
          .maybeSingle();
        companyLocation = data as unknown as CompanyLocation | null;
      }

      buyerName = text(buyerUser.full_name) || 'FabricTrad Buyer';
      buyerCompany = companyName || text(buyerProfile.business_name) || text(buyerUser.business_name);
      buyerEmail = text(buyerUser.email);
      buyerPhone = phone(buyerUser.phone);
      buyerGstin = order.buyer_gstin_verified === true ? text(order.buyer_gstin) : '';

      const profileJson = (buyerProfile.billing_address || {}) as JsonMap;
      const personal = address({
        line1: profileJson.line1 || buyerUser.address_line1,
        line2: profileJson.line2 || buyerUser.address_line2,
        city: profileJson.city || buyerUser.city,
        state: profileJson.state || buyerUser.state,
        pincode: profileJson.pincode || buyerUser.pincode,
        country: profileJson.country || 'India',
      });
      const companyShipping = companyLocation?.shipping_address || null;
      const companyBilling = companyLocation?.billing_address || null;
      shipping = companyShipping ? address(companyShipping) : personal;
      billing = companyBilling ? address(companyBilling) : personal;

      const product = order.seller_products || {};
      const attrs = (product.custom_attributes || {}) as JsonMap;
      lengthCm = positive(attrs.shipping_length_cm || attrs.package_length_cm, lengthCm);
      breadthCm = positive(attrs.shipping_breadth_cm || attrs.package_breadth_cm, breadthCm);
      heightCm = positive(attrs.shipping_height_cm || attrs.package_height_cm, heightCm);
      weightKg = positive(attrs.shipping_weight_kg || attrs.package_weight_kg, weightKg);
      if (
        text(order.unit).toLowerCase().startsWith('m') &&
        numeric(product.gsm) > 0 &&
        numeric(product.width_inches) > 0 &&
        numeric(order.quantity) > 0
      ) {
        const widthMetres = numeric(product.width_inches) * 0.0254;
        const fabricKg = (numeric(product.gsm) * widthMetres * numeric(order.quantity)) / 1000;
        weightKg = Math.max(0.1, Math.round(fabricKg * 1.08 * 1000) / 1000);
      }

      let variantLabel = '';
      let variantSku = '';
      if (order.variant_id) {
        const { data: rawVariant } = await admin
          .from('seller_product_variants')
          .select('color_name,design_name,variant_code')
          .eq('id', order.variant_id)
          .maybeSingle();
        const variant = rawVariant as unknown as {
          color_name?: string | null;
          design_name?: string | null;
          variant_code?: string | null;
        } | null;
        variantLabel = [variant?.color_name, variant?.design_name].filter(Boolean).join(' / ');
        variantSku = text(variant?.variant_code);
      }
      items = [
        {
          name: `${text(product.name) || 'Textile product'}${variantLabel ? ` · ${variantLabel}` : ''}`,
          sku: variantSku || text(product.sku) || order.product_id,
          quantity: numeric(order.quantity, 1),
          unit: text(order.unit) || 'unit',
          price: numeric(order.price_per_unit),
          tax: numeric(order.gst_rate),
          hsn: text(order.hsn_code) || text(product.hsn_code),
        },
      ];
    } else {
      const { data: rawOrder, error: orderError } = await admin
        .from('bulk_orders')
        .select(
          'id,buyer_id,seller_id,status,payment_status,buyer_name,buyer_company,buyer_gstin,buyer_email,net_total,created_at,bulk_order_items(product_name,sku,quantity_mtrs,price_per_mtr,gst_rate,line_total)'
        )
        .eq('id', orderId)
        .eq('seller_id', seller.id)
        .maybeSingle();
      if (orderError || !rawOrder) return reply({ success: false, error: 'Bulk order not found.' }, 404);
      const order = rawOrder as unknown as {
        buyer_id: string;
        status: string;
        payment_status: string;
        buyer_name?: string | null;
        buyer_company?: string | null;
        buyer_gstin?: string | null;
        buyer_email?: string | null;
        net_total: number;
        created_at: string;
        bulk_order_items?: Array<{
          product_name?: string | null;
          sku?: string | null;
          quantity_mtrs?: number | null;
          price_per_mtr?: number | null;
          gst_rate?: number | null;
        }>;
      };
      if (order.status !== 'paid' || order.payment_status !== 'paid') {
        return reply({ success: false, error: 'Only fully captured paid orders can be shipped.' }, 409);
      }

      buyerId = order.buyer_id;
      const [buyerUserResult2, buyerProfileResult2] = await Promise.all([
        admin
          .from('user_profiles')
          .select('full_name,email,phone,address_line1,address_line2,city,state,pincode,business_name')
          .eq('id', buyerId)
          .maybeSingle(),
        admin
          .from('buyer_profiles')
          .select('business_name,gstin,gstin_verified,billing_address')
          .eq('user_id', buyerId)
          .maybeSingle(),
      ]);
      const rawBuyerUser = buyerUserResult2.data;
      const rawBuyerProfile = buyerUserResult2.data !== undefined ? buyerProfileResult2.data : null;
      if (!rawBuyerUser) return reply({ success: false, error: 'Buyer delivery profile could not be loaded.' }, 409);
      const buyerUser = rawBuyerUser as unknown as BuyerUser;
      const buyerProfile = (rawBuyerProfile || {}) as unknown as BuyerProfile;
      const profileJson = (buyerProfile.billing_address || {}) as JsonMap;

      buyerName = text(order.buyer_name) || text(buyerUser.full_name) || 'FabricTrad Buyer';
      buyerCompany = text(order.buyer_company) || text(buyerProfile.business_name) || text(buyerUser.business_name);
      buyerEmail = text(order.buyer_email) || text(buyerUser.email);
      buyerPhone = phone(buyerUser.phone);
      buyerGstin = buyerProfile.gstin_verified === true ? text(order.buyer_gstin || buyerProfile.gstin) : '';
      shipping = address({
        line1: profileJson.line1 || buyerUser.address_line1,
        line2: profileJson.line2 || buyerUser.address_line2,
        city: profileJson.city || buyerUser.city,
        state: profileJson.state || buyerUser.state,
        pincode: profileJson.pincode || buyerUser.pincode,
        country: profileJson.country || 'India',
      });
      billing = shipping;
      orderTotal = numeric(order.net_total);
      orderDate = order.created_at;
      const rawItems = Array.isArray(order.bulk_order_items) ? order.bulk_order_items : [];
      items = rawItems.map((item) => ({
        name: text(item.product_name) || 'Bulk textile',
        sku: text(item.sku) || orderId,
        quantity: numeric(item.quantity_mtrs, 1),
        unit: 'mtr',
        price: numeric(item.price_per_mtr),
        tax: numeric(item.gst_rate),
        hsn: '',
      }));

      const skus = [...new Set(items.map((item) => item.sku).filter(Boolean))];
      if (skus.length) {
        const { data: productRows } = await admin
          .from('seller_products')
          .select('sku,gsm,width_inches,custom_attributes')
          .eq('seller_id', seller.id)
          .in('sku', skus);
        const products = (productRows || []) as unknown as Array<{
          sku?: string | null;
          gsm?: number | null;
          width_inches?: number | null;
          custom_attributes?: JsonMap | null;
        }>;
        let estimatedKg = 0;
        for (const item of items) {
          const product = products.find((candidate) => text(candidate.sku) === item.sku);
          if (product && numeric(product.gsm) > 0 && numeric(product.width_inches) > 0) {
            estimatedKg +=
              (numeric(product.gsm) * numeric(product.width_inches) * 0.0254 * item.quantity) / 1000;
          }
        }
        if (estimatedKg > 0) weightKg = Math.max(0.1, Math.round(estimatedKg * 1.08 * 1000) / 1000);
      }
    }

    if (!buyerEmail || !buyerPhone || !addressComplete(shipping) || !addressComplete(billing)) {
      return reply(
        {
          success: false,
          error: 'Buyer delivery address, email or mobile is incomplete. Ask the buyer to update Profile & settings before dispatch.',
        },
        409
      );
    }
    if (!items.length || items.some((item) => item.quantity <= 0 || item.price < 0)) {
      return reply({ success: false, error: 'Order line quantity or price is invalid.' }, 409);
    }

    const { data: existing } = await admin
      .from('seller_shipments')
      .select('shiprocket_order_id,shiprocket_shipment_id,awb_number,courier_name,tracking_url,status,label_url,manifest_url,pickup_scheduled')
      .eq(shipmentKey, orderId)
      .maybeSingle();
    if (existing?.shiprocket_order_id) return reply({ success: true, existing: true, shipment: existing });

    const pickupLocation = uniquePickupName(
      seller.shiprocket_pickup_location,
      seller.seller_ref,
      seller.id
    );
    if (pickupLocation !== text(seller.shiprocket_pickup_location)) {
      await admin.from('seller_profiles').update({ shiprocket_pickup_location: pickupLocation }).eq('id', seller.id);
    }

    weightKg = Math.max(0.1, Math.round(weightKg * 1000) / 1000);
    const { token, source } = await authenticate();
    const courier = await serviceableCourier({
      token,
      pickup: sellerPickup.pincode,
      delivery: shipping.pincode,
      weight: weightKg,
      length: lengthCm,
      breadth: breadthCm,
      height: heightCm,
      value: orderTotal,
    });

    const shippingIsBilling = addressesMatch(billing, shipping);
    const payload: Record<string, unknown> = {
      mode: 'Surface',
      request_pickup: true,
      print_label: true,
      generate_manifest: true,
      courier_id: Number(courier.id),
      order_id: `FT${orderType === 'catalog' ? 'C' : 'B'}${orderId.replace(/-/g, '').slice(0, 30)}`,
      order_date: new Date(orderDate || Date.now()).toISOString().slice(0, 10),
      pickup_location: pickupLocation,
      reseller_name: sellerName,
      comment: `Reseller: ${sellerName}`,
      company_name: buyerCompany || undefined,
      billing_customer_name: buyerName,
      billing_last_name: '',
      billing_address: billing.line1,
      billing_address_2: billing.line2,
      billing_city: billing.city,
      billing_pincode: Number(billing.pincode),
      billing_state: billing.state,
      billing_country: billing.country,
      billing_email: buyerEmail,
      billing_phone: Number(buyerPhone),
      shipping_is_billing: shippingIsBilling ? 1 : 0,
      shipping_customer_name: shippingIsBilling ? undefined : buyerName,
      shipping_last_name: shippingIsBilling ? undefined : '',
      shipping_address: shippingIsBilling ? undefined : shipping.line1,
      shipping_address_2: shippingIsBilling ? undefined : shipping.line2,
      shipping_city: shippingIsBilling ? undefined : shipping.city,
      shipping_pincode: shippingIsBilling ? undefined : Number(shipping.pincode),
      shipping_state: shippingIsBilling ? undefined : shipping.state,
      shipping_country: shippingIsBilling ? undefined : shipping.country,
      shipping_email: shippingIsBilling ? undefined : buyerEmail,
      shipping_phone: shippingIsBilling ? undefined : Number(buyerPhone),
      order_items: items.map((item) => ({
        name: `${item.name}${item.unit ? ` (${item.quantity} ${item.unit})` : ''}`.slice(0, 120),
        sku: item.sku.slice(0, 50),
        units: item.quantity,
        selling_price: money(item.price),
        discount: 0,
        tax: item.tax,
        hsn: item.hsn,
      })),
      payment_method: 'Prepaid',
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: money(orderTotal),
      length: lengthCm,
      breadth: breadthCm,
      height: heightCm,
      weight: weightKg,
      customer_gstin: buyerGstin || undefined,
    };

    if (seller.shiprocket_pickup_registered !== true) {
      payload.vendor_details = {
        email: sellerEmail,
        phone: Number(sellerPhone),
        name: sellerName,
        address: sellerPickup.line1,
        address_2: sellerPickup.line2,
        city: sellerPickup.city,
        state: sellerPickup.state,
        country: sellerPickup.country,
        pin_code: Number(sellerPickup.pincode),
        pickup_location: pickupLocation,
      };
    }

    const forward = await fetch(`${API}/shipments/create/forward-shipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const forwardPayload = await forward.json().catch(() => ({}));
    const result = unpackForwardResponse(forwardPayload);
    if (!forward.ok || !result.orderId || !result.shipmentId) {
      console.error('Shiprocket forward shipment rejected', {
        status: forward.status,
        message: result.message,
        orderId,
        orderType,
        sellerId: seller.id,
      });
      return reply({ success: false, error: result.message || 'Automatic courier booking failed.' }, 502);
    }

    await admin
      .from('seller_profiles')
      .update({
        shiprocket_pickup_location: pickupLocation,
        shiprocket_pickup_registered: true,
        shiprocket_pickup_synced_at: new Date().toISOString(),
      })
      .eq('id', seller.id);

    const trackingUrl = result.awb
      ? `https://shiprocket.co/tracking/${encodeURIComponent(result.awb)}`
      : null;
    const shipment = {
      order_id: orderId,
      bulk_order_id: orderType === 'bulk' ? orderId : null,
      catalog_order_id: orderType === 'catalog' ? orderId : null,
      buyer_id: buyerId || null,
      seller_id: seller.id,
      courier_type: 'shiprocket',
      courier_name: result.courierName || courier.name || null,
      shiprocket_courier_id: courier.id,
      awb_number: result.awb || null,
      tracking_url: trackingUrl,
      shiprocket_order_id: String(result.orderId),
      shiprocket_shipment_id: String(result.shipmentId),
      pickup_location_name: pickupLocation,
      shipping_cost: courier.cost || null,
      label_url: result.labelUrl || null,
      manifest_url: result.manifestUrl || null,
      pickup_scheduled: true,
      serviceability_snapshot: courier.snapshot,
      status: 'pending',
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await admin
      .from('seller_shipments')
      .upsert(shipment, { onConflict: shipmentKey });
    if (saveError) throw saveError;

    // Send invoice/shipment notification email to buyer via order-notifications edge function
    if (buyerEmail) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          await fetch(`${supabaseUrl}/functions/v1/order-notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              type: 'buyer_order_status',
              orderId,
              orderRef: `FT${orderType === 'catalog' ? 'C' : 'B'}${orderId.slice(0, 8).toUpperCase()}`,
              status: 'shipped',
              buyerEmail,
              buyerName,
              amount: orderTotal,
              awb: result.awb || null,
              courierName: result.courierName || courier.name || null,
              trackingUrl,
              eta: courier.etd || null,
            }),
            signal: AbortSignal.timeout(10_000),
          }).catch(() => null); // Non-blocking
        }
      } catch {
        // Non-blocking — don't fail shipment creation if email fails
      }
    }

    return reply({
      success: true,
      orderType,
      credentialSource: source,
      pickupLocation,
      shiprocketOrderId: result.orderId,
      shipmentId: result.shipmentId,
      awb: result.awb || null,
      courierName: result.courierName || courier.name || null,
      shippingCost: courier.cost || null,
      eta: courier.etd || null,
      labelUrl: result.labelUrl || null,
      manifestUrl: result.manifestUrl || null,
      trackingUrl,
    });
  } catch (error) {
    console.error('Shiprocket order creation failed:', error);
    const message = error instanceof Error ? error.message : 'Courier order creation failed.';
    const unavailable = message.includes('not configured');
    return reply(
      { success: false, error: unavailable ? 'Courier service is not configured.' : message },
      unavailable ? 503 : 500
    );
  }
}
