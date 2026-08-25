import { NextResponse } from 'next/server';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // The status endpoint may inspect test credentials so launch diagnostics can
  // explicitly report TEST vs LIVE. Commerce routes use the stricter default.
  const credentials = await getRazorpayCredentials({ allowTestInProduction: true });
  if (!credentials) {
    return NextResponse.json(
      { configured: false, authenticated: false, source: null, mode: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const mode = credentials.keyId.startsWith('rzp_live_')
    ? 'live'
    : credentials.keyId.startsWith('rzp_test_')
      ? 'test'
      : 'unknown';

  try {
    const response = await fetch('https://api.razorpay.com/v1/orders?count=1', {
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    return NextResponse.json(
      {
        configured: true,
        authenticated: response.ok,
        source: credentials.source,
        mode,
        productionReady: response.ok && mode === 'live',
      },
      {
        status: response.ok ? 200 : response.status === 401 ? 503 : 502,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch {
    return NextResponse.json(
      {
        configured: true,
        authenticated: false,
        source: credentials.source,
        mode,
        productionReady: false,
      },
      { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
