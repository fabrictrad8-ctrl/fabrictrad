import { after, NextRequest, NextResponse } from 'next/server';
import { enqueueSellerWhatsAppMessages, processSellerWhatsAppQueue, type WhatsAppMessage } from '@/lib/server/sellerWhatsappQueue';
import { createAdminClient } from '@/lib/supabase/admin';
import { FABRICTRAD_GUPSHUP_APP_NAME } from '@/lib/gupshupWhatsApp';
import { isGupshupV3Webhook, normalizeGupshupV3 } from '@/lib/gupshupWebhookV3';
import { whatsappWebhookAuthorized } from '@/lib/whatsappWebhookAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_WEBHOOK_BYTES = 1024 * 1024;
const DELIVERY_STATES = new Set(['enqueued', 'failed', 'sent', 'delivered', 'read', 'deleted']);


type GupshupEvent = {
  app?: string;
  timestamp?: number;
  version?: number;
  type?: string;
  payload?: {
    id?: string;
    gsId?: string;
    source?: string;
    destination?: string;
    type?: string;
    phone?: string;
    payload?: {
      text?: string;
      caption?: string;
      url?: string;
      contentType?: string;
      name?: string;
      filename?: string;
      title?: string;
      postbackText?: string;
      whatsappMessageId?: string;
      code?: string | number;
      reason?: string;
      ts?: number;
    };
    sender?: { phone?: string; name?: string };
  };
};

const normalizeGupshupMessage = (event: GupshupEvent): WhatsAppMessage | null => {
  if (event.type !== 'message' || !event.payload?.id || !event.payload.source) return null;
  const message = event.payload;
  const content = message.payload || {};
  const common = {
    id: message.id,
    from: message.source,
    appName: String(event.app || '').trim() || undefined,
  };
  if (message.type === 'text') {
    return { ...common, type: 'text', text: { body: String(content.text || '') } };
  }
  if (message.type === 'image' && content.url) {
    return {
      ...common,
      type: 'image',
      image: {
        id: content.url,
        caption: content.caption,
        mime_type: content.contentType || 'image/jpeg',
      },
    };
  }
  if ((message.type === 'file' || message.type === 'document') && content.url) {
    return {
      ...common,
      type: 'document',
      document: {
        id: content.url,
        caption: content.caption,
        filename: content.name || content.filename,
        mime_type: content.contentType || 'application/octet-stream',
      },
    };
  }
  if (message.type === 'video' && content.url) {
    return {
      ...common,
      type: 'video',
      video: {
        id: content.url,
        caption: content.caption,
        mime_type: content.contentType || 'video/mp4',
      },
    };
  }
  if (message.type === 'button_reply' || message.type === 'list_reply' || message.type === 'button') {
    return {
      ...common,
      type: 'text',
      text: { body: String(content.postbackText || content.title || content.text || '') },
    };
  }
  return { ...common, type: String(message.type || 'unknown') };
};

const noContent = () =>
  new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });

async function readWebhookBody(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) return null;
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_WEBHOOK_BYTES) {
        await reader.cancel('payload_too_large').catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function processDeliveryEvent(event: GupshupEvent) {
  if (event.type !== 'message-event' || !event.payload) return;
  const payload = event.payload;
  const status = String(payload.type || '').trim().toLowerCase();
  if (!DELIVERY_STATES.has(status)) return;

  const explicitWhatsappMessageId = String(payload.payload?.whatsappMessageId || '').trim();
  const providerMessageId = String(
    payload.gsId || (explicitWhatsappMessageId ? '' : payload.id) || ''
  ).trim();
  const whatsappMessageId = String(
    explicitWhatsappMessageId || (payload.gsId ? payload.id : '') || ''
  ).trim();
  if (!providerMessageId && !whatsappMessageId) return;

  const eventTime = new Date(
    Number.isFinite(Number(event.timestamp)) ? Number(event.timestamp) : Date.now()
  );
  const eventIso = Number.isFinite(eventTime.getTime()) ? eventTime.toISOString() : new Date().toISOString();
  const admin = createAdminClient();

  let query = admin
    .from('whatsapp_buyer_messages')
    .select('id,delivery_status_at')
    .eq('provider', 'gupshup')
    .limit(1);
  if (providerMessageId) query = query.eq('provider_message_id', providerMessageId);
  else query = query.eq('whatsapp_message_id', whatsappMessageId);
  const { data: row } = await query.maybeSingle();
  if (!row?.id) return;

  if (row.delivery_status_at) {
    const currentTime = new Date(row.delivery_status_at).getTime();
    const incomingTime = new Date(eventIso).getTime();
    if (Number.isFinite(currentTime) && Number.isFinite(incomingTime) && incomingTime < currentTime) {
      return;
    }
  }

  const providerErrorCode = status === 'failed' ? String(payload.payload?.code || '').slice(0, 120) : null;
  const providerErrorMessage = status === 'failed' ? String(payload.payload?.reason || '').slice(0, 1000) : null;
  await admin
    .from('whatsapp_buyer_messages')
    .update({
      delivery_status: status,
      delivery_status_at: eventIso,
      whatsapp_message_id: whatsappMessageId || null,
      provider_error_code: providerErrorCode || null,
      provider_error_message: providerErrorMessage || null,
    })
    .eq('id', row.id);
}

export async function GET() {
  return noContent();
}

export async function POST(request: NextRequest) {
  if (!whatsappWebhookAuthorized(request, process.env.GUPSHUP_WEBHOOK_SECRET)) {
    return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  // Gupshup requires a publicly reachable webhook that immediately returns an
  // empty 2xx. FabricTrad supports both current Meta-format v3 callbacks and
  // legacy Gupshup-format v2 callbacks while processing work asynchronously.
  const rawBody = await readWebhookBody(request).catch(() => null);
  if (rawBody === null || !rawBody.trim()) return noContent();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return noContent();
  }

  const expectedApp = String(process.env.GUPSHUP_APP_NAME || FABRICTRAD_GUPSHUP_APP_NAME).trim();

  if (isGupshupV3Webhook(parsed)) {
    const normalized = normalizeGupshupV3(parsed, {
      appName: expectedApp,
      expectedAppId: process.env.GUPSHUP_APP_ID,
      expectedSourceNumber: process.env.GUPSHUP_SOURCE_NUMBER,
    });

    try {
      await enqueueSellerWhatsAppMessages(normalized.messages);
    } catch {
      return new NextResponse(null, { status: 503 });
    }
    if (normalized.deliveryEvents.length || normalized.messages.length) {
      after(async () => {
        for (const deliveryEvent of normalized.deliveryEvents) {
          await processDeliveryEvent(deliveryEvent).catch((error) => {
            console.error('WhatsApp v3 delivery event processing failed', {
              code: error instanceof Error ? error.message : 'unknown',
            });
          });
        }
        for (const message of normalized.messages) {
          await processSellerWhatsAppQueue(message.id);
        }
      });
    }
    return noContent();
  }

  const event = parsed as GupshupEvent;
  if (expectedApp && event.app !== expectedApp) return noContent();
  if (event.version && event.version !== 2) return noContent();

  const expectedSource = String(process.env.GUPSHUP_SOURCE_NUMBER || '').replace(/\D/g, '');
  if (expectedSource && event.type === 'message') {
    const destination = String(event.payload?.destination || '').replace(/\D/g, '');
    if (destination !== expectedSource) return noContent();
  }
  if (expectedSource && event.type === 'message-event' && event.payload?.source) {
    const reportedSource = String(event.payload.source).replace(/\D/g, '');
    if (reportedSource !== expectedSource) return noContent();
  }

  if (event.type === 'message-event') {
    after(async () => {
      await processDeliveryEvent(event).catch((error) => {
        console.error('WhatsApp v2 delivery event processing failed', {
          code: error instanceof Error ? error.message : 'unknown',
        });
      });
    });
    return noContent();
  }

  const message = normalizeGupshupMessage(event);
  if (message) {
    try {
      await enqueueSellerWhatsAppMessages([message]);
    } catch {
      return new NextResponse(null, { status: 503 });
    }
    after(async () => {
      await processSellerWhatsAppQueue(message.id);
    });
  }

  // user-event (including sandbox-start), system-event, billing-event and all
  // other valid Gupshup notifications are acknowledged immediately.
  return noContent();
}
