import { NextRequest, NextResponse } from 'next/server';
import { validateDemoCredentials } from '@/lib/demoAccounts';

const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';
const DEMO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const noStoreJson = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const isSecureRequest = (request: NextRequest) =>
  request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

export async function GET(request: NextRequest) {
  const role = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  if (role !== 'buyer' && role !== 'seller') {
    return noStoreJson({ role: null });
  }
  return noStoreJson({ role });
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

  const account = validateDemoCredentials(body.email, body.password);
  if (!account) {
    return noStoreJson({ error: 'Invalid demo credentials.' }, 401);
  }

  const response = noStoreJson({ role: account.role });
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
  const response = noStoreJson({ cleared: true });
  response.cookies.set(DEMO_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
