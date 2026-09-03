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
  const webhookReady = true;
  const interactiveRepliesReady = channel.apiKey && channel.sourceNumber && webhookReady;
  const channelReady = channel.apiKey && channel.appName && channel.sourceNumber;
  const templatesReady = Object.values(templates).every(Boolean);
  const proactiveAutomationReady = channelReady && templatesReady;

  return NextResponse.json(
    {
      provider: 'gupshup',
      configured: interactiveRepliesReady,
      channelReady,
      interactiveRepliesReady,
      webhookReady,
      automationReady: proactiveAutomationReady,
      proactiveAutomationReady,
      templatesReady,
      mediaReady: webhookReady,
      appIdentityStrategy: channel.appName ? 'environment' : 'gupshup_inbound_event',
      businessNumber: channel.sourceNumber
        ? String(process.env.GUPSHUP_SOURCE_NUMBER).replace(/\D/g, '')
        : null,
      wabaIdConfigured: channel.wabaId,
      webhook: {
        url: 'https://fabrictrad.com/api/integrations/whatsapp/webhook',
        path: '/api/integrations/whatsapp/webhook',
        payloadFormat: 'gupshup_v2',
        access: 'public',
        validation: channel.appName
          ? 'configured_app_name_and_v2_event_shape'
          : 'gupshup_v2_event_shape_with_event_app_reply_identity',
        acknowledgement: 'empty_204',
      },
      required: { channel, templates },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
