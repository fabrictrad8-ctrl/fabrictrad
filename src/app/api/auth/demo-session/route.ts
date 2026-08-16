import { NextRequest, NextResponse } from 'next/server';

type DemoRole = 'buyer' | 'seller';

type DemoAccount = {
  password: string;
  role: DemoRole;
};

const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';
const DEMO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const DEMO_ACCOUNTS: Record<string, DemoAccount> = {
  'demo.buyer@fabrictrad.com': {
    password: 'FabricDemo@2026',
    role: 'buyer',
  },
  'demo.seller@fabrictrad.com': {
    password: 'FabricDemo@2026',
    role: 'seller',
  },
};

const demoAccountsEnabled = () => process.env.FABRICTRAD_ENABLE_DEMO_ACCOUNTS === 'true';

const noStoreJson = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const isSecureRequest = (request: NextRequest) =>
  request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

const clearDemoCookie = (response: NextResponse, request: NextRequest) => {
  response.cookies.set(DEMO_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
};

export async function GET(request: NextRequest) {
  if (!demoAccountsEnabled()) {
    return clearDemoCookie(noStoreJson({ role: null, enabled: false }), request);
  }

  const role = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  return noStoreJson({
    role: role === 'buyer' || role === 'seller' ? role : null,
    enabled: true,
  });
}

export async function POST(request: NextRequest) {
  if (!demoAccountsEnabled()) {
    return clearDemoCookie(noStoreJson({ error: 'Not found.' }, 404), request);
  }

  let body: { email?: unknown; password?: unknown };

  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return noStoreJson({ error: 'Invalid request body.' }, 400);
  }

  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return noStoreJson({ error: 'Email and password are required.' }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const account = DEMO_ACCOUNTS[email];

  if (!account || body.password !== account.password) {
    return noStoreJson({ error: 'Invalid login credentials.' }, 401);
  }

  const response = noStoreJson({ role: account.role, enabled: true });
  response.cookies.set(DEMO_COOKIE_NAME, account.role, {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  return clearDemoCookie(noStoreJson({ cleared: true }), request);
}
