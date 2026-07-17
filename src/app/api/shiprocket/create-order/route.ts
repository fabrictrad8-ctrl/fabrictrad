import { NextRequest, NextResponse } from 'next/server';

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL || '';
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD || '';
const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';

async function getShiprocketToken(): Promise<string> {
  const res = await fetch(`${SHIPROCKET_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SHIPROCKET_EMAIL, password: SHIPROCKET_PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error('Shiprocket auth failed');
  return data.token;
}

export async function POST(request: NextRequest) {
  try {
    const {
      fabricTradOrderRef,
      buyerName,
      buyerPhone,
      buyerEmail,
      shippingAddress,
      productName,
      sku,
      quantity,
      declaredValue,
      weightKg,
      length,
      breadth,
      height,
      sellerPickupAddress,
    } = await request.json();

    if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
      // Dev mock mode
      return NextResponse.json({
        success: true,
        mock: true,
        message: 'Shiprocket credentials not configured — mock order created',
        shiprocketOrderId: `MOCK-${Date.now()}`,
        shipmentId: `MOCK-SHP-${Date.now()}`,
      });
    }

    const token = await getShiprocketToken();

    const orderPayload = {
      order_id: fabricTradOrderRef,
      order_date: new Date().toISOString().split('T')[0],
      pickup_location: sellerPickupAddress?.name || 'Primary',
      billing_customer_name: buyerName,
      billing_last_name: '',
      billing_address: shippingAddress?.line1 || '',
      billing_address_2: shippingAddress?.line2 || '',
      billing_city: shippingAddress?.city || '',
      billing_pincode: shippingAddress?.pincode || '',
      billing_state: shippingAddress?.state || '',
      billing_country: 'India',
      billing_email: buyerEmail || '',
      billing_phone: buyerPhone,
      shipping_is_billing: true,
      order_items: [
        {
          name: productName,
          sku: sku || fabricTradOrderRef,
          units: quantity,
          selling_price: declaredValue,
          discount: 0,
          tax: 0,
          hsn: 5007,
        },
      ],
      payment_method: 'Prepaid',
      sub_total: declaredValue,
      length: length || 10,
      breadth: breadth || 10,
      height: height || 10,
      weight: weightKg || 0.5,
    };

    const res = await fetch(`${SHIPROCKET_API}/orders/create/adhoc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.message || 'Shiprocket order creation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      shiprocketOrderId: data.order_id,
      shipmentId: data.shipment_id,
      awb: data.awb_code,
      courierName: data.courier_name,
    });
  } catch (error: unknown) {
    console.error('[Shiprocket] Order creation error:', error);
    const message = error instanceof Error ? error.message : 'Shiprocket integration error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
