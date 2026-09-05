import { createAdminClient } from '@/lib/supabase/admin';
import { downloadGupshupMedia, sendGupshupText } from '@/lib/gupshupWhatsApp';

const MEDIA_BUCKET = 'seller-product-media';
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const SESSION_MINUTES = 30;

export const SELLER_CATALOG_REQUIRED_FIELDS = [
  'name',
  'sku',
  'category',
  'price',
  'unit',
  'available',
  'moq',
  'sale_channel',
] as const;

export const SELLER_CATALOG_OPTIONAL_FIELDS = [
  'description',
  'min_stock',
  'gsm',
  'width',
  'work_type',
  'image_url',
  'dispatch_days',
  'origin_city',
  'origin_state',
  'status',
  'retail_store_min_quantity',
  'retail_store_max_quantity',
  'end_user_min_quantity',
  'end_user_max_quantity',
] as const;

export type SellerCatalogDraft = {
  name?: string;
  sku?: string;
  category?: string;
  description?: string;
  price?: number;
  unit?: string;
  available?: number;
  min_stock?: number;
  moq?: number;
  gsm?: number;
  width?: number;
  work_type?: string;
  image_url?: string;
  dispatch_days?: number;
  origin_city?: string;
  origin_state?: string;
  status?: string;
  sale_channel?: string;
  retail_store_min_quantity?: number;
  retail_store_max_quantity?: number;
  end_user_min_quantity?: number;
  end_user_max_quantity?: number;
};

type PendingMedia = {
  publicUrl: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  messageId: string;
};

export type SellerCatalogIncoming = {
  id: string;
  from: string;
  appName?: string | null;
  type: string;
  text?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
};

type SellerIdentity = {
  sellerId: string;
  userId: string;
  whatsappNo: string;
};

const fieldAliases: Record<string, keyof SellerCatalogDraft> = {
  name: 'name',
  product: 'name',
  'product name': 'name',
  fabric: 'name',
  sku: 'sku',
  code: 'sku',
  'product code': 'sku',
  category: 'category',
  description: 'description',
  details: 'description',
  price: 'price',
  rate: 'price',
  'rate per mtr': 'price',
  'rate per meter': 'price',
  unit: 'unit',
  available: 'available',
  stock: 'available',
  quantity: 'available',
  min_stock: 'min_stock',
  'min stock': 'min_stock',
  moq: 'moq',
  'minimum order': 'moq',
  gsm: 'gsm',
  width: 'width',
  work: 'work_type',
  work_type: 'work_type',
  'work type': 'work_type',
  image_url: 'image_url',
  'image url': 'image_url',
  dispatch_days: 'dispatch_days',
  'dispatch days': 'dispatch_days',
  origin_city: 'origin_city',
  'origin city': 'origin_city',
  origin_state: 'origin_state',
  'origin state': 'origin_state',
  status: 'status',
  sale_channel: 'sale_channel',
  'sale channel': 'sale_channel',
  channel: 'sale_channel',
  retail_store_min_quantity: 'retail_store_min_quantity',
  'retail store min quantity': 'retail_store_min_quantity',
  retail_store_max_quantity: 'retail_store_max_quantity',
  'retail store max quantity': 'retail_store_max_quantity',
  end_user_min_quantity: 'end_user_min_quantity',
  'end user min quantity': 'end_user_min_quantity',
  end_user_max_quantity: 'end_user_max_quantity',
  'end user max quantity': 'end_user_max_quantity',
};

const numericFields = new Set<keyof SellerCatalogDraft>([
  'price',
  'available',
  'min_stock',
  'moq',
  'gsm',
  'width',
  'dispatch_days',
  'retail_store_min_quantity',
  'retail_store_max_quantity',
  'end_user_min_quantity',
  'end_user_max_quantity',
]);

const clean = (value: unknown, max = 1000) =>
  (typeof value === 'string' ? value.trim() : '').replace(/\s+/g, ' ').slice(0, max);

export const normalizeSellerCatalogText = (value: unknown) =>
  (typeof value === 'string' ? value : '').replace(/\r\n?/g, '\n').trim().slice(0, 12_000);

const normalizePhone = (value: unknown) => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  const lastTen = digits.slice(-10);
  return /^[6-9][0-9]{9}$/.test(lastTen) ? lastTen : '';
};

const parseNumber = (value: string) => {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
};

const normalizeUnit = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (/^(m|mtr|meter|metre|meters|metres)$/.test(normalized)) return 'mtr';
  if (/^(kg|kilogram|kilograms)$/.test(normalized)) return 'kg';
  if (/^(pc|pcs|piece|pieces)$/.test(normalized)) return 'piece';
  if (/^(roll|rolls)$/.test(normalized)) return 'roll';
  if (/^(yard|yards|yd)$/.test(normalized)) return 'yard';
  if (/^(farma|farmas)$/.test(normalized)) return 'farma';
  if (normalized === 'custom') return 'custom';
  return normalized;
};

const normalizeSaleChannel = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  if (['b2b', 'retail_store', 'wholesale'].includes(normalized)) return 'b2b';
  if (['retail', 'end_user', 'consumer', 'b2c'].includes(normalized)) return 'retail';
  if (['both', 'b2b+b2c', 'b2b_and_retail'].includes(normalized)) return 'both';
  return normalized;
};

const formatFieldName = (value: string) => value.replaceAll('_', ' ');

export const SELLER_CATALOG_FORMAT_MESSAGE = `FabricTrad Seller Catalogue Format\n\nSend ONE product at a time, followed by that product's photos. Use the field names below.\n\nREQUIRED\nname =\nsku =\ncategory =\nprice =\nunit = mtr\navailable =\nmoq =\nsale_channel = b2b | retail | both\n\nOPTIONAL (defaults shown where applicable)\ndescription =\nmin_stock = 0\ngsm =\nwidth =\nwork_type = Plain\nimage_url =\ndispatch_days = 3\norigin_city =\norigin_state =\nstatus = draft\nretail_store_min_quantity =\nretail_store_max_quantity =\nend_user_min_quantity =\nend_user_max_quantity =\n\nAllowed unit: mtr, kg, piece, roll, yard, farma, custom.\nAllowed status: draft, active, archived.\nPhotos sent in WhatsApp are attached automatically, so image_url is optional.\n\nExample:\nname = Pure Soft Net\nsku = NET-001\ncategory = Net & Netting\ndescription = Multi thread cording and sequin work\nprice = 940\nunit = mtr\navailable = 120\nmin_stock = 10\nmoq = 3\ngsm = 80\nwidth = 56\nwork_type = Cording + Sequin\ndispatch_days = 3\norigin_city = Surat\norigin_state = Gujarat\nstatus = draft\nsale_channel = both\nretail_store_min_quantity = 3\nretail_store_max_quantity = 100\nend_user_min_quantity = 1\nend_user_max_quantity = 10`;

export function parseSellerCatalogFormat(text: string): SellerCatalogDraft {
  const draft: SellerCatalogDraft = {};
  const cleanedText = text.replace(/^forwarded\s*/i, '').replace(/\r/g, '');

  for (const rawLine of cleanedText.split('\n')) {
    const line = rawLine.trim().replace(/^[•*\-]+\s*/, '');
    if (!line) continue;
    const match = line.match(/^([^:=]{2,80})\s*[:=]\s*(.*)$/);
    if (!match) continue;
    const rawKey = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const key = fieldAliases[rawKey];
    if (!key) continue;
    const rawValue = match[2].trim();
    if (!rawValue) continue;

    if (numericFields.has(key)) {
      const value = parseNumber(rawValue);
      if (Number.isFinite(value)) (draft as Record<string, unknown>)[key] = value;
      continue;
    }

    if (key === 'unit') {
      draft.unit = normalizeUnit(rawValue);
    } else if (key === 'sale_channel') {
      draft.sale_channel = normalizeSaleChannel(rawValue);
    } else if (key === 'status') {
      draft.status = rawValue.toLowerCase();
    } else {
      (draft as Record<string, unknown>)[key] = clean(rawValue, key === 'description' ? 3000 : 500);
    }
  }

  return draft;
}

export function validateSellerCatalogDraft(draft: SellerCatalogDraft) {
  const missing = SELLER_CATALOG_REQUIRED_FIELDS.filter((field) => {
    const value = draft[field];
    return value === undefined || value === null || value === '';
  });
  const errors: string[] = [];

  if (draft.price !== undefined && (!(draft.price > 0) || !Number.isFinite(draft.price))) errors.push('price must be greater than 0');
  if (draft.available !== undefined && (!(draft.available >= 0) || !Number.isFinite(draft.available))) errors.push('available must be 0 or more');
  if (draft.min_stock !== undefined && draft.min_stock < 0) errors.push('min_stock must be 0 or more');
  if (draft.moq !== undefined && (!Number.isInteger(draft.moq) || draft.moq < 1)) errors.push('moq must be a whole number of at least 1');
  if (draft.gsm !== undefined && (!Number.isInteger(draft.gsm) || draft.gsm <= 0)) errors.push('gsm must be a positive whole number');
  if (draft.width !== undefined && draft.width <= 0) errors.push('width must be greater than 0');
  if (draft.dispatch_days !== undefined && (!Number.isInteger(draft.dispatch_days) || draft.dispatch_days < 1 || draft.dispatch_days > 30)) errors.push('dispatch_days must be a whole number from 1 to 30');
  if (draft.unit && !['mtr', 'kg', 'piece', 'roll', 'yard', 'farma', 'custom'].includes(draft.unit)) errors.push('unit must be mtr, kg, piece, roll, yard, farma or custom');
  if (draft.sale_channel && !['b2b', 'retail', 'both'].includes(draft.sale_channel)) errors.push('sale_channel must be b2b, retail or both');
  if (draft.status && !['draft', 'active', 'archived'].includes(draft.status)) errors.push('status must be draft, active or archived');
  if (draft.image_url && !/^https:\/\/[^\s]+$/i.test(draft.image_url)) errors.push('image_url must be a valid https URL');

  const minMaxPairs: Array<[keyof SellerCatalogDraft, keyof SellerCatalogDraft]> = [
    ['retail_store_min_quantity', 'retail_store_max_quantity'],
    ['end_user_min_quantity', 'end_user_max_quantity'],
  ];
  for (const [minKey, maxKey] of minMaxPairs) {
    const min = draft[minKey] as number | undefined;
    const max = draft[maxKey] as number | undefined;
    if (min !== undefined && min < 0) errors.push(`${minKey} must be 0 or more`);
    if (max !== undefined && max < 0) errors.push(`${maxKey} must be 0 or more`);
    if (min !== undefined && max !== undefined && max < min) errors.push(`${maxKey} cannot be less than ${minKey}`);
  }

  return { missing, errors };
}

function mergeDraft(base: unknown, next: SellerCatalogDraft): SellerCatalogDraft {
  const safeBase = base && typeof base === 'object' && !Array.isArray(base) ? (base as SellerCatalogDraft) : {};
  return { ...safeBase, ...next };
}

async function sendSellerText(to: string, message: string, appName?: string | null) {
  try {
    await sendGupshupText(to, message, false, appName || undefined);
  } catch (error) {
    console.error('Seller catalogue WhatsApp reply failed', {
      code: error instanceof Error ? error.message : 'provider_error',
    });
  }
}

async function findSellerIdentity(fromRaw: string): Promise<SellerIdentity | null> {
  const whatsappNo = normalizePhone(fromRaw);
  if (!whatsappNo) return null;
  const admin = createAdminClient();
  const { data: seller } = await admin
    .from('seller_profiles')
    .select('id,user_id,whatsapp_no,is_active')
    .eq('whatsapp_no', whatsappNo)
    .eq('is_active', true)
    .maybeSingle();
  if (!seller?.id || !seller.user_id) return null;

  const { data: profile } = await admin
    .from('user_profiles')
    .select('id,can_sell,is_active')
    .eq('id', seller.user_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!profile?.id || profile.can_sell !== true) return null;

  return { sellerId: String(seller.id), userId: String(seller.user_id), whatsappNo };
}

async function readSession(sellerId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('whatsapp_seller_catalog_sessions')
    .select('seller_id,user_id,whatsapp_no,active_product_id,active_sku,pending_draft,pending_media,last_message_at,expires_at')
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function saveSession(identity: SellerIdentity, patch: Record<string, unknown>) {
  const admin = createAdminClient();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MINUTES * 60_000).toISOString();
  const { error } = await admin.from('whatsapp_seller_catalog_sessions').upsert(
    {
      seller_id: identity.sellerId,
      user_id: identity.userId,
      whatsapp_no: identity.whatsappNo,
      last_message_at: now.toISOString(),
      expires_at: expires,
      updated_at: now.toISOString(),
      ...patch,
    },
    { onConflict: 'seller_id' }
  );
  if (error) throw error;
}

function extensionFor(mime: string) {
  const value = mime.toLowerCase();
  if (value.includes('png')) return 'png';
  if (value.includes('webp')) return 'webp';
  if (value.includes('jpeg') || value.includes('jpg')) return 'jpg';
  if (value.includes('quicktime')) return 'mov';
  if (value.includes('webm')) return 'webm';
  return 'mp4';
}

async function attachMediaToProduct(identity: SellerIdentity, productId: string, media: PendingMedia[]) {
  if (!media.length) return 0;
  const admin = createAdminClient();
  const { data: product } = await admin
    .from('seller_products')
    .select('id,image_url,image_urls')
    .eq('id', productId)
    .eq('seller_id', identity.sellerId)
    .maybeSingle();
  if (!product?.id) return 0;

  const existingUrls = Array.isArray(product.image_urls)
    ? product.image_urls.map((item: unknown) => String(item)).filter(Boolean)
    : [];
  const newUrls = media.map((item) => item.publicUrl).filter((url) => !existingUrls.includes(url));
  const imageUrls = media.filter((item) => item.mimeType.startsWith('image/')).map((item) => item.publicUrl);
  const mergedUrls = Array.from(new Set([...existingUrls, ...imageUrls])).slice(0, 20);

  if (newUrls.length) {
    const rows = media
      .filter((item) => newUrls.includes(item.publicUrl))
      .map((item, index) => ({
        product_id: productId,
        seller_id: identity.sellerId,
        media_type: item.mimeType.startsWith('video/') ? 'video' : 'image',
        view_type: item.mimeType.startsWith('video/') ? 'reel' : index === 0 && existingUrls.length === 0 ? 'front' : 'other',
        public_url: item.publicUrl,
        storage_path: item.storagePath,
        original_filename: `whatsapp-${item.messageId}.${extensionFor(item.mimeType)}`,
        mime_type: item.mimeType,
        file_size: item.fileSize,
        sort_order: existingUrls.length + index,
        alt_text: 'Seller product media uploaded through FabricTrad WhatsApp',
      }));
    const { error: mediaError } = await admin.from('seller_product_media').upsert(rows, {
      onConflict: 'storage_path',
      ignoreDuplicates: true,
    });
    if (mediaError) throw mediaError;
  }

  const { error: productError } = await admin
    .from('seller_products')
    .update({
      image_url: product.image_url || mergedUrls[0] || null,
      image_urls: mergedUrls,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('seller_id', identity.sellerId);
  if (productError) throw productError;
  return newUrls.length;
}

async function saveInboundAudit(
  identity: SellerIdentity,
  incoming: SellerCatalogIncoming,
  values: {
    draft?: SellerCatalogDraft | null;
    storagePath?: string | null;
    mimeType?: string | null;
    productId?: string | null;
    status: string;
    error?: string | null;
  }
) {
  const admin = createAdminClient();
  const { error } = await admin.from('whatsapp_catalog_ingestions').upsert(
    {
      user_id: identity.userId,
      seller_id: identity.sellerId,
      wa_message_id: incoming.id,
      from_phone: identity.whatsappNo,
      message_type: incoming.type,
      message_text: normalizeSellerCatalogText(incoming.text) || null,
      media_id: incoming.mediaUrl || null,
      media_storage_path: values.storagePath || null,
      media_mime_type: values.mimeType || null,
      parsed_draft: values.draft || null,
      product_id: values.productId || null,
      status: values.status,
      error_message: values.error || null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'wa_message_id' }
  );
  if (error) throw error;
}

async function handleMedia(identity: SellerIdentity, incoming: SellerCatalogIncoming) {
  if (!incoming.mediaUrl) return;
  const mime = incoming.mediaMimeType || 'image/jpeg';
  if (!(mime.startsWith('image/') || mime.startsWith('video/'))) {
    await saveInboundAudit(identity, incoming, { status: 'unsupported_media', mimeType: mime });
    await sendSellerText(identity.whatsappNo, 'FabricTrad catalogue uploads accept product images and short product videos. Send the product details in FORMAT and attach images/video.', incoming.appName);
    return;
  }

  const downloaded = await downloadGupshupMedia(incoming.mediaUrl, MAX_MEDIA_BYTES);
  if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(downloaded.mime)) {
    throw new Error('unsupported_downloaded_media_type');
  }
  const extension = extensionFor(downloaded.mime);
  const storagePath = `whatsapp/${identity.sellerId}/${incoming.id}.${extension}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(MEDIA_BUCKET).upload(storagePath, downloaded.buffer, {
    contentType: downloaded.mime,
    cacheControl: '31536000',
    upsert: true,
  });
  if (uploadError) throw uploadError;
  const { data: publicData } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
  const pending: PendingMedia = {
    publicUrl: publicData.publicUrl,
    storagePath,
    mimeType: downloaded.mime,
    fileSize: downloaded.buffer.byteLength,
    messageId: incoming.id,
  };

  const session = await readSession(identity.sellerId);
  if (session?.active_product_id) {
    const count = await attachMediaToProduct(identity, String(session.active_product_id), [pending]);
    await saveInboundAudit(identity, incoming, {
      storagePath,
      mimeType: downloaded.mime,
      productId: String(session.active_product_id),
      status: 'attached',
    });
    await saveSession(identity, { pending_media: [], active_product_id: session.active_product_id, active_sku: session.active_sku });
    await sendSellerText(identity.whatsappNo, `Attached ${count || 1} media file to SKU ${session.active_sku || ''}. You can edit/reorder it in Seller Portal → Products.`, incoming.appName);
    return;
  }

  const queued = Array.isArray(session?.pending_media) ? (session?.pending_media as PendingMedia[]) : [];
  const nextQueue = [...queued, pending].slice(-20);
  await saveSession(identity, {
    pending_draft: session?.pending_draft || {},
    pending_media: nextQueue,
    active_product_id: null,
    active_sku: null,
  });
  await saveInboundAudit(identity, incoming, { storagePath, mimeType: downloaded.mime, status: 'media_queued' });
  await sendSellerText(
    identity.whatsappNo,
    `Saved image/video ${nextQueue.length}. Now send this product's details using the FabricTrad format.\n\n${SELLER_CATALOG_FORMAT_MESSAGE}` ,
    incoming.appName
  );
}

async function handleText(identity: SellerIdentity, incoming: SellerCatalogIncoming) {
  const text = normalizeSellerCatalogText(incoming.text);
  const command = text.toLowerCase();
  if (!text || ['format', 'template', 'help', 'add product', 'catalog format', 'catalogue format'].includes(command)) {
    await saveInboundAudit(identity, incoming, { status: 'format_sent' });
    await sendSellerText(identity.whatsappNo, SELLER_CATALOG_FORMAT_MESSAGE, incoming.appName);
    return;
  }

  if (['reset', 'cancel', 'new product'].includes(command)) {
    await saveSession(identity, { pending_draft: {}, pending_media: [], active_product_id: null, active_sku: null });
    await saveInboundAudit(identity, incoming, { status: 'session_reset' });
    await sendSellerText(identity.whatsappNo, `Started a new product.\n\n${SELLER_CATALOG_FORMAT_MESSAGE}`, incoming.appName);
    return;
  }

  const session = await readSession(identity.sellerId);
  const parsed = parseSellerCatalogFormat(text);
  const merged = mergeDraft(session?.pending_draft, parsed);
  const validation = validateSellerCatalogDraft(merged);

  if (validation.missing.length || validation.errors.length) {
    await saveSession(identity, {
      pending_draft: merged,
      pending_media: Array.isArray(session?.pending_media) ? session?.pending_media : [],
      active_product_id: null,
      active_sku: null,
    });
    await saveInboundAudit(identity, incoming, { draft: merged, status: 'needs_clarification' });
    const parts = [
      validation.missing.length ? `Missing required: ${validation.missing.map(formatFieldName).join(', ')}.` : '',
      validation.errors.length ? `Fix: ${validation.errors.join('; ')}.` : '',
      `Nothing was added yet. Send the missing/corrected fields using this template:\n\n${SELLER_CATALOG_FORMAT_MESSAGE}` ,
    ].filter(Boolean);
    await sendSellerText(identity.whatsappNo, parts.join('\n'), incoming.appName);
    return;
  }

  const admin = createAdminClient();
  const sku = clean(merged.sku, 80);
  const { data: duplicate } = await admin
    .from('seller_products')
    .select('id,name,sku')
    .eq('seller_id', identity.sellerId)
    .eq('sku', sku)
    .maybeSingle();
  if (duplicate?.id) {
    await saveInboundAudit(identity, incoming, { draft: merged, productId: String(duplicate.id), status: 'duplicate_sku' });
    await saveSession(identity, { pending_draft: {}, pending_media: [], active_product_id: duplicate.id, active_sku: duplicate.sku });
    await sendSellerText(identity.whatsappNo, `SKU ${sku} already exists, so FabricTrad did not create a duplicate. Edit that item inside Seller Portal → Products, or send NEW PRODUCT and use a different SKU.`, incoming.appName);
    return;
  }

  const queuedMedia = Array.isArray(session?.pending_media) ? (session?.pending_media as PendingMedia[]) : [];
  const explicitImage = merged.image_url && /^https:\/\//i.test(merged.image_url) ? merged.image_url : null;
  const mediaUrls = queuedMedia.filter((item) => item.mimeType.startsWith('image/')).map((item) => item.publicUrl);
  const imageUrls = Array.from(new Set([...(explicitImage ? [explicitImage] : []), ...mediaUrls])).slice(0, 20);
  const saleChannel = merged.sale_channel as 'b2b' | 'retail' | 'both';
  const moq = Math.max(1, Math.trunc(merged.moq || 1));

  const { data: product, error: productError } = await admin
    .from('seller_products')
    .insert({
      seller_id: identity.sellerId,
      name: clean(merged.name, 160),
      sku,
      category: clean(merged.category, 160),
      description: clean(merged.description, 3000) || null,
      price_per_unit: merged.price,
      unit: merged.unit,
      available_quantity: merged.available,
      min_stock: merged.min_stock ?? 0,
      moq,
      gsm: merged.gsm ?? null,
      width_inches: merged.width ?? null,
      work_type: clean(merged.work_type, 160) || 'Plain',
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      dispatch_days: merged.dispatch_days ?? 3,
      origin_city: clean(merged.origin_city, 120) || null,
      origin_state: clean(merged.origin_state, 120) || null,
      status: merged.status || 'draft',
      approval_status: 'pending',
      source: 'whatsapp',
      source_reference: incoming.id,
      sale_channel: saleChannel,
      retail_store_min_quantity: merged.retail_store_min_quantity ?? (saleChannel === 'b2b' || saleChannel === 'both' ? moq : null),
      retail_store_max_quantity: merged.retail_store_max_quantity ?? null,
      end_user_min_quantity: merged.end_user_min_quantity ?? (saleChannel === 'retail' || saleChannel === 'both' ? 1 : null),
      end_user_max_quantity: merged.end_user_max_quantity ?? null,
      end_user_enabled: saleChannel === 'retail' || saleChannel === 'both',
      end_user_limit_mode: saleChannel === 'b2b' ? 'disabled' : 'custom',
      updated_at: new Date().toISOString(),
    })
    .select('id,name,sku,status')
    .single();
  if (productError || !product?.id) throw productError || new Error('seller_product_create_failed');

  if (queuedMedia.length) await attachMediaToProduct(identity, String(product.id), queuedMedia);

  await saveInboundAudit(identity, incoming, {
    draft: merged,
    productId: String(product.id),
    status: 'product_created',
  });
  if (queuedMedia.length) {
    await admin
      .from('whatsapp_catalog_ingestions')
      .update({ product_id: product.id, status: 'attached', updated_at: new Date().toISOString() })
      .eq('seller_id', identity.sellerId)
      .is('product_id', null)
      .eq('status', 'media_queued')
      .gte('received_at', new Date(Date.now() - SESSION_MINUTES * 60_000).toISOString());
  }

  await saveSession(identity, {
    pending_draft: {},
    pending_media: [],
    active_product_id: product.id,
    active_sku: product.sku,
  });

  await sendSellerText(
    identity.whatsappNo,
    `Added ${product.name} (SKU ${product.sku}) to your FabricTrad store as ${product.status}. ${queuedMedia.length ? `${queuedMedia.length} WhatsApp media file(s) attached. ` : ''}You can now modify every detail in Seller Portal → Products. Send NEW PRODUCT before sending the next item's photos/details, or FORMAT for the template.`,
    incoming.appName
  );
}

export async function tryHandleSellerCatalogMessage(incoming: SellerCatalogIncoming) {
  const identity = await findSellerIdentity(incoming.from);
  if (!identity) return { handled: false as const };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('whatsapp_catalog_ingestions')
    .select('id,status')
    .eq('wa_message_id', incoming.id)
    .maybeSingle();
  if (existing?.id && existing.status !== 'failed') return { handled: true as const, duplicate: true };

  try {
    if (incoming.mediaUrl) {
      if (Object.keys(parseSellerCatalogFormat(normalizeSellerCatalogText(incoming.text))).length) {
        await handleText(identity, incoming);
      }
      await handleMedia(identity, incoming);
    } else {
      await handleText(identity, incoming);
    }
    return { handled: true as const };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 1000) : 'seller_catalog_processing_failed';
    await saveInboundAudit(identity, incoming, { status: 'failed', error: reason }).catch(() => undefined);
    await sendSellerText(
      identity.whatsappNo,
      'FabricTrad saved your seller message but could not finish adding the product. Nothing was duplicated. Send FORMAT and retry, or edit the draft in Seller Portal.',
      incoming.appName
    );
    throw error;
  }
}
