import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const providerConfigured = Boolean(
    process.env.GSTIN_VERIFICATION_API_URL?.trim() &&
      process.env.GSTIN_VERIFICATION_API_KEY?.trim()
  );

  return NextResponse.json(
    {
      providerConfigured,
      mode: providerConfigured ? 'provider' : 'official_manual',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
