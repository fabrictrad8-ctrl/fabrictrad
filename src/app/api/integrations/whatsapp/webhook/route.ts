import { after, NextRequest, NextResponse } from 'next/server';
import { parseCatalogMessage } from '@/lib/catalogAssistant';
import { createAdminClient } from '@/lib/supabase/admin';
import { downloadGupshupMedia, sendGupshupText } from '@/lib/gupshupWhatsApp';
import {
  handleBuyerWhatsAppMessage,
  sendBuyerWhatsAppText,
} from '@/lib/whatsappBuyerAutomation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MEDIA_BUCKET = 'seller-whatsapp-inbox';
const DELIVERY_STATES = new Set(['enqueued', 'failed', 'sent', 'delivered', 'read', 'deleted']);

type WhatsAppMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  video?: { id?: string; caption?: string; mime_type?: string };
  document?: { id?: string; caption?: string; filename?: string; mime_type?: string };
};

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
  const common = { id: message.id, from: message.source };
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

const normalizePhone = (value: unknown) => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  const lastTen = digits.slice(-10);
  return /^[6-9][0-9]{9}$/.test(lastTen) ? lastTen : '';
};

const extractText = (message: WhatsAppMessage) => {
  if (message.type === 'text') return String(message.text?.body || '').trim();
  if (message.type === 'image') return String(message.image?.caption || '').trim();
  if (message.type === 'video') return String(message.video?.caption || '').trim();
  if (message.type === 'document') return String(message.document?.caption || '').trim();
  return '';
};

const extractMedia = (message: WhatsAppMessage) => {
  if (message.type === 'image' && message.image?.id) {
    return { id: message.image.id, mime: message.image.mime_type || 'image/jpeg' };
  }
  if (message.type === 'video' && message.video?.id) {
    return { id: message.video.id, mime: message.video.mime_type || 'video/mp4' };
  }
  if (message.type === 'document' && message.document?.id) {
    return { id: message.document.id, mime: message.document.mime_type || 'application/pdf' };
  }
  return null;
};

const extensionFor = (mime: string) => {
  const normalized = mime.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('3gpp')) return '3gp';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('pdf')) return 'pdf';
  return 'bin';
};

async function acknowledgeSeller(to: string, text: string) {
  try {
    await sendGupshupText(to, text, false);
    return true;
  } catch (error) {
    console.error('Seller WhatsApp acknowledgement failed', {
      code: error instanceof Error ? error.message : 'provider_error',
    });
    return false;
  }
}

async function ingestSellerMessage(message: WhatsAppMessage) {
  const waMessageId = String(message.id || '').trim();
  const fromRaw = String(message.from || '').trim();
  const fromPhone = normalizePhone(fromRaw);
  if (!waMessageId || !fromPhone) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('whatsapp_catalog_ingestions')
    .select('id')
    .eq('wa_message_id', waMessageId)
    .maybeSingle();
  if (existing?.id) return;

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id,is_active,can_sell')
    .like('phone', `%${fromPhone}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (profileError || !profile?.id || profile.can_sell !== true) {
    await acknowledgeSeller(
      fromRaw,
      'FabricTrad could not match this WhatsApp number to an active seller account. Add the same number to your FabricTrad seller profile first.'
    );
    return;
  }

  const { data: seller, error: sellerError } = await admin
    .from('seller_profiles')
    .select('id')
    .eq('user_id', profile.id)
    .maybeSingle();
  if (sellerError || !seller?.id) return;

  const text = extractText(message).slice(0, 12_000);
  const parsedDraft = text ? parseCatalogMessage(text) : null;
  const media = extractMedia(message);
  let mediaStoragePath: string | null = null;
  let mediaMimeType: string | null = media?.mime || null;
  let processingError = '';

  if (media?.id) {
    try {
      const downloaded = await downloadGupshupMedia(media.id, MAX_MEDIA_BYTES);
      mediaMimeType = downloaded.mime;
      const extension = extensionFor(downloaded.mime);
      mediaStoragePath = `${profile.id}/${seller.id}/${waMessageId}.${extension}`;
      const { error: uploadError } = await admin.storage
        .from(MEDIA_BUCKET)
        .upload(mediaStoragePath, downloaded.buffer, {
          contentType: downloaded.mime,
          cacheControl: '3600',
          upsert: true,
        });
      if (uploadError) throw uploadError;
    } catch (error) {
      processingError = error instanceof Error ? error.message : 'media_processing_failed';
    }
  }

  const status = parsedDraft
    ? 'parsed'
    : text || mediaStoragePath
      ? 'needs_review'
      : processingError
        ? 'failed'
        : 'ignored';

  const { error: insertError } = await admin.from('whatsapp_catalog_ingestions').insert({
    user_id: profile.id,
    seller_id: seller.id,
    wa_message_id: waMessageId,
    from_phone: fromPhone,
    message_type: message.type || 'unknown',
    message_text: text || null,
    media_id: media?.id || null,
    media_storage_path: mediaStoragePath,
    media_mime_type: mediaMimeType,
    parsed_draft: parsedDraft,
    status,
    error_message: processingError || null,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (insertError) throw insertError;

  await acknowledgeSeller(
    fromRaw,
    parsedDraft
      ? `Received ${parsedDraft.name}. FabricTrad has organised the details and synced them to your seller dashboard as a private WhatsApp catalogue draft.`
      : 'Received. The message or media is now visible in your FabricTrad seller dashboard for review.'
  );
}

async function processMessage(message: WhatsAppMessage) {
  const buyerResult = await handleBuyerWhatsAppMessage(message);
  if (!buyerResult.handled) await ingestSellerMessage(message);
}

async function recordProcessingFailure(message: WhatsAppMessage, error: unknown) {
  const waMessageId = String(message.id || '').trim();
  const fromRaw = String(message.from || '').trim();
  if (!waMessageId) return;
  const reason = (error instanceof Error ? error.message : 'unknown').slice(0, 1000);
  const admin = createAdminClient();
  const { data: buyerMessage } = await admin
    .from('whatsapp_buyer_messages')
    .select('id,user_id,bespoke_order_id')
    .eq('wa_message_id', waMessageId)
    .maybeSingle();

  if (buyerMessage?.id) {
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'failed', error_message: reason })
      .eq('id', buyerMessage.id);
    if (buyerMessage.bespoke_order_id) {
      await admin
        .from('bespoke_orders')
        .update({
          human_action_required: true,
          human_action_reason: 'customer_service',
          updated_at: new Date().toISOString(),
        })
        .eq('id', buyerMessage.bespoke_order_id);
    }
    await admin
      .from('whatsapp_buyer_sessions')
      .update({
        human_handoff_required: true,
        human_handoff_reason: 'message_processing_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('whatsapp_phone', normalizePhone(fromRaw));
    await sendBuyerWhatsAppText(
      fromRaw,
      'We saved your message, but an automated step could not finish. FabricTrad customer service has been flagged with your order context; you do not need to resend sensitive details.',
      buyerMessage.bespoke_order_id,
      buyerMessage.user_id
    );
    return;
  }

  await admin
    .from('whatsapp_catalog_ingestions')
    .update({ status: 'failed', error_message: reason, updated_at: new Date().toISOString() })
    .eq('wa_message_id', waMessageId);
  await acknowledgeSeller(
    fromRaw,
    'FabricTrad saved your WhatsApp upload but could not finish processing it. It has been flagged for seller-support review.'
  );
}

async function processDeliveryEvent(event: GupshupEvent) {
  if (event.type !== 'message-event' || !event.payload) return;
  const payload = event.payload;
  const status = String(payload.type || '').trim().toLowerCase();
  if (!DELIVERY_STATES.has(status)) return;

  const providerMessageId = String(payload.gsId || payload.id || '').trim();
  const whatsappMessageId = String(
    payload.payload?.whatsappMessageId || (payload.gsId ? payload.id : '') || ''
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
  // Gupshup requires a publicly reachable webhook that immediately returns an
  // empty 2xx. Registration/health probes may not contain a business payload.
  const rawBody = await request.text().catch(() => '');
  if (!rawBody.trim()) return noContent();

  let event: GupshupEvent;
  try {
    event = JSON.parse(rawBody) as GupshupEvent;
  } catch {
    return noContent();
  }

  const expectedApp = String(process.env.GUPSHUP_APP_NAME || '').trim();
  if (expectedApp && event.app && event.app !== expectedApp) return noContent();
  if (event.version && event.version !== 2) return noContent();

  if (event.type === 'message-event') {
    after(async () => {
      await processDeliveryEvent(event).catch((error) => {
        console.error('WhatsApp delivery event processing failed', {
          code: error instanceof Error ? error.message : 'unknown',
        });
      });
    });
    return noContent();
  }

  const message = normalizeGupshupMessage(event);
  if (message) {
    after(async () => {
      try {
        await processMessage(message);
      } catch (error) {
        console.error('WhatsApp message processing failed', {
          messageId: message.id || null,
          code: error instanceof Error ? error.message : 'unknown',
        });
        await recordProcessingFailure(message, error).catch((recordError) => {
          console.error('WhatsApp processing failure could not be recorded', {
            messageId: message.id || null,
            code: recordError instanceof Error ? recordError.message : 'unknown',
          });
        });
      }
    });
  }

  // user-event (including sandbox-start), system-event, billing-event and all
  // other valid Gupshup notifications are acknowledged immediately.
  return noContent();
}
