import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';

async function getToken() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) return null;
  const response = await fetch(`${SHIPROCKET_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  return response.ok && data.token ? String(data.token) : null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });

    const orderId = new URL(request.url).searchParams.get('order_id');
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'order_id is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: shipment } = await admin
      .from('seller_shipments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    if (!shipment) return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });

    const { data: seller } = await admin
      .from('seller_profiles')
      .select('user_id')
      .eq('id', shipment.seller_id)
      .maybeSingle();
    const { data: profile } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const authorized =
      shipment.buyer_id === user.id ||
      seller?.user_id === user.id ||
      profile?.role === 'super_admin' ||
      profile?.role === 'admin_staff';
    if (!authorized) return NextResponse.json({ success: false, error: 'Shipment not found.' }, { status: 404 });

    const token = await getToken();
    if (!token || (!shipment.awb_number && !shipment.shiprocket_shipment_id)) {
      return NextResponse.json({ success: true, tracking: shipment, live: false });
    }

    const endpoint = shipment.awb_number
      ? `${SHIPROCKET_API}/courier/track/awb/${encodeURIComponent(shipment.awb_number)}`
      : `${SHIPROCKET_API}/courier/track/shipment/${encodeURIComponent(shipment.shiprocket_shipment_id)}`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ success: true, tracking: shipment, live: false });
    }

    return NextResponse.json({ success: true, tracking: data, stored: shipment, live: true });
  } catch (error) {
    console.error('Shiprocket tracking failed:', error);
    return NextResponse.json({ success: false, error: 'Tracking lookup failed.' }, { status: 500 });
  }
}
