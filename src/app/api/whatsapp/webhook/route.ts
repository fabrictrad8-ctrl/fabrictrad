import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeWhatsAppPhone, parseWhatsAppCatalog } from '@/lib/whatsappCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v25.0';
const MESSAGE_WINDOW_MINUTES = 15;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const PRODUCT_IMAGE_BUCKET = 'seller-product-images';

type MetaImage = {
  id?: string;
  caption?: string;
  mime_type?: string;
  sha256?: string;
};

type MetaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: MetaImage;
};

type MetaValue = {
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  messages?: MetaMessage[];
};

type MetaWebhook = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: MetaValue;
    }>;
  }>;
};

type StoredMessage = {
  id: string;
  wamid: string;
  sender_phone: string;
  phone_number_id: string;
  message_type: 'text' | 'image';
  text_content: string | null;
  media_id: string | null;
  media_mime_type: string | null;
  received_at: string;
  status: 'pending' | 'processing' | 'processed' | 'unmatched' | 'failed';
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false;
  const expected = await hmacSha256Hex(appSecret, rawBody);
  return timingSafeEqual(expected, signatureHeader.slice('sha256='.length));
}

function extractMessages(payload: MetaWebhook) {
  const messages: Array<{
    message: MetaMessage;
    phoneNumberId: string;
  }> = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const phoneNumberId = change.value?.metadata?.phone_number_id || '';
      for (const message of change.value?.messages || []) {
        messages.push({ message, phoneNumberId });
      }
    }
  }

  return messages;
}

function receivedAt(timestamp?: string) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

function extensionForMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

async function sendWhatsAppText(phoneNumberId: string, to: string, message: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !phoneNumberId || !to) return;

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
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
          text: { preview_url: false, body: message.slice(0, 4000) },
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!response.ok) {
      console.warn('Unable to send WhatsApp catalogue reply', response.status);
    }
  } catch (error) {
    console.warn('Unable to send WhatsApp catalogue reply', error);
  }
}

async function downloadWhatsAppImage(mediaId: string, phoneNumberId: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WhatsApp access token is not configured.');

  const metadataUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`
  );
  metadataUrl.searchParams.set('phone_number_id', phoneNumberId);

  const metadataResponse = await fetch(metadataUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const metadata = (await metadataResponse.json().catch(() => ({}))) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };
  if (!metadataResponse.ok || !metadata.url) {
    throw new Error('Unable to retrieve the WhatsApp image URL.');
  }
  if (metadata.file_size && metadata.file_size > MAX_MEDIA_BYTES) {
    throw new Error('The WhatsApp image is larger than 10 MB.');
  }

  const imageResponse = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!imageResponse.ok) throw new Error('Unable to download the WhatsApp image.');

  const mime = (imageResponse.headers.get('content-type') || metadata.mime_type || 'image/jpeg')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error('Unsupported WhatsApp image type.');
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  if (buffer.byteLength < 1 || buffer.byteLength > MAX_MEDIA_BYTES) {
    throw new Error('The WhatsApp image is empty or larger than 10 MB.');
  }

  return { buffer, mime, extension: extensionForMime(mime) };
}

async function resolveSeller(senderPhone: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('resolve_whatsapp_seller', {
    p_phone: senderPhone,
  });
  if (error) throw new Error(`Unable to match the seller account: ${error.message}`);
  return Array.isArray(data) ? data[0] || null : null;
}

async function loadRecentMessages(senderPhone: string) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - MESSAGE_WINDOW_MINUTES * 60_000).toISOString();
  const { data, error } = await admin
    .from('whatsapp_catalog_messages')
    .select(
      'id,wamid,sender_phone,phone_number_id,message_type,text_content,media_id,media_mime_type,received_at,status'
    )
    .eq('sender_phone', senderPhone)
    .in('status', ['pending', 'unmatched', 'failed'])
    .gte('received_at', cutoff)
    .order('received_at', { ascending: true });
  if (error) throw new Error(`Unable to read pending WhatsApp messages: ${error.message}`);
  return (data || []) as StoredMessage[];
}

function selectBatch(messages: StoredMessage[]) {
  const imageMessages = messages.filter(
    (message) => message.message_type === 'image' && Boolean(message.media_id)
  );
  if (!imageMessages.length) return null;

  for (const image of [...imageMessages].reverse()) {
    const parsed = parseWhatsAppCatalog(image.text_content || '');
    if (parsed) return { parsed, text: image.text_content || '', messages: [image] };
  }

  const textMessages = messages.filter(
    (message) => message.message_type === 'text' && Boolean(message.text_content?.trim())
  );
  for (const textMessage of [...textMessages].reverse()) {
    const parsed = parseWhatsAppCatalog(textMessage.text_content || '');
    if (!parsed) continue;

    const textTime = new Date(textMessage.received_at).getTime();
    const matchingImages = imageMessages.filter(
      (image) => Math.abs(new Date(image.received_at).getTime() - textTime) <= MESSAGE_WINDOW_MINUTES * 60_000
    );
    if (matchingImages.length) {
      return {
        parsed,
        text: textMessage.text_content || '',
        messages: [...matchingImages.slice(-10), textMessage],
      };
    }
  }

  return null;
}

async function processSender(senderPhone: string, fallbackPhoneNumberId: string) {
  const admin = createAdminClient();
  const messages = await loadRecentMessages(senderPhone);
  const batch = selectBatch(messages);

  if (!batch) {
    const hasImage = messages.some((message) => message.message_type === 'image');
    const phoneNumberId = messages.at(-1)?.phone_number_id || fallbackPhoneNumberId;
    await sendWhatsAppText(
      phoneNumberId,
      senderPhone,
      hasImage
        ? 'Photo received. Please send the fabric details in this chat within 15 minutes. Include Fabric, Width, Work and Rate.'
        : 'Details received. Please send at least one clear fabric photo in this chat within 15 minutes.'
    );
    return;
  }

  const messageIds = [...new Set(batch.messages.map((message) => message.wamid))].sort();
  const batchKey = await sha256Hex(`${senderPhone}:${messageIds.join(':')}`);

  const { data: existingBatch, error: existingBatchError } = await admin
    .from('whatsapp_catalog_batches')
    .select('id,status,product_id')
    .eq('batch_key', batchKey)
    .maybeSingle();
  if (existingBatchError) throw new Error(existingBatchError.message);
  if (existingBatch?.status === 'processed') return;

  if (existingBatch) {
    const { error } = await admin
      .from('whatsapp_catalog_batches')
      .update({ status: 'processing', error_message: null })
      .eq('id', existingBatch.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from('whatsapp_catalog_batches').insert({
      batch_key: batchKey,
      sender_phone: senderPhone,
      message_ids: messageIds,
      parsed_details: batch.parsed,
      status: 'processing',
    });
    if (error && error.code !== '23505') throw new Error(error.message);
  }

  const { error: processingError } = await admin
    .from('whatsapp_catalog_messages')
    .update({ status: 'processing', error_message: null })
    .in('wamid', messageIds);
  if (processingError) throw new Error(processingError.message);

  const phoneNumberId = batch.messages.at(-1)?.phone_number_id || fallbackPhoneNumberId;

  try {
    const seller = await resolveSeller(senderPhone);
    if (!seller?.seller_id) {
      await admin
        .from('whatsapp_catalog_batches')
        .update({ status: 'unmatched', error_message: 'No verified seller account matches this phone.' })
        .eq('batch_key', batchKey);
      await admin
        .from('whatsapp_catalog_messages')
        .update({ status: 'unmatched', error_message: 'Phone is not linked to a verified seller.' })
        .in('wamid', messageIds);
      await sendWhatsAppText(
        phoneNumberId,
        senderPhone,
        'We received the photo and details, but this WhatsApp number is not linked to a verified FabricTrad seller account. Sign in with your real seller account and verify the same phone number, then resend the photo and details.'
      );
      return;
    }

    const imageMessages = batch.messages.filter(
      (message) => message.message_type === 'image' && Boolean(message.media_id)
    );
    const imageUrls: string[] = [];

    for (let index = 0; index < imageMessages.length; index += 1) {
      const imageMessage = imageMessages[index];
      const image = await downloadWhatsAppImage(imageMessage.media_id!, imageMessage.phone_number_id);
      const path = `${seller.seller_id}/whatsapp/${batchKey}-${index + 1}.${image.extension}`;
      const { error: uploadError } = await admin.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(path, image.buffer, {
          contentType: image.mime,
          cacheControl: '31536000',
          upsert: true,
        });
      if (uploadError) throw new Error(`Unable to store the product photo: ${uploadError.message}`);
      const { data: publicUrl } = admin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
      imageUrls.push(publicUrl.publicUrl);
    }

    if (!imageUrls.length) throw new Error('No usable product image was received.');

    const sku = `WA-${batchKey.slice(0, 12).toUpperCase()}`;
    const productPayload = {
      seller_id: seller.seller_id,
      name: batch.parsed.name,
      sku,
      category: batch.parsed.category,
      description: batch.parsed.description,
      price_per_unit: batch.parsed.pricePerUnit,
      unit: batch.parsed.unit,
      available_quantity: batch.parsed.availableQuantity,
      reserved_quantity: 0,
      min_stock: 0,
      moq: batch.parsed.moq,
      gsm: batch.parsed.gsm,
      width_inches: batch.parsed.widthInches,
      work_type: batch.parsed.workType,
      image_url: imageUrls[0],
      image_urls: imageUrls,
      dispatch_days: 3,
      status: 'draft',
      source: 'whatsapp',
      source_reference: batchKey,
      approval_status: 'pending',
    };

    let productId = existingBatch?.product_id || null;
    if (!productId) {
      const { data: existingProduct } = await admin
        .from('seller_products')
        .select('id')
        .eq('source', 'whatsapp')
        .eq('source_reference', batchKey)
        .maybeSingle();
      productId = existingProduct?.id || null;
    }

    if (productId) {
      const { error } = await admin
        .from('seller_products')
        .update(productPayload)
        .eq('id', productId)
        .eq('seller_id', seller.seller_id);
      if (error) throw new Error(`Unable to update the product draft: ${error.message}`);
    } else {
      const { data: created, error } = await admin
        .from('seller_products')
        .insert(productPayload)
        .select('id')
        .single();
      if (error || !created?.id) {
        throw new Error(`Unable to create the product draft: ${error?.message || 'No product ID returned.'}`);
      }
      productId = created.id;
    }

    await admin
      .from('whatsapp_catalog_batches')
      .update({
        seller_id: seller.seller_id,
        product_id: productId,
        parsed_details: batch.parsed,
        image_urls: imageUrls,
        status: 'processed',
        error_message: null,
      })
      .eq('batch_key', batchKey);
    await admin
      .from('whatsapp_catalog_messages')
      .update({ status: 'processed', product_id: productId, error_message: null })
      .in('wamid', messageIds);

    await sendWhatsAppText(
      phoneNumberId,
      senderPhone,
      `Uploaded successfully as a FabricTrad catalogue draft.\n\nProduct: ${batch.parsed.name}\nPrice: ₹${batch.parsed.pricePerUnit}/${batch.parsed.unit}\nSKU: ${sku}\nStatus: Pending FabricTrad review.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WhatsApp catalogue processing failed.';
    await admin
      .from('whatsapp_catalog_batches')
      .update({ status: 'failed', error_message: message.slice(0, 500) })
      .eq('batch_key', batchKey);
    await admin
      .from('whatsapp_catalog_messages')
      .update({ status: 'failed', error_message: message.slice(0, 500) })
      .in('wamid', messageIds);
    await sendWhatsAppText(
      phoneNumberId,
      senderPhone,
      'We received your catalogue upload but could not process it. Please resend one clear image and the Fabric, Width, Work and Rate details.'
    );
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }
  return new NextResponse('Webhook verification failed.', { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!(await verifySignature(rawBody, request.headers.get('x-hub-signature-256')))) {
    return json({ error: 'Invalid webhook signature.' }, 401);
  }

  let payload: MetaWebhook;
  try {
    payload = JSON.parse(rawBody) as MetaWebhook;
  } catch {
    return json({ error: 'Invalid JSON payload.' }, 400);
  }

  if (payload.object !== 'whatsapp_business_account') return json({ received: true });

  const incoming = extractMessages(payload).filter(
    ({ message, phoneNumberId }) =>
      Boolean(message.id && message.from && phoneNumberId) &&
      (message.type === 'text' || message.type === 'image')
  );
  if (!incoming.length) return json({ received: true });

  const admin = createAdminClient();
  const senders = new Map<string, string>();

  for (const { message, phoneNumberId } of incoming) {
    const senderPhone = normalizeWhatsAppPhone(message.from!);
    senders.set(senderPhone, phoneNumberId);

    const record = {
      wamid: message.id!,
      sender_phone: senderPhone,
      phone_number_id: phoneNumberId,
      message_type: message.type,
      text_content:
        message.type === 'text' ? message.text?.body || null : message.image?.caption || null,
      media_id: message.type === 'image' ? message.image?.id || null : null,
      media_mime_type: message.type === 'image' ? message.image?.mime_type || null : null,
      media_sha256: message.type === 'image' ? message.image?.sha256 || null : null,
      received_at: receivedAt(message.timestamp),
      raw_payload: message,
      status: 'pending',
    };

    const { error } = await admin
      .from('whatsapp_catalog_messages')
      .upsert(record, { onConflict: 'wamid', ignoreDuplicates: true });
    if (error) {
      console.error('Unable to persist WhatsApp catalogue message', error.message);
      return json({ error: 'WhatsApp catalogue storage is unavailable.' }, 503);
    }
  }

  try {
    for (const [senderPhone, phoneNumberId] of senders) {
      await processSender(senderPhone, phoneNumberId);
    }
  } catch (error) {
    console.error('WhatsApp catalogue webhook processing failed', error);
    return json({ error: 'Catalogue processing will be retried.' }, 500);
  }

  return json({ received: true });
}
