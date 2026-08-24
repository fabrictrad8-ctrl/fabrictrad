import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getShiprocketCredentials } from '@/lib/shiprocketCredentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';
type OrderType = 'bulk' | 'catalog';
type AddressRecord = Record<string, unknown>;

type CourierOption = {
  courier_company_id?: number | string;
  courier_name?: string;
  freight_charge?: number | string;
  rate?: number | string;
  etd?: string;
  estimated_delivery_days?: number | string;
  rating?: number | string;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const text = (value: unknown) => String(value || '').trim();
const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const positiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const roundMoney = (value: number) => Math.round(value * 100) / 100;

const normalizePhone = (value: unknown) => {
  let digits = text(value).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(-10);
  return /^\d{10}$/.test(digits) ? digits : '';
};

const normalizePincode = (value: unknown) => {
  const digits = text(value).replace(/\D/g, '').slice(0, 6);
  return /^\d{6}$/.test(digits) ? digits : '';
};

const addressFrom = (raw: AddressRecord | null | undefined) => ({
  line1: text(raw?.line1 || raw?.addressLine1 || raw?.address_line1 || raw?.address),
  line2: text(raw?.line2 || raw?.addressLine2 || raw?.address_line2),
  city: text(raw?.city),
  state: text(raw?.state),
  pincode: normalizePincode(raw?.pincode || raw?.postalCode || raw?.postal_code || raw?.pin_code),
  country: text(raw?.country) || 'India',
});

const sameAddress = (
  left: ReturnType<typeof addressFrom>,
  right: ReturnType<typeof addressFrom>
) =>
  left.line1.toLowerCase() === right.line1.toLowerCase() &&
  left.city.toLowerCase() === right.city.toLowerCase() &&
  left.state.toLowerCase() === right.state.toLowerCase() &&
  left.pincode === right.pincode;

const pickupLocationName = (existing: unknown, sellerRef: unknown, sellerId: string) => {
  const current = text(existing).replace(/[^a-zA-Z0-9]/g, '').slice(0, 36);
  if (current) return current;
  const seed = text(sellerRef).replace(/[^a-zA-Z0-9]/g, '') || sellerId.replace(/-/g, '');
  return `FT${seed}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 36);
};

async function getShiprocketToken() {
  const credentials = await getShiprocketCredentials();
  if (!credentials) throw new Error('Shiprocket is not configured.');

  const response = await fetch(`${SHIPROCKET_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
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
  return { token: data.token, source: credentials.source };
}

async function chooseCourier(params: {
  token: string;
  pickupPincode: string;
  deliveryPincode: string;
  weight: number;
  length: number;
  breadth: number;
  height: number;
  declaredValue: number;
}) {
  const url = new URL(`${SHIPROCKET_API}/courier/serviceability/`);
  url.searchParams.set('pickup_postcode', params.pickupPincode);
  url.searchParams.set('delivery_postcode', params.deliveryPincode);
  url.searchParams.set('cod', '0');
  url.searchParams.set('weight', String(params.weight));
  url.searchParams.set('length', String(params.length));
  url.searchParams.set('breadth', String(params.breadth));
  url.searchParams.set('height', String(params.height));
  url.searchParams.set('declared_value', String(Math.max(params.declaredValue, 1)));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${params.token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: {
      recommended_courier_company_id?: number | string;
      available_courier_companies?: CourierOption[];
    };
  };
  if (!response.ok) {
    throw new Error(payload.message || 'Courier serviceability check failed.');
  }

  const options = Array.isArray(payload.data?.available_courier_companies)
    ? payload.data?.available_courier_companies || []
    : [];
  if (!options.length) {
    throw new Error('No prepaid courier is currently serviceable for this seller-to-buyer route.');
  }

  const recommendedId = text(payload.data?.recommended_courier_company_id);
  let selected = recommendedId
    ? options.find((option) => text(option.courier_company_id) === recommendedId)
    : undefined;

  if (!selected) {
    selected = [...options].sort((a, b) => {
      const aCost = positiveNumber(a.freight_charge ?? a.rate, Number.MAX_SAFE_INTEGER);
      const bCost = positiveNumber(b.freight_charge ?? b.rate, Number.MAX_SAFE_INTEGER);
      if (aCost !== bCost) return aCost - bCost;
      return number(b.rating) - number(a.rating);
    })[0];
  }

  const courierId = text(selected?.courier_company_id);
  if (!courierId) throw new Error('Shiprocket did not return a usable courier for this route.');

  return {
    id: courierId,
    name: text(selected?.courier_name) || 'Shiprocket courier',
    cost: roundMoney(positiveNumber(selected?.freight_charge ?? selected?.rate, 0)),
    etd: text(selected?.etd),
    snapshot: {
      selected: {
        courier_company_id: courierId,
        courier_name: text(selected?.courier_name),
        freight_charge: positiveNumber(selected?.freight_charge ?? selected?.rate, 0),
        etd: text(selected?.etd),
        rating: number(selected?.rating),
      },
      available_count: options.length,
      recommended_courier_company_id: recommendedId || null,
    },
  };
}

const parseForwardResponse = (value: unknown) => {
  const root = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      if (root[key] !== undefined && root[key] !== null) return root[key];
      if (nested[key] !== undefined && nested[key] !== null) return nested[key];
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
      .select(
        'id,user_id,seller_ref,display_name,legal_business_name,gstin,gstin_verified,pickup_address,is_active,verification_status,shiprocket_pickup_location,shiprocket_pickup_registered'
      )
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

    const [{ data: sellerUser }, { data: sellerRegistration }] = await Promise.all([
      admin
        .from('user_profiles')
        .select('full_name,email,phone,address_line1,address_line2,city,state,pincode')
        .eq('id', sellerProfile.user_id)
        .maybeSingle(),
      admin
        .from('seller_registrations')
        .select('owner_name,email,phone,address,city,state,pincode')
        .eq('user_id', sellerProfile.user_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const sellerName =
      text(sellerProfile.display_name) ||
      text(sellerProfile.legal_business_name) ||
      text(sellerRegistration?.owner_name) ||
      text(sellerUser?.full_name) ||
      'FabricTrad Seller';
    const sellerEmail = text(sellerUser?.email) || text(sellerRegistration?.email);
    const sellerPhone = normalizePhone(sellerUser?.phone || sellerRegistration?.phone);
    const pickupRaw = (sellerProfile.pickup_address || {}) as AddressRecord;
    const sellerPickup = addressFrom({
      line1: pickupRaw.line1 || pickupRaw.address || sellerRegistration?.address || sellerUser?.address_line1,
      line2: pickupRaw.line2 || sellerUser?.address_line2,
      city: pickupRaw.city || sellerRegistration?.city || sellerUser?.city,
      state: pickupRaw.state || sellerRegistration?.state || sellerUser?.state,
      pincode: pickupRaw.pincode || sellerRegistration?.pincode || sellerUser?.pincode,
      country: pickupRaw.country || 'India',
    });

    if (
      sellerPickup.line1.length < 10 ||
      !sellerPickup.city ||
      !sellerPickup.state ||
      !sellerPickup.pincode ||
      !sellerEmail ||
      !sellerPhone
    ) {
      return json(
        {
          success: false,
          error:
            'Seller pickup address, email and mobile number are incomplete. Update Business settings before dispatch.',
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
    let billingAddress = addressFrom({});
    let shippingAddress = addressFrom({});
    let orderTotal = 0;
    let orderCreatedAt: string | null = null;
    let items: Array<Record<string, unknown>> = [];
    let shipmentLookupColumn: 'bulk_order_id' | 'catalog_order_id' = 'bulk_order_id';
    let calculatedWeightKg = positiveNumber(process.env.DEFAULT_SHIPMENT_WEIGHT_KG, 0.5);
    let lengthCm = positiveNumber(process.env.DEFAULT_SHIPMENT_LENGTH_CM, 20);
    let breadthCm = positiveNumber(process.env.DEFAULT_SHIPMENT_BREADTH_CM, 20);
    let heightCm = positiveNumber(process.env.DEFAULT_SHIPMENT_HEIGHT_CM, 10);

    if (orderType === 'catalog') {
      shipmentLookupColumn = 'catalog_order_id';
      const { data: catalogOrder, error: catalogError } = await admin
        .from('catalog_order_requests')
        .select(
          'id,buyer_id,seller_id,product_id,variant_id,company_id,company_location_id,status,payment_status,quantity,unit,price_per_unit,gst_rate,total_amount,subtotal,created_at,buyer_gstin,buyer_gstin_verified,hsn_code,seller_products!catalog_order_requests_product_id_fkey(name,sku,gsm,width_inches,hsn_code,custom_attributes)'
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
      orderTotal = number(catalogOrder.total_amount);
      orderCreatedAt = catalogOrder.created_at;

      const [{ data: buyerUser, error: buyerUserError }, { data: buyerProfile }] =
        await Promise.all([
          admin
            .from('user_profiles')
            .select(
              'full_name,email,phone,address_line1,address_line2,city,state,pincode,business_name,gstin'
            )
            .eq('id', buyerId)
            .maybeSingle(),
          admin
            .from('buyer_profiles')
            .select('business_name,gstin,gstin_verified,billing_address')
            .eq('user_id', buyerId)
            .maybeSingle(),
        ]);
      if (buyerUserError || !buyerUser) {
        return json({ success: false, error: 'Buyer delivery profile could not be loaded.' }, 409);
      }

      let company: { company_name?: string | null; gstin?: string | null } | null = null;
      let companyLocation: {
        shipping_address?: AddressRecord | null;
        billing_address?: AddressRecord | null;
        gstin?: string | null;
      } | null = null;
      if (catalogOrder.company_id) {
        const { data } = await admin
          .from('b2b_company_accounts')
          .select('company_name,gstin')
          .eq('id', catalogOrder.company_id)
          .maybeSingle();
        company = data;
      }
      if (catalogOrder.company_location_id) {
        const { data } = await admin
          .from('b2b_company_locations')
          .select('shipping_address,billing_address,gstin')
          .eq('id', catalogOrder.company_location_id)
          .maybeSingle();
        companyLocation = data as typeof companyLocation;
      }

      buyerName = text(buyerUser.full_name) || 'FabricTrad Buyer';
      buyerCompany =
        text(company?.company_name) ||
        text(buyerProfile?.business_name) ||
        text(buyerUser.business_name);
      buyerEmail = text(buyerUser.email);
      buyerPhone = normalizePhone(buyerUser.phone);
      buyerGstin = catalogOrder.buyer_gstin_verified === true ? text(catalogOrder.buyer_gstin) : '';

      const personalAddress = addressFrom({
        ...((buyerProfile?.billing_address || {}) as AddressRecord),
        line1:
          ((buyerProfile?.billing_address || {}) as AddressRecord).line1 || buyerUser.address_line1,
        line2:
          ((buyerProfile?.billing_address || {}) as AddressRecord).line2 || buyerUser.address_line2,
        city: ((buyerProfile?.billing_address || {}) as AddressRecord).city || buyerUser.city,
        state: ((buyerProfile?.billing_address || {}) as AddressRecord).state || buyerUser.state,
        pincode:
          ((buyerProfile?.billing_address || {}) as AddressRecord).pincode || buyerUser.pincode,
      });
      shippingAddress = companyLocation?.shipping_address
        ? addressFrom(companyLocation.shipping_address)
        : personalAddress;
      billingAddress = companyLocation?.billing_address
        ? addressFrom(companyLocation.billing_address)
        : personalAddress;

      const product = catalogOrder.seller_products as unknown as {
        name?: string | null;
        sku?: string | null;
        gsm?: number | null;
        width_inches?: number | null;
        hsn_code?: string | null;
        custom_attributes?: Record<string, unknown> | null;
      } | null;
      const customAttributes = (product?.custom_attributes || {}) as Record<string, unknown>;
      lengthCm = positiveNumber(
        customAttributes.shipping_length_cm || customAttributes.package_length_cm,
        lengthCm
      );
      breadthCm = positiveNumber(
        customAttributes.shipping_breadth_cm || customAttributes.package_breadth_cm,
        breadthCm
      );
      heightCm = positiveNumber(
        customAttributes.shipping_height_cm || customAttributes.package_height_cm,
        heightCm
      );
      calculatedWeightKg = positiveNumber(
        customAttributes.shipping_weight_kg || customAttributes.package_weight_kg,
        calculatedWeightKg
      );
      if (
        text(catalogOrder.unit).toLowerCase().startsWith('m') &&
        number(product?.gsm) > 0 &&
        number(product?.width_inches) > 0 &&
        number(catalogOrder.quantity) > 0
      ) {
        const widthMetres = number(product?.width_inches) * 0.0254;
        const fabricKg =
          (number(product?.gsm) * widthMetres * number(catalogOrder.quantity)) / 1000;
        calculatedWeightKg = Math.max(0.1, Math.round(fabricKg * 1.08 * 1000) / 1000);
      }

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
          quantity: number(catalogOrder.quantity, 1),
          unit: text(catalogOrder.unit) || 'unit',
          price: number(catalogOrder.price_per_unit),
          gst_rate: number(catalogOrder.gst_rate),
          hsn: text(catalogOrder.hsn_code) || text(product?.hsn_code),
        },
      ];
    } else {
      const { data: bulkOrder, error: bulkError } = await admin
        .from('bulk_orders')
        .select(
          'id,buyer_id,seller_id,status,payment_status,buyer_name,buyer_company,buyer_gstin,buyer_email,net_total,created_at,bulk_order_items(product_name,sku,quantity_mtrs,price_per_mtr,gst_rate,line_total)'
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
      const [{ data: buyerUser }, { data: buyerProfile }] = await Promise.all([
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
      if (!buyerUser) {
        return json({ success: false, error: 'Buyer delivery profile could not be loaded.' }, 409);
      }

      buyerName = text(bulkOrder.buyer_name) || text(buyerUser.full_name) || 'FabricTrad Buyer';
      buyerCompany =
        text(bulkOrder.buyer_company) ||
        text(buyerProfile?.business_name) ||
        text(buyerUser.business_name);
      buyerEmail = text(bulkOrder.buyer_email) || text(buyerUser.email);
      buyerPhone = normalizePhone(buyerUser.phone);
      buyerGstin = buyerProfile?.gstin_verified === true ? text(bulkOrder.buyer_gstin || buyerProfile.gstin) : '';
      const profileAddress = (buyerProfile?.billing_address || {}) as AddressRecord;
      shippingAddress = addressFrom({
        line1: profileAddress.line1 || buyerUser.address_line1,
        line2: profileAddress.line2 || buyerUser.address_line2,
        city: profileAddress.city || buyerUser.city,
        state: profileAddress.state || buyerUser.state,
        pincode: profileAddress.pincode || buyerUser.pincode,
        country: profileAddress.country || 'India',
      });
      billingAddress = shippingAddress;
      orderTotal = number(bulkOrder.net_total);
      orderCreatedAt = bulkOrder.created_at;
      items = (Array.isArray(bulkOrder.bulk_order_items) ? bulkOrder.bulk_order_items : []).map(
        (item: Record<string, unknown>) => ({
          product_name: item.product_name,
          sku: item.sku,
          quantity: number(item.quantity_mtrs, 1),
          unit: 'mtr',
          price: number(item.price_per_mtr),
          gst_rate: number(item.gst_rate),
          hsn: '',
        })
      );
    }

    if (
      !buyerPhone ||
      !buyerEmail ||
      !shippingAddress.line1 ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.pincode ||
      !billingAddress.line1 ||
      !billingAddress.city ||
      !billingAddress.state ||
      !billingAddress.pincode
    ) {
      return json(
        {
          success: false,
          error:
            'Buyer shipping/contact details are incomplete. Ask the buyer to update Profile & settings before dispatch.',
        },
        409
      );
    }
    if (!items.length || items.some((item) => number(item.quantity) <= 0 || number(item.price) < 0)) {
      return json({ success: false, error: 'Order line quantity or price is invalid.' }, 409);
    }

    const { data: existing } = await admin
      .from('seller_shipments')
      .select(
        'shiprocket_order_id,shiprocket_shipment_id,awb_number,courier_name,tracking_url,status,label_url,manifest_url,pickup_scheduled'
      )
      .eq(shipmentLookupColumn, orderId)
      .maybeSingle();
    if (existing?.shiprocket_order_id) {
      return json({ success: true, existing: true, shipment: existing });
    }

    const locationName = pickupLocationName(
      sellerProfile.shiprocket_pickup_location,
      sellerProfile.seller_ref,
      sellerProfile.id
    );
    if (locationName !== sellerProfile.shiprocket_pickup_location) {
      await admin
        .from('seller_profiles')
        .update({ shiprocket_pickup_location: locationName })
        .eq('id', sellerProfile.id);
    }

    const weightKg = Math.max(0.1, Math.round(calculatedWeightKg * 1000) / 1000);
    const { token, source: credentialSource } = await getShiprocketToken();
    const courier = await chooseCourier({
      token,
      pickupPincode: sellerPickup.pincode,
      deliveryPincode: shippingAddress.pincode,
      weight: weightKg,
      length: lengthCm,
      breadth: breadthCm,
      height: heightCm,
      declaredValue: orderTotal,
    });

    const shippingIsBilling = sameAddress(billingAddress, shippingAddress);
    const commonPayload: Record<string, unknown> = {
      mode: 'surface',
      request_pickup: true,
      print_label: true,
      generate_manifest: true,
      courier_id: Number(courier.id),
      order_id: `FT${orderType === 'catalog' ? 'C' : 'B'}${orderId.replace(/-/g, '').slice(0, 30)}`,
      order_date: new Date(orderCreatedAt || Date.now()).toISOString().slice(0, 10),
      pickup_location: locationName,
      reseller_name: sellerName,
      comment: `Reseller: ${sellerName}`,
      company_name: buyerCompany || undefined,
      billing_customer_name: buyerName,
      billing_last_name: '',
      billing_address: billingAddress.line1,
      billing_address_2: billingAddress.line2,
      billing_city: billingAddress.city,
      billing_pincode: Number(billingAddress.pincode),
      billing_state: billingAddress.state,
      billing_country: billingAddress.country,
      billing_email: buyerEmail,
      billing_phone: Number(buyerPhone),
      shipping_is_billing: shippingIsBilling,
      shipping_customer_name: shippingIsBilling ? undefined : buyerName,
      shipping_last_name: shippingIsBilling ? undefined : '',
      shipping_address: shippingIsBilling ? undefined : shippingAddress.line1,
      shipping_address_2: shippingIsBilling ? undefined : shippingAddress.line2,
      shipping_city: shippingIsBilling ? undefined : shippingAddress.city,
      shipping_pincode: shippingIsBilling ? undefined : Number(shippingAddress.pincode),
      shipping_state: shippingIsBilling ? undefined : shippingAddress.state,
      shipping_country: shippingIsBilling ? undefined : shippingAddress.country,
      shipping_email: shippingIsBilling ? undefined : buyerEmail,
      shipping_phone: shippingIsBilling ? undefined : Number(buyerPhone),
      order_items: items.map((item) => ({
        name: `${text(item.product_name) || 'Textile product'}${item.unit ? ` (${number(item.quantity)} ${text(item.unit)})` : ''}`.slice(0, 120),
        sku: (text(item.sku) || orderId).slice(0, 50),
        units: number(item.quantity, 1),
        selling_price: roundMoney(number(item.price)),
        discount: 0,
        tax: number(item.gst_rate),
        hsn: text(item.hsn),
      })),
      payment_method: 'PREPAID',
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: roundMoney(orderTotal),
      length: lengthCm,
      breadth: breadthCm,
      height: heightCm,
      weight: weightKg,
      customer_gstin: buyerGstin || undefined,
    };

    if (sellerProfile.shiprocket_pickup_registered !== true) {
      commonPayload.vendor_details = {
        email: sellerEmail,
        phone: Number(sellerPhone),
        name: sellerName,
        address: sellerPickup.line1,
        address_2: sellerPickup.line2,
        city: sellerPickup.city,
        state: sellerPickup.state,
        country: sellerPickup.country,
        pin_code: Number(sellerPickup.pincode),
        pickup_location: locationName,
      };
    }

    const response = await fetch(`${SHIPROCKET_API}/shipments/create/forward-shipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(commonPayload),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    const rawData = await response.json().catch(() => ({}));
    const data = parseForwardResponse(rawData);
    if (!response.ok || !data.orderId || !data.shipmentId) {
      console.error('Shiprocket forward shipment rejected', {
        status: response.status,
        message: data.message,
        orderId,
        orderType,
        sellerId: sellerProfile.id,
      });
      return json(
        { success: false, error: data.message || 'Automatic courier booking failed.' },
        502
      );
    }

    await admin
      .from('seller_profiles')
      .update({
        shiprocket_pickup_location: locationName,
        shiprocket_pickup_registered: true,
        shiprocket_pickup_synced_at: new Date().toISOString(),
      })
      .eq('id', sellerProfile.id);

    const trackingUrl = data.awb ? `https://shiprocket.co/tracking/${encodeURIComponent(data.awb)}` : null;
    const shipmentPayload = {
      order_id: orderId,
      bulk_order_id: orderType === 'bulk' ? orderId : null,
      catalog_order_id: orderType === 'catalog' ? orderId : null,
      buyer_id: buyerId || null,
      seller_id: sellerProfile.id,
      courier_type: 'shiprocket',
      courier_name: data.courierName || courier.name || null,
      shiprocket_courier_id: courier.id,
      awb_number: data.awb || null,
      tracking_url: trackingUrl,
      shiprocket_order_id: String(data.orderId),
      shiprocket_shipment_id: String(data.shipmentId),
      pickup_location_name: locationName,
      shipping_cost: courier.cost || null,
      label_url: data.labelUrl || null,
      manifest_url: data.manifestUrl || null,
      pickup_scheduled: true,
      serviceability_snapshot: courier.snapshot,
      status: data.awb ? 'picked_up' : 'pending',
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await admin
      .from('seller_shipments')
      .upsert(shipmentPayload, { onConflict: shipmentLookupColumn });
    if (saveError) throw saveError;

    return json({
      success: true,
      orderType,
      credentialSource,
      pickupLocation: locationName,
      shiprocketOrderId: data.orderId,
      shipmentId: data.shipmentId,
      awb: data.awb || null,
      courierName: data.courierName || courier.name || null,
      shippingCost: courier.cost || null,
      eta: courier.etd || null,
      labelUrl: data.labelUrl || null,
      manifestUrl: data.manifestUrl || null,
      trackingUrl,
    });
  } catch (error) {
    console.error('Shiprocket order creation failed:', error);
    const message = error instanceof Error ? error.message : 'Courier order creation failed.';
    const unavailable = message.includes('not configured');
    return json(
      {
        success: false,
        error: unavailable ? 'Courier service is not configured.' : message,
      },
      unavailable ? 503 : 500
    );
  }
}
