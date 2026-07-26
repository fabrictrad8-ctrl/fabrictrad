import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const displayNumber = process.env.WHATSAPP_DISPLAY_NUMBER?.trim() || null;
  const configured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_APP_SECRET &&
      process.env.WHATSAPP_VERIFY_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      displayNumber &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return NextResponse.json(
    {
      configured,
      displayNumber: configured ? displayNumber : null,
      waNumber: configured ? displayNumber?.replace(/\D/g, '') || null : null,
      pairingWindowMinutes: 15,
      webhookPath: '/api/whatsapp/webhook',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
