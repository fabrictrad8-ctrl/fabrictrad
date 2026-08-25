import { NextResponse } from 'next/server';
import { POST as handleTrackingUpdate } from '@/app/api/shiprocket/webhook/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Shiprocket rejects callback URLs containing words such as "shiprocket", "kartrocket", "sr" or "kr".
// Keep this public URL provider-neutral. The POST handler still validates the configured x-api-key.
export const POST = handleTrackingUpdate;

export async function GET() {
  const webhookTokenConfigured = Boolean(process.env.SHIPROCKET_WEBHOOK_TOKEN?.trim());
  const databaseConfigured = Boolean(
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );

  return NextResponse?.json(
    {
      ok: true,
      configured: webhookTokenConfigured && databaseConfigured,
      service: 'FabricTrad logistics tracking callback',
      method: 'POST',
      authentication: 'x-api-key',
      webhookTokenConfigured,
      databaseConfigured,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
