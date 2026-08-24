import { NextRequest, NextResponse } from 'next/server';
import { getShiprocketCredentials } from '@/lib/shiprocketCredentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SHIPROCKET_AUTH = 'https://apiv2.shiprocket.in/v1/external/auth/login';

export async function GET(request: NextRequest) {
  const credentials = await getShiprocketCredentials();
  if (!credentials) {
    return NextResponse.json(
      { configured: false, authenticated: false },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const verify = request.nextUrl.searchParams.get('verify') === '1';
  if (!verify) {
    return NextResponse.json(
      {
        configured: true,
        authenticated: null,
        source: credentials.source,
        webhookConfigured: Boolean(credentials.webhookToken),
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  try {
    const response = await fetch(SHIPROCKET_AUTH, {
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
    return NextResponse.json(
      {
        configured: true,
        authenticated: response.ok && Boolean(payload.token),
        source: credentials.source,
        webhookConfigured: Boolean(credentials.webhookToken),
        message: response.ok ? undefined : payload.message || 'Shiprocket authentication failed.',
      },
      {
        status: response.ok && payload.token ? 200 : 502,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        authenticated: false,
        source: credentials.source,
        webhookConfigured: Boolean(credentials.webhookToken),
        message: error instanceof Error ? error.message : 'Shiprocket authentication failed.',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
