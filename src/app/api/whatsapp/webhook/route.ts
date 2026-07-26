import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  normalizeWhatsAppPhone,
  parseWhatsAppCatalog,
  variantKey,
  type ParsedWhatsAppCatalog,
  type ParsedWhatsAppVariant,
} from '@/lib/whatsappCatalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v25.0';
const MESSAGE_WINDOW_MINUTES = 15;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const PRODUCT_IMAGE_BUCKET = 'seller-product-images';

type MetaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string; sha256?: string };
};

type MetaWebhook = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: MetaMessage[];
      };
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
  received_at: string;
  status: string;
};

type VariantWithImages = ParsedWhatsAppVariant & { imageMessages: StoredMessage[] };

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
  const messages: Array<{ message: MetaMessage; phoneNumberId: string }> = [];
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
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
}

function extensionForMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function firstNumber(value?: string | null) {
  const match = value?.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(' ');
}

function parseImageVariantHint(text: string | null, catalog: ParsedWhatsAppCatalog) {
  if (!text?.trim()) return null;
  const fields: Record<string, string> = {};
  for (const line of text.replace(/\r/g, '').split('\n')) {
    const match = line.trim().match(/^([^:=]{2,40})\s*[:=]\s*(.+)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
    fields[key] = match[2].trim();
  }
  const color = fields.color || fields.colour || fields.shade || fields.variant;
  if (!color) return null;
  const price = firstNumber(fields.rate || fields.price) || catalog.pricePerUnit;
  const stock = firstNumber(
    fields.stock || fields.available || fields.quantity || fields.metres || fields.meters || fields.mtrs
  );
  const design = fields.design || fields.pattern || catalog.workType;
  const hexRaw = fields.hex || fields['color hex'] || fields['colour hex'];
  const colorHex = hexRaw
    ? (/^#?[0-9a-f]{6}$/i.test(hexRaw.trim())
        ? `#${hexRaw.trim().replace(/^#/, '').toUpperCase()}`
        : null)
    : null;
  return {
    colorName: titleCase(color),
    colorHex,
    designName: titleCase(design),
    description: fields.details || fields.description || fields['color details'] || '',
    pricePerUnit: price,
    unit: catalog.unit,
    availableQuantity: stock ?? 0,
    moq: firstNumber(fields.moq) || catalog.moq,
    photoLabel: color,
  } satisfies ParsedWhatsAppVariant;
}

async function sendWhatsAppText(phoneNumberId: string, to: string, message: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !phoneNumberId || !to) return;
  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    if (!response.ok) console.warn('Unable to send WhatsApp catalogue reply', response.status);
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
  if (!metadataResponse.ok || !metadata.url) throw new Error('Unable to retrieve the WhatsApp image URL.');
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
  const { data, error } = await admin.rpc('resolve_whatsapp_seller', { p_phone: senderPhone });
  if (error) throw new Error(`Unable to match the seller account: ${error.message}`);
  return Array.isArray(data) ? data[0] || null : null;
}

async function loadRecentMessages(senderPhone: string) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - MESSAGE_WINDOW_MINUTES * 60_000).toISOString();
  const { data, error } = await admin
    .from('whatsapp_catalog_messages')
    .select('id,wamid,sender_phone,phone_number_id,message_type,text_content,media_id,received_at,status')
    .eq('sender_phone', senderPhone)
    .in('status', ['pending', 'unmatched', 'failed'])
    .gte('received_at', cutoff)
    .order('received_at', { ascending: true });
  if (error) throw new Error(`Unable to read pending WhatsApp messages: ${error.message}`);
  return (data || []) as StoredMessage[];
}

function buildVariantSet(messages: StoredMessage[], catalog: ParsedWhatsAppCatalog) {
  const variants = new Map<string, VariantWithImages>();
  const unassignedImages: StoredMessage[] = [];

  const addVariant = (variant: ParsedWhatsAppVariant, image?: StoredMessage) => {
    const key = variantKey(variant.colorName, variant.designName);
    const existing = variants.get(key);
    variants.set(key, {
      ...(existing || variant),
      ...variant,
      imageMessages: [...(existing?.imageMessages || []), ...(image ? [image] : [])],
    });
  };

  for (const variant of catalog.variants) addVariant(variant);

  for (const message of messages) {
    if (message.message_type !== 'image' || !message.media_id) continue;
    const fullCaption = parseWhatsAppCatalog(message.text_content || '');
    if (fullCaption?.variants.length) {
      for (const variant of fullCaption.variants) addVariant(variant, message);
      continue;
    }
    const hint = parseImageVariantHint(message.text_content, catalog);
    if (hint) addVariant(hint, message);
    else unassignedImages.push(message);
  }

  if (!variants.size) {
    addVariant({
      colorName: 'Assorted',
      colorHex: null,
      designName: catalog.workType || 'Standard',
      description: '',
      pricePerUnit: catalog.pricePerUnit,
      unit: catalog.unit,
      availableQuantity: catalog.availableQuantity,
      moq: catalog.moq,
      photoLabel: null,
    });
  }

  const ordered = [...variants.values()];
  unassignedImages.forEach((message, index) => {
    const target = ordered[Math.min(index, ordered.length - 1)];
    if (target) target.imageMessages.push(message);
  });
  return ordered;
}

async function processSender(senderPhone: string, fallbackPhoneNumberId: string) {
  const admin = createAdminClient();
  const messages = await loadRecentMessages(senderPhone);
  const parsedMessages = messages
    .map((message) => ({ message, catalog: parseWhatsAppCatalog(message.text_content || '') }))
    .filter((entry): entry is { message: StoredMessage; catalog: ParsedWhatsAppCatalog } => Boolean(entry.catalog));
  const latest = parsedMessages.at(-1);
  const phoneNumberId = messages.at(-1)?.phone_number_id || fallbackPhoneNumberId;

  if (!latest) {
    const hasImage = messages.some((message) => message.message_type === 'image');
    await sendWhatsAppText(
      phoneNumberId,
      senderPhone,
      hasImage
        ? 'Photo received. Send the parent fabric details within 15 minutes. Include Catalog, Fabric and Rate. Add Color and Stock for each variation.'
        : 'Details received, but Fabric and Rate could not be identified. Send a clear fabric photo and use: Catalog, Fabric, Rate, then Color and Stock for each variation.'
    );
    return;
  }

  const seller = await resolveSeller(senderPhone);
  if (!seller?.seller_id) {
    await admin
      .from('whatsapp_catalog_messages')
      .update({ status: 'unmatched', error_message: 'Phone is not linked to a verified seller.' })
      .in('id', messages.map((message) => message.id));
    await sendWhatsAppText(
      phoneNumberId,
      senderPhone,
      'This WhatsApp number is not linked to a verified FabricTrad seller account. Verify the same phone number in your seller profile, then resend the catalogue.'
    );
    return;
  }

  const catalog = latest.catalog;
  const compatibleMessages = messages.filter((message) => {
    const parsed = parseWhatsAppCatalog(message.text_content || '');
    return !parsed || parsed.catalogKey === catalog.catalogKey || parsed.fabric === catalog.fabric;
  });
  const variants = buildVariantSet(compatibleMessages, catalog);
  const sourceReference = await sha256Hex(`${seller.seller_id}:${catalog.catalogKey}`);
  const messageIds = compatibleMessages.map((message) => message.wamid);
  const batchKey = await sha256Hex(`${sourceReference}:${messageIds.sort().join(':')}`);

  const { data: existingProduct, error: existingProductError } = await admin
    .from('seller_products')
    .select('id,sku,image_url')
    .eq('seller_id', seller.seller_id)
    .eq('source', 'whatsapp')
    .eq('source_reference', sourceReference)
    .maybeSingle();
  if (existingProductError) throw new Error(existingProductError.message);

  const productPayload = {
    seller_id: seller.seller_id,
    name: catalog.name,
    sku: existingProduct?.sku || `WA-${sourceReference.slice(0, 12).toUpperCase()}`,
    category: catalog.category,
    description: catalog.description,
    price_per_unit: catalog.pricePerUnit,
    unit: catalog.unit,
    available_quantity: catalog.availableQuantity,
    reserved_quantity: 0,
    min_stock: 0,
    moq: Math.max(1, Math.ceil(catalog.moq)),
    gsm: catalog.gsm,
    width_inches: catalog.widthInches,
    work_type: catalog.workType,
    dispatch_days: 3,
    status: 'active',
    source: 'whatsapp',
    source_reference: sourceReference,
    approval_status: 'approved',
    admin_review_notes: 'Auto-published from the verified seller WhatsApp number.',
  };

  let productId = existingProduct?.id || null;
  if (productId) {
    const { error } = await admin
      .from('seller_products')
      .update(productPayload)
      .eq('id', productId)
      .eq('seller_id', seller.seller_id);
    if (error) throw new Error(`Unable to update the parent fabric: ${error.message}`);
  } else {
    const { data: created, error } = await admin
      .from('seller_products')
      .insert(productPayload)
      .select('id')
      .single();
    if (error || !created?.id) {
      throw new Error(`Unable to create the parent fabric: ${error?.message || 'No product ID returned.'}`);
    }
    productId = created.id;
  }

  const allImages: string[] = [];
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const imageUrls: string[] = [];
    for (const message of variant.imageMessages) {
      if (!message.media_id) continue;
      const image = await downloadWhatsAppImage(message.media_id, message.phone_number_id);
      const path = `${seller.seller_id}/whatsapp/${productId}/${message.wamid}.${image.extension}`;
      const { error: uploadError } = await admin.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(path, image.buffer, {
          contentType: image.mime,
          cacheControl: '31536000',
          upsert: true,
        });
      if (uploadError) throw new Error(`Unable to store a variant photo: ${uploadError.message}`);
      const { data: publicUrl } = admin.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
      imageUrls.push(publicUrl.publicUrl);
      allImages.push(publicUrl.publicUrl);
    }

    const key = variantKey(variant.colorName, variant.designName);
    const variantCode = `${productPayload.sku}-${String(index + 1).padStart(2, '0')}-${key.slice(0, 24)}`.toUpperCase();
    const { data: existingVariant } = await admin
      .from('seller_product_variants')
      .select('id,image_url,image_urls,variant_code')
      .eq('product_id', productId)
      .eq('variant_key', key)
      .maybeSingle();

    const previousImages = Array.isArray(existingVariant?.image_urls)
      ? existingVariant.image_urls.map(String)
      : [];
    const mergedImages = [...new Set([...imageUrls, ...previousImages])];
    const variantPayload = {
      product_id: productId,
      seller_id: seller.seller_id,
      variant_key: key,
      variant_code: existingVariant?.variant_code || variantCode,
      color_name: variant.colorName,
      color_hex: variant.colorHex,
      design_name: variant.designName,
      description: variant.description || null,
      price_per_unit: variant.pricePerUnit,
      unit: variant.unit,
      available_quantity: variant.availableQuantity,
      reserved_quantity: 0,
      moq: variant.moq,
      image_url: imageUrls[0] || existingVariant?.image_url || null,
      image_urls: mergedImages,
      source: 'whatsapp',
      source_reference: `${sourceReference}:${key}`,
      approval_status: 'approved',
      status: 'active',
      admin_review_notes: 'Auto-published from the verified seller WhatsApp number.',
    };

    if (existingVariant?.id) {
      const { error } = await admin
        .from('seller_product_variants')
        .update(variantPayload)
        .eq('id', existingVariant.id)
        .eq('seller_id', seller.seller_id);
      if (error) throw new Error(`Unable to update ${variant.colorName}: ${error.message}`);
    } else {
      const { error } = await admin.from('seller_product_variants').insert(variantPayload);
      if (error) throw new Error(`Unable to create ${variant.colorName}: ${error.message}`);
    }
  }

  if (allImages.length) {
    await admin
      .from('seller_products')
      .update({ image_url: allImages[0], image_urls: [...new Set(allImages)] })
      .eq('id', productId)
      .eq('seller_id', seller.seller_id);
  }
  await admin.rpc('sync_product_variant_rollup', { p_product_id: productId });

  await admin.from('whatsapp_catalog_batches').upsert(
    {
      batch_key: batchKey,
      sender_phone: senderPhone,
      seller_id: seller.seller_id,
      product_id: productId,
      message_ids: messageIds,
      parsed_details: { ...catalog, variants },
      image_urls: [...new Set(allImages)],
      status: 'processed',
      error_message: null,
    },
    { onConflict: 'batch_key' }
  );
  await admin
    .from('whatsapp_catalog_messages')
    .update({ status: 'processed', product_id: productId, error_message: null })
    .in('id', compatibleMessages.map((message) => message.id));

  const totalStock = variants.reduce((sum, variant) => sum + variant.availableQuantity, 0);
  await sendWhatsAppText(
    phoneNumberId,
    senderPhone,
    `Catalogue published successfully.\n\nFabric: ${catalog.name}\nVariations: ${variants.length}\nTotal stock: ${totalStock} ${catalog.unit}\nPrice starts at: ₹${Math.min(...variants.map((variant) => variant.pricePerUnit))}/${catalog.unit}\n\nThe catalogue is now visible in your seller dashboard and searchable by buyers.`
  );
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
