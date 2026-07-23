import { NextRequest, NextResponse } from 'next/server';

type DemoRole = 'buyer' | 'seller';

type DemoAccount = {
  password: string;
  role: DemoRole;
};

const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';
const DEMO_AI_COOKIE_NAME = 'fabrictrad_demo_ai';
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

const noStoreJson = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const isSecureRequest = (request: NextRequest) =>
  request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

const aiCookieSecret = () =>
  process.env.AI_DRAPE_COOKIE_SECRET ||
  process.env.OPENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  null;

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Buffer.from(signature).toString('base64url');
}

async function createDemoAiToken(role: DemoRole) {
  const secret = aiCookieSecret();
  if (!secret || role !== 'buyer') return null;

  const expiresAt = Math.floor(Date.now() / 1000) + DEMO_SESSION_MAX_AGE_SECONDS;
  const payload = `${role}:${expiresAt}`;
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = await signPayload(payload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function GET(request: NextRequest) {
  const role = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  return noStoreJson({ role: role === 'buyer' || role === 'seller' ? role : null });
}

export async function POST(request: NextRequest) {
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

  const response = noStoreJson({ role: account.role });
  const secure = isSecureRequest(request);
  response.cookies.set(DEMO_COOKIE_NAME, account.role, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
  });

  const aiToken = await createDemoAiToken(account.role);
  if (aiToken) {
    response.cookies.set(DEMO_AI_COOKIE_NAME, aiToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
    });
  } else {
    response.cookies.set(DEMO_AI_COOKIE_NAME, '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}

export async function DELETE(request: NextRequest) {
  const response = noStoreJson({ cleared: true });
  const secure = isSecureRequest(request);
  response.cookies.set(DEMO_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set(DEMO_AI_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
