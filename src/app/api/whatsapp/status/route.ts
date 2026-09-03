import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const channel = {
    apiKey: Boolean(process.env.GUPSHUP_API_KEY),
    appName: Boolean(process.env.GUPSHUP_APP_NAME),
    sourceNumber: Boolean(process.env.GUPSHUP_SOURCE_NUMBER),
    wabaId: Boolean(process.env.GUPSHUP_WABA_ID),
  };
  const templates = {
    appointmentReminder: Boolean(process.env.WHATSAPP_TEMPLATE_APPOINTMENT_REMINDER),
    paymentReminder: Boolean(process.env.WHATSAPP_TEMPLATE_PAYMENT_REMINDER),
    trialReminder: Boolean(process.env.WHATSAPP_TEMPLATE_TRIAL_REMINDER),
    deliveryUpdate: Boolean(process.env.WHATSAPP_TEMPLATE_DELIVERY_UPDATE),
    reviewRequest: Boolean(process.env.WHATSAPP_TEMPLATE_REVIEW_REQUEST),
    postDeliveryFollowUp: Boolean(process.env.WHATSAPP_TEMPLATE_POST_DELIVERY_FOLLOW_UP),
  };
  const channelReady = channel.apiKey && channel.appName && channel.sourceNumber;
  const webhookReady = channel.appName;
  const templatesReady = Object.values(templates).every(Boolean);
  const configured = channelReady && webhookReady;

  return NextResponse.json(
    {
      provider: 'gupshup',
      configured,
      channelReady,
      webhookReady,
      automationReady: configured && templatesReady,
      templatesReady,
      mediaReady: configured,
      businessNumber: channel.sourceNumber
        ? String(process.env.GUPSHUP_SOURCE_NUMBER).replace(/\D/g, '')
        : null,
      wabaIdConfigured: channel.wabaId,
      webhook: {
        url: 'https://fabrictrad.com/api/integrations/whatsapp/webhook',
        path: '/api/integrations/whatsapp/webhook',
        payloadFormat: 'gupshup_v2',
        access: 'public',
        validation: 'configured_app_name_and_v2_event_shape',
        acknowledgement: 'empty_204',
      },
      required: { channel, templates },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
