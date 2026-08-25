import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const required = {
    accessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    appSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    phoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    businessNumber: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER),
  };
  const configured = Object.values(required)?.every(Boolean);

  return NextResponse?.json(
    {
      configured,
      webhookReady: required?.appSecret && required?.verifyToken,
      mediaReady: required?.accessToken && required?.phoneNumberId,
      businessNumber: required?.businessNumber
        ? String(process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER)?.replace(/\D/g, '')
        : null,
      graphVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0',
      required,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
