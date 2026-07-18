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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const awb = searchParams.get('awb');
    const shipmentId = searchParams.get('shipment_id');

    if (!awb && !shipmentId) {
      return NextResponse.json(
        { success: false, error: 'AWB or shipment_id required' },
        { status: 400 }
      );
    }

    if (!SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD) {
      // Dev mock tracking data
      return NextResponse.json({
        success: true,
        mock: true,
        tracking: {
          awb,
          status: 'In Transit',
          location: 'Mumbai Hub',
          estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          events: [
            {
              time: new Date().toISOString(),
              status: 'In Transit',
              location: 'Mumbai Hub',
              description: 'Shipment in transit',
            },
            {
              time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              status: 'Picked Up',
              location: 'Surat',
              description: 'Shipment picked up from seller',
            },
            {
              time: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
              status: 'Order Created',
              location: 'Surat',
              description: 'Shiprocket order created',
            },
          ],
        },
      });
    }

    const token = await getShiprocketToken();
    const endpoint = awb
      ? `${SHIPROCKET_API}/courier/track/awb/${awb}`
      : `${SHIPROCKET_API}/courier/track/shipment/${shipmentId}`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    return NextResponse.json({ success: true, tracking: data });
  } catch (error: unknown) {
    console.error('[Shiprocket] Tracking error:', error);
    const message = error instanceof Error ? error.message : 'Tracking fetch failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
