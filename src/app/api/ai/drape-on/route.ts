import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EDGE_FUNCTION = 'ai-drape';
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function bearer(request: NextRequest) {
  const value = request.headers.get('authorization') || '';
  return /^Bearer\s+\S+/i.test(value) ? value : '';
}

function runtimeConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return { url: url.replace(/\/$/, ''), anonKey };
}

async function proxy(request: NextRequest, method: 'GET' | 'POST') {
  const authorization = bearer(request);
  if (!authorization) {
    return noStore({ error: 'Buyer authentication is required.', code: 'BUYER_AUTH_REQUIRED' }, 401);
  }

  const { url, anonKey } = runtimeConfig();
  if (!url || !anonKey) {
    return noStore({ error: 'AI service is temporarily unavailable.', code: 'AI_SERVICE_UNAVAILABLE' }, 503);
  }

  if (method === 'POST' && Number(request.headers.get('content-length') || 0) > MAX_REQUEST_BYTES) {
    return noStore({ error: 'Request is too large.', code: 'REQUEST_TOO_LARGE' }, 413);
  }

  let body: string | undefined;
  if (method === 'POST') {
    try {
      body = await request.text();
      if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) {
        return noStore({ error: 'Request is too large.', code: 'REQUEST_TOO_LARGE' }, 413);
      }
      JSON.parse(body);
    } catch {
      return noStore({ error: 'Invalid JSON body.', code: 'INVALID_JSON' }, 400);
    }
  }

  try {
    const response = await fetch(`${url}/functions/v1/${EDGE_FUNCTION}`, {
      method,
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(method === 'POST' ? 125_000 : 20_000),
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';
    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('FabricTrad AI Drape proxy failed', error instanceof Error ? error.message : String(error));
    return noStore({ error: 'AI service is temporarily unavailable.', code: 'AI_SERVICE_UNAVAILABLE' }, 503);
  }
}

export async function GET(request: NextRequest) {
  return proxy(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxy(request, 'POST');
}
