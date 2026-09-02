import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const channel = {
    accessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    appSecret: Boolean(process.env.WHATSAPP_APP_SECRET),
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
    phoneNumberId: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    businessNumber: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER),
  };
  const templates = {
    appointmentReminder: Boolean(process.env.WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER),
    paymentReminder: Boolean(process.env.WHATSAPP_TEMPLATE_PAYMENT_REMINDER),
    trialReminder: Boolean(process.env.WHATSAPP_TEMPLATE_TRIAL_REMINDER),
    deliveryUpdate: Boolean(process.env.WHATSAPP_TEMPLATE_DELIVERY_UPDATE),
    reviewRequest: Boolean(process.env.WHATSAPP_TEMPLATE_REVIEW_REQUEST),
    postDeliveryFollowUp: Boolean(process.env.WHATSAPP_TEMPLATE_POST_DELIVERY_FOLLOW_UP),
  };
  const channelReady = Object.values(channel).every(Boolean);
  const templatesReady = Object.values(templates).every(Boolean);
  const configured = channelReady && templatesReady;

  return NextResponse.json(
    {
      configured,
      channelReady,
      automationReady: channelReady && templatesReady,
      templatesReady,
      webhookReady: channel.appSecret && channel.verifyToken,
      mediaReady: channel.accessToken && channel.phoneNumberId,
      businessNumber: channel.businessNumber
        ? String(process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER).replace(/\D/g, '')
        : null,
      graphVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0',
      required: { ...channel, templates },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
