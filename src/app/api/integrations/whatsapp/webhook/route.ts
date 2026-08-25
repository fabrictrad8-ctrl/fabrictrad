import { createHmac, timingSafeEqual } from 'node:crypto';
import { after, NextRequest, NextResponse } from 'next/server';
import { parseCatalogMessage } from '@/lib/catalogAssistant';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';
const MEDIA_BUCKET = 'seller-whatsapp-inbox';

type MetaMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  video?: { id?: string; caption?: string; mime_type?: string };
  document?: { id?: string; caption?: string; filename?: string; mime_type?: string };
};

type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaMessage[];
      };
    }>;
  }>;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const normalizePhone = (value: unknown) => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  const lastTen = digits.slice(-10);
  return /^[6-9][0-9]{9}$/.test(lastTen) ? lastTen : '';
};

const extractText = (message: MetaMessage) => {
  if (message.type === 'text') return String(message.text?.body || '').trim();
  if (message.type === 'image') return String(message.image?.caption || '').trim();
  if (message.type === 'video') return String(message.video?.caption || '').trim();
  if (message.type === 'document') return String(message.document?.caption || '').trim();
  return '';
};

const extractMedia = (message: MetaMessage) => {
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

const verifySignature = (rawBody: string, signature: string | null, secret: string) => {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(suppliedBuffer, expectedBuffer);
};

async function downloadMetaMedia(mediaId: string, accessToken: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const metadataUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`
  );
  if (phoneNumberId) metadataUrl.searchParams.set('phone_number_id', phoneNumberId);

  const metadataResponse = await fetch(metadataUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!metadataResponse.ok) throw new Error(`media_metadata_${metadataResponse.status}`);
  const metadata = (await metadataResponse.json()) as {
    url?: string;
    mime_type?: string;
    file_size?: number | string;
  };
  if (!metadata.url) throw new Error('media_url_missing');
  if (Number(metadata.file_size || 0) > MAX_MEDIA_BYTES) throw new Error('media_too_large');

  const mediaResponse = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!mediaResponse.ok) throw new Error(`media_download_${mediaResponse.status}`);
  const buffer = Buffer.from(await mediaResponse.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) throw new Error('media_too_large');
  const mime =
    String(metadata.mime_type || mediaResponse.headers.get('content-type') || 'application/octet-stream')
      .split(';')[0]
      .trim()
      .toLowerCase();
  return { buffer, mime };
}

async function acknowledgeSeller(to: string, text: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return;
  await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => undefined);
}

async function ingestMessage(message: MetaMessage) {
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

  const messageText = extractText(message).slice(0, 12_000);
  const parsedDraft = messageText ? parseCatalogMessage(messageText) : null;
  const media = extractMedia(message);
  let mediaStoragePath: string | null = null;
  let mediaMimeType: string | null = media?.mime || null;
  let processingError = '';

  if (media?.id && process.env.WHATSAPP_ACCESS_TOKEN) {
    try {
      const downloaded = await downloadMetaMedia(media.id, process.env.WHATSAPP_ACCESS_TOKEN);
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
    : messageText || mediaStoragePath
      ? 'needs_review'
      : processingError
        ? 'failed' :'ignored';

  const { error: insertError } = await admin.from('whatsapp_catalog_ingestions').insert({
    user_id: profile.id,
    seller_id: seller.id,
    wa_message_id: waMessageId,
    from_phone: fromPhone,
    message_type: message.type || 'unknown',
    message_text: messageText || null,
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

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const suppliedToken = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && expectedToken && suppliedToken === expectedToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }
  return new NextResponse('Webhook verification failed.', { status: 403 });
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return json({ error: 'WhatsApp webhook is not configured.' }, 503);

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    return json({ error: 'Invalid WhatsApp webhook signature.' }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return json({ error: 'Invalid webhook payload.' }, 400);
  }

  const messages =
    payload.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) => change.value?.messages || []) || []
    ) || [];

  after(async () => {
    await Promise.all(
      messages.map((message) =>
        ingestMessage(message).catch((error) => {
          console.error('WhatsApp seller ingestion failed', {
            messageId: message.id || null,
            code: error instanceof Error ? error.message : 'unknown',
          });
        })
      )
    );
  });

  // Acknowledge immediately. Meta can retry slow/non-2xx webhook deliveries,
  // while Next.js `after()` keeps the background processing alive separately.
  return json({ received: true });
}
