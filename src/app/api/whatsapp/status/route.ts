import { NextResponse } from 'next/server';
import { FABRICTRAD_GUPSHUP_APP_NAME } from '@/lib/gupshupWhatsApp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const envAppName = String(process.env.GUPSHUP_APP_NAME || '').trim();
  const effectiveAppName = envAppName || FABRICTRAD_GUPSHUP_APP_NAME;
  const channel = {
    apiKey: Boolean(process.env.GUPSHUP_API_KEY),
    appName: Boolean(effectiveAppName),
    appId: Boolean(process.env.GUPSHUP_APP_ID),
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
  const channelReady = channel.apiKey && channel.appName && channel.sourceNumber;
  const interactiveRepliesReady = channelReady && webhookReady;
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
      appIdentityStrategy: envAppName ? 'environment' : 'application_config',
      businessNumber: channel.sourceNumber
        ? String(process.env.GUPSHUP_SOURCE_NUMBER).replace(/\D/g, '')
        : null,
      wabaIdConfigured: channel.wabaId,
      webhook: {
        url: 'https://fabrictrad.com/api/integrations/whatsapp/webhook',
        path: '/api/integrations/whatsapp/webhook',
        payloadFormat: 'meta_v3_with_gupshup_v2_fallback',
        access: 'public',
        validation: 'provider_identity_source_number_and_event_shape',
        appIdValidation: channel.appId ? 'exact' : 'presence',
        sourceNumberValidation: 'exact',
        acknowledgement: 'empty_204',
        maxPayloadBytes: 1024 * 1024,
      },
      required: { channel, templates },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
