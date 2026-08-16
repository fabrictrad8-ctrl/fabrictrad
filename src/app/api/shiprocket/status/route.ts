import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const configured = Boolean(
    process.env.SHIPROCKET_EMAIL?.trim() && process.env.SHIPROCKET_PASSWORD?.trim()
  );

  return NextResponse.json(
    { configured },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
