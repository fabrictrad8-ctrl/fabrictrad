import { parseCatalogMessage } from '@/lib/catalogAssistant';
import { createAdminClient } from '@/lib/supabase/admin';
import { storeKey, storeSuggestionSeeds, validateStoreName } from '@/lib/buyerStores';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fabrictrad.com').replace(/\/$/, '');

type MetaMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  document?: { id?: string; caption?: string; filename?: string; mime_type?: string };
};

type UserProfile = {
  id: string;
  is_active: boolean | null;
  can_buy: boolean | null;
  can_sell: boolean | null;
  full_name?: string | null;
};

const normalizePhone = (value: unknown) => {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  const lastTen = digits.slice(-10);
  return /^[6-9][0-9]{9}$/.test(lastTen) ? lastTen : '';
};

const messageText = (message: MetaMessage) => {
  if (message.type === 'text') return String(message.text?.body || '').trim();
  if (message.type === 'image') return String(message.image?.caption || '').trim();
  if (message.type === 'document') return String(message.document?.caption || '').trim();
  return '';
};

const imageMedia = (message: MetaMessage) =>
  message.type === 'image' && message.image?.id
    ? { id: message.image.id, mime: message.image.mime_type || 'image/jpeg' }
    : null;

const extensionFor = (mime: string) => {
  const value = mime.toLowerCase();
  if (value.includes('png')) return 'png';
  if (value.includes('webp')) return 'webp';
  if (value.includes('heic')) return 'heic';
  if (value.includes('heif')) return 'heif';
  return 'jpg';
};

const extractStoreName = (text: string) => {
  const patterns = [
    /(?:my\s+)?store(?:\s+name)?\s*(?:is|[:=\-])\s*([^\n,;]{3,80})/i,
    /(?:shop|business)\s+name\s*(?:is|[:=\-])\s*([^\n,;]{3,80})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[.!]+$/, '');
  }
  return '';
};

const menu = () =>
  [
    'FabricTrad Custom Order',
    '1. CATALOGUE — browse fabrics/products',
    '2. STORE: Your Store Name — save your unique store identity',
    '3. STATUS — check your current custom order',
    '4. HUMAN — request customer-service help',
    '',
    'You can also send a product/SKU, reference image, fabric choice or customization details when I ask for them.',
  ].join('\n');

export async function sendBuyerWhatsAppText(toRaw: string, text: string, orderId?: string | null, userId?: string | null) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return { sent: false, reason: 'not_configured' } as const;

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toRaw,
      type: 'text',
      text: { body: text.slice(0, 4000), preview_url: true },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return { sent: false, reason: `provider_${response?.status || 0}` } as const;
  const payload = (await response.json().catch(() => ({}))) as { messages?: Array<{ id?: string }> };
  const outboundId = String(payload.messages?.[0]?.id || '').trim();

  if (outboundId) {
    const admin = createAdminClient();
    await admin.from('whatsapp_buyer_messages').insert({
      wa_message_id: outboundId,
      whatsapp_phone: normalizePhone(toRaw) || toRaw.replace(/\D/g, '').slice(-15),
      user_id: userId || null,
      bespoke_order_id: orderId || null,
      direction: 'outbound',
      message_type: 'text',
      message_text: text.slice(0, 12_000),
      processing_status: 'processed',
    }).then(() => undefined, () => undefined);
  }
  return { sent: true, id: outboundId || null } as const;
}

async function downloadImage(mediaId: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('whatsapp_access_token_missing');
  const metadataResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  if (!metadataResponse.ok) throw new Error(`media_metadata_${metadataResponse.status}`);
  const metadata = (await metadataResponse.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!metadata.url) throw new Error('media_url_missing');
  if (Number(metadata.file_size || 0) > MAX_MEDIA_BYTES) throw new Error('media_too_large');

  const mediaResponse = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!mediaResponse.ok) throw new Error(`media_download_${mediaResponse.status}`);
  const buffer = Buffer.from(await mediaResponse.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) throw new Error('media_too_large');
  const mime = String(metadata.mime_type || mediaResponse.headers.get('content-type') || 'image/jpeg')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!mime.startsWith('image/')) throw new Error('reference_image_required');
  return { buffer, mime };
}

async function availableStoreSuggestions(admin: ReturnType<typeof createAdminClient>, name: string) {
  const seeds = storeSuggestionSeeds(name);
  const keys = seeds.map((item) => storeKey(item.storeName));
  const { data } = await admin.from('buyer_stores').select('store_key').in('store_key', keys);
  const used = new Set((data || []).map((row) => String(row.store_key || '')));
  return seeds.filter((item) => !used.has(storeKey(item.storeName))).slice(0, 4);
}

async function attachStoreName(input: {
  admin: ReturnType<typeof createAdminClient>;
  profile: UserProfile;
  phone: string;
  requestedName: string;
}) {
  const validation = validateStoreName(input.requestedName);
  if (!validation.valid) return { ok: false as const, message: validation.error };

  const { data: collision } = await input.admin
    .from('buyer_stores')
    .select('id,user_id,store_name,store_handle')
    .eq('store_key', validation.key)
    .maybeSingle();
  if (collision?.id && collision.user_id !== input.profile.id) {
    const suggestions = await availableStoreSuggestions(input.admin, validation.storeName);
    return {
      ok: false as const,
      message: `“${validation.storeName}” is already taken. Available suggestions:\n${suggestions
        .map((item, index) => `${index + 1}. ${item.storeName} (@${item.handle})`)
        .join('\n')}\nReply STORE: followed by the name you want.`,
    };
  }
  if (collision?.id && collision.user_id === input.profile.id) {
    return { ok: true as const, store: collision };
  }

  const [{ data: buyer }, { data: primary }] = await Promise.all([
    input.admin.from('buyer_profiles').select('id').eq('user_id', input.profile.id).maybeSingle(),
    input.admin.from('buyer_stores').select('id').eq('user_id', input.profile.id).eq('is_primary', true).maybeSingle(),
  ]);
  const { data: created, error } = await input.admin
    .from('buyer_stores')
    .insert({
      user_id: input.profile.id,
      buyer_id: buyer?.id || null,
      store_name: validation.storeName,
      store_key: validation.key,
      store_handle: validation.handle,
      is_primary: !primary?.id,
      source: 'whatsapp',
      whatsapp_phone: `91${input.phone}`,
    })
    .select('id,user_id,store_name,store_handle')
    .single();
  if (error) {
    if (error.code === '23505') {
      return { ok: false as const, message: 'That store name was just claimed by another account. Reply with another STORE: name.' };
    }
    throw error;
  }
  return { ok: true as const, store: created };
}

const parseAppointmentIso = (text: string) => {
  const match = text.match(/(?:appointment\s*)?(20\d{2}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/i);
  if (!match) return null;
  const hour = Number(match[2]);
  if (hour < 0 || hour > 23) return null;
  // Treat explicit WhatsApp appointment times as India time. Converting +05:30
  // to UTC here avoids server-location dependent Date parsing.
  const iso = `${match[1]}T${String(hour).padStart(2, '0')}:${match[3]}:00+05:30`;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now() ? date : null;
};

async function orderSummary(order: Record<string, unknown> | null) {
  if (!order) return 'No active custom order. Reply CATALOGUE to start one.';
  const quote = Number(order.quoted_amount || 0);
  const paid = Number(order.paid_amount || 0);
  const balance = Math.max(0, quote - paid);
  return [
    `Custom order ${String(order.id || '').slice(0, 8).toUpperCase()}`,
    `Stage: ${String(order.stage || 'catalogue').replaceAll('_', ' ')}`,
    quote > 0 ? `Quotation: ₹${quote.toFixed(2)}` : null,
    paid > 0 ? `Paid: ₹${paid.toFixed(2)}` : null,
    quote > 0 ? `Balance: ₹${balance.toFixed(2)}` : null,
    order.human_action_required ? `Human action: ${String(order.human_action_reason || 'required').replaceAll('_', ' ')}` : null,
  ].filter(Boolean).join('\n');
}

export async function handleBuyerWhatsAppMessage(message: MetaMessage): Promise<{ handled: boolean }> {
  const waMessageId = String(message.id || '').trim();
  const fromRaw = String(message.from || '').replace(/\D/g, '');
  const phone = normalizePhone(fromRaw);
  if (!waMessageId || !phone) return { handled: false };

  const admin = createAdminClient();
  const text = messageText(message).slice(0, 12_000);
  const lower = text.toLowerCase();
  const { data: already } = await admin
    .from('whatsapp_buyer_messages')
    .select('id')
    .eq('wa_message_id', waMessageId)
    .maybeSingle();
  if (already?.id) return { handled: true };

  const [{ data: profile }, { data: session }] = await Promise.all([
    admin
      .from('user_profiles')
      .select('id,is_active,can_buy,can_sell,full_name')
      .like('phone', `%${phone}`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    admin.from('whatsapp_buyer_sessions').select('*').eq('whatsapp_phone', phone).maybeSingle(),
  ]);
  const typedProfile = (profile || null) as UserProfile | null;

  // A seller can explicitly leave a buyer conversation and return to the
  // pre-existing WhatsApp catalogue ingestion flow.
  if (/^(sell|seller|upload product|catalog upload)\b/i.test(text) && typedProfile?.can_sell === true) {
    if (session) await admin.from('whatsapp_buyer_sessions').delete().eq('whatsapp_phone', phone);
    return { handled: false };
  }

  const parsedSellerDraft = text ? parseCatalogMessage(text) : null;
  const obviousBuyerIntent = /\b(buy|order|custom|stitch|tailor|catalogue|catalog|fabric|measurement|appointment|store\s*(?:name)?\s*[:=]|status|human|help)\b/i.test(text);
  if (!session && typedProfile?.can_sell === true && parsedSellerDraft && !obviousBuyerIntent) {
    return { handled: false };
  }

  await admin.from('whatsapp_buyer_messages').insert({
    wa_message_id: waMessageId,
    whatsapp_phone: phone,
    user_id: typedProfile?.id || null,
    bespoke_order_id: session?.active_order_id || null,
    direction: 'inbound',
    message_type: message.type || 'unknown',
    message_text: text || null,
    media_id: imageMedia(message)?.id || null,
    processing_status: 'received',
  });

  const requestedStoreName = extractStoreName(text);
  if (!typedProfile || typedProfile.can_buy === false) {
    const context = {
      ...(session?.context && typeof session.context === 'object' ? session.context : {}),
      requested_store_name: requestedStoreName || (session?.context as Record<string, unknown> | null)?.requested_store_name || null,
      from_raw: fromRaw,
    };
    await admin.from('whatsapp_buyer_sessions').upsert({
      whatsapp_phone: phone,
      user_id: typedProfile?.id || null,
      stage: 'catalogue',
      context,
      last_inbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await admin.from('whatsapp_buyer_messages').update({ processing_status: 'processed' }).eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(
      fromRaw,
      `${requestedStoreName ? `I saved “${requestedStoreName}” as your requested store name.\n\n` : ''}To attach WhatsApp orders securely, sign in or create a FabricTrad buyer account with this same mobile number (${phone}).\n${SITE_URL}/buyer-registration?type=retail_store\n\nAfter that, send HI here again and I will continue automatically.`,
      null,
      typedProfile?.id || null
    );
    return { handled: true };
  }

  let storeId: string | null = session?.buyer_store_id || null;
  if (requestedStoreName) {
    const storeResult = await attachStoreName({ admin, profile: typedProfile, phone, requestedName: requestedStoreName });
    if (!storeResult.ok) {
      await admin.from('whatsapp_buyer_messages').update({ processing_status: 'processed' }).eq('wa_message_id', waMessageId);
      await sendBuyerWhatsAppText(fromRaw, storeResult.message, session?.active_order_id || null, typedProfile.id);
      return { handled: true };
    }
    storeId = storeResult.store.id;
  } else if (!storeId) {
    const { data: primaryStore } = await admin
      .from('buyer_stores')
      .select('id,store_name,store_handle')
      .eq('user_id', typedProfile.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    storeId = primaryStore?.id || null;
  }

  let activeOrder: Record<string, unknown> | null = null;
  if (session?.active_order_id) {
    const { data } = await admin
      .from('bespoke_orders')
      .select('*')
      .eq('id', session.active_order_id)
      .eq('user_id', typedProfile.id)
      .maybeSingle();
    activeOrder = (data || null) as Record<string, unknown> | null;
  }

  if (/^(new|new order|start over|catalogue|catalog)$/i.test(text) || (!activeOrder && !requestedStoreName)) {
    const { data: buyer } = await admin.from('buyer_profiles').select('id').eq('user_id', typedProfile.id).maybeSingle();
    if (!buyer?.id) {
      await sendBuyerWhatsAppText(fromRaw, `Your buyer profile is still being prepared. Complete it here: ${SITE_URL}/buyer-registration?resume=1`, null, typedProfile.id);
      await admin.from('whatsapp_buyer_messages').update({ processing_status: 'processed' }).eq('wa_message_id', waMessageId);
      return { handled: true };
    }
    const { data: created, error: createError } = await admin
      .from('bespoke_orders')
      .insert({
        user_id: typedProfile.id,
        buyer_id: buyer.id,
        buyer_store_id: storeId,
        source: 'whatsapp',
        whatsapp_phone: fromRaw,
        stage: 'catalogue',
      })
      .select('*')
      .single();
    if (createError) throw createError;
    activeOrder = created as Record<string, unknown>;
  }

  const activeOrderId = String(activeOrder?.id || '') || null;
  const stage = String(activeOrder?.stage || 'catalogue');
  const context = session?.context && typeof session.context === 'object' ? session.context : {};
  const sessionValues = {
    whatsapp_phone: phone,
    user_id: typedProfile.id,
    buyer_store_id: storeId,
    active_order_id: activeOrderId,
    stage,
    context: { ...context, from_raw: fromRaw },
    last_inbound_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (requestedStoreName && !/\b(catalogue|catalog|product|order|custom)\b/i.test(text)) {
    await admin.from('whatsapp_buyer_sessions').upsert(sessionValues);
    await admin.from('whatsapp_buyer_messages').update({ processing_status: 'processed', bespoke_order_id: activeOrderId }).eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(fromRaw, `Store saved. Reply CATALOGUE to begin a custom order.\n\n${menu()}`, activeOrderId, typedProfile.id);
    return { handled: true };
  }

  if (/^(hi|hello|hey|menu|start)$/i.test(text)) {
    await admin.from('whatsapp_buyer_sessions').upsert(sessionValues);
    await admin.from('whatsapp_buyer_messages').update({ processing_status: 'processed', bespoke_order_id: activeOrderId }).eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(fromRaw, menu(), activeOrderId, typedProfile.id);
    return { handled: true };
  }

  if (/^status\b/i.test(text)) {
    await admin.from('whatsapp_buyer_sessions').upsert(sessionValues);
    await admin.from('whatsapp_buyer_messages').update({ processing_status: 'processed', bespoke_order_id: activeOrderId }).eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(fromRaw, await orderSummary(activeOrder), activeOrderId, typedProfile.id);
    return { handled: true };
  }

  if (/^(human|help|support|agent)\b/i.test(text)) {
    if (activeOrderId) {
      await admin.from('bespoke_orders').update({
        human_action_required: true,
        human_action_reason: 'customer_service',
        updated_at: new Date().toISOString(),
      }).eq('id', activeOrderId);
    }
    await admin.from('whatsapp_buyer_sessions').upsert({ ...sessionValues, human_handoff_required: true, human_handoff_reason: 'customer_service' });
    await admin.from('whatsapp_buyer_messages').update({ processing_status: 'needs_human', bespoke_order_id: activeOrderId }).eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(fromRaw, 'Customer-service handoff requested. Your digital order context is saved, so you will not need to repeat the details.', activeOrderId, typedProfile.id);
    return { handled: true };
  }

  if (!activeOrderId) {
    await admin.from('whatsapp_buyer_sessions').upsert(sessionValues);
    await admin.from('whatsapp_buyer_messages').update({ processing_status: 'processed' }).eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(fromRaw, menu(), null, typedProfile.id);
    return { handled: true };
  }

  let responseText = '';
  let nextStage = stage;
  let needsHuman = Boolean(activeOrder?.human_action_required);
  let humanReason = activeOrder?.human_action_reason || null;

  if (stage === 'catalogue' || stage === 'product') {
    const productText = text.replace(/^(product|sku)\s*[:\-]?\s*/i, '').trim();
    if (/^(catalogue|catalog)$/i.test(text)) {
      responseText = `Browse the live FabricTrad catalogue here: ${SITE_URL}/marketplace\n\nThen reply PRODUCT: followed by the product name or SKU. You can also continue on ${SITE_URL}/custom-order?order=${activeOrderId}`;
      nextStage = 'product';
    } else if (productText) {
      const safe = productText.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
      const { data: products } = await admin
        .from('seller_products')
        .select('id,name,sku,fabric_name,price_per_unit,unit')
        .eq('status', 'active')
        .eq('approval_status', 'approved')
        .or(`sku.ilike.%${safe}%,name.ilike.%${safe}%`)
        .limit(3);
      if (products?.length === 1) {
        await admin.from('bespoke_orders').update({ product_id: products[0].id, stage: 'reference_image', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
        nextStage = 'reference_image';
        responseText = `Selected: ${products[0].name} (${products[0].sku}).\nNow send a reference image for the design, or reply SKIP if you do not have one.`;
      } else if ((products?.length || 0) > 1) {
        responseText = `I found several matches:\n${products?.map((item, index) => `${index + 1}. ${item.name} — ${item.sku}`).join('\n')}\nReply PRODUCT: exact SKU.`;
      } else {
        responseText = `I could not match that product safely. Browse ${SITE_URL}/marketplace and reply with the exact SKU.`;
      }
    }
  } else if (stage === 'reference_image') {
    const media = imageMedia(message);
    if (media?.id) {
      try {
        const downloaded = await downloadImage(media.id);
        const path = `${typedProfile.id}/whatsapp/${activeOrderId}/${waMessageId}.${extensionFor(downloaded.mime)}`;
        const { error: uploadError } = await admin.storage.from('buyer-reference-images').upload(path, downloaded.buffer, {
          contentType: downloaded.mime,
          cacheControl: '3600',
          upsert: true,
        });
        if (uploadError) throw uploadError;
        await admin.from('bespoke_orders').update({
          reference_image_path: path,
          reference_image_meta: { source: 'whatsapp', wa_message_id: waMessageId, media_id: media.id, mime_type: downloaded.mime },
          stage: 'fabric',
          updated_at: new Date().toISOString(),
        }).eq('id', activeOrderId);
        await admin.from('whatsapp_buyer_messages').update({ media_storage_path: path }).eq('wa_message_id', waMessageId);
        nextStage = 'fabric';
        responseText = 'Reference image saved privately. Now describe your fabric choice, e.g. “FABRIC: navy linen, 180 GSM”.';
      } catch {
        responseText = 'I could not save that image. Please resend a JPG/PNG/WebP image under 10 MB, or reply SKIP.';
      }
    } else if (/^skip\b/i.test(text)) {
      await admin.from('bespoke_orders').update({ stage: 'fabric', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      nextStage = 'fabric';
      responseText = 'No reference image added. Describe your fabric choice, e.g. “FABRIC: navy linen, 180 GSM”.';
    } else {
      responseText = 'Please send the design/reference image now, or reply SKIP.';
    }
  } else if (stage === 'fabric') {
    const value = text.replace(/^fabric\s*[:\-]?\s*/i, '').trim();
    if (value.length < 2) responseText = 'Describe the fabric, colour, GSM/weight or finish you want.';
    else {
      await admin.from('bespoke_orders').update({ fabric_selection: { description: value, source: 'whatsapp' }, stage: 'customization', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      nextStage = 'customization';
      responseText = 'Fabric preference saved. Now send customization details: garment/style, fit, collar/neck, sleeves, pockets, lining, buttons, embroidery placement, initials, etc.';
    }
  } else if (stage === 'customization') {
    const value = text.replace(/^(custom|customization)\s*[:\-]?\s*/i, '').trim();
    if (value.length < 3) responseText = 'Please describe at least one customization detail.';
    else {
      await admin.from('bespoke_orders').update({ customization: { description: value, source: 'whatsapp' }, stage: 'measurement', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      nextStage = 'measurement';
      responseText = 'Customization saved. For measurement, reply PHYSICAL to book an in-person measurement, or SAVED: followed by your existing measurements.';
    }
  } else if (stage === 'measurement') {
    if (/\bphysical\b/i.test(text)) {
      await admin.from('bespoke_orders').update({ measurement: { mode: 'physical', source: 'whatsapp' }, stage: 'appointment', human_action_required: true, human_action_reason: 'physical_measurement', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      nextStage = 'appointment';
      needsHuman = true;
      humanReason = 'physical_measurement';
      responseText = `Physical measurement selected. Reply APPOINTMENT YYYY-MM-DD HH:MM (India time), e.g. APPOINTMENT 2026-09-05 15:00, or book on ${SITE_URL}/custom-order?order=${activeOrderId}#appointment`;
    } else if (/^saved\s*:/i.test(text) || /\b(chest|waist|hip|shoulder|inseam|length)\b/i.test(text)) {
      await admin.from('bespoke_orders').update({ measurement: { mode: 'saved', description: text.replace(/^saved\s*:/i, '').trim(), source: 'whatsapp' }, stage: 'appointment', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      nextStage = 'appointment';
      responseText = `Saved measurements recorded. A design-approval appointment is next. Reply APPOINTMENT YYYY-MM-DD HH:MM (India time), or choose it on ${SITE_URL}/custom-order?order=${activeOrderId}#appointment`;
    } else responseText = 'Reply PHYSICAL for in-person measurement, or SAVED: followed by your measurements.';
  } else if (stage === 'appointment') {
    const requested = parseAppointmentIso(text);
    if (requested) {
      const appointmentType = humanReason === 'physical_measurement' ? 'physical_measurement' : 'design_approval';
      const { data: appointment, error } = await admin.from('bespoke_appointments').insert({
        bespoke_order_id: activeOrderId,
        user_id: typedProfile.id,
        appointment_type: appointmentType,
        requested_at: requested.toISOString(),
        location_type: 'store',
        location_details: { source: 'whatsapp', requested_text: text },
      }).select('id').single();
      if (error) throw error;
      await admin.from('bespoke_orders').update({ human_action_required: true, human_action_reason: appointmentType, updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      await admin.from('bespoke_follow_up_jobs').insert({
        bespoke_order_id: activeOrderId,
        user_id: typedProfile.id,
        whatsapp_phone: fromRaw,
        job_type: 'appointment_reminder',
        due_at: new Date(Math.max(Date.now(), requested.getTime() - 24 * 60 * 60 * 1000)).toISOString(),
        payload: { appointment_id: appointment.id },
      });
      needsHuman = true;
      humanReason = appointmentType;
      responseText = `Appointment requested for ${requested.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}. Staff only need to intervene for the ${appointmentType.replaceAll('_', ' ')} itself. Your full digital brief is already attached.`;
    } else {
      responseText = `Reply APPOINTMENT YYYY-MM-DD HH:MM (India time), or choose a slot on ${SITE_URL}/custom-order?order=${activeOrderId}#appointment`;
    }
  } else if (stage === 'quotation') {
    const quote = Number(activeOrder?.quoted_amount || 0);
    responseText = quote > 0
      ? `Your quotation is ₹${quote.toFixed(2)}. ${Number(activeOrder?.advance_amount || 0) > 0 ? `Advance available: ₹${Number(activeOrder?.advance_amount).toFixed(2)}. ` : ''}Reply ADVANCE or FULL, then pay securely on ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1`
      : 'Your design/measurement details are complete. The quotation is being generated from the approved brief.';
  } else if (stage === 'advance_or_full_payment') {
    if (/\badvance\b/i.test(text) && Number(activeOrder?.advance_amount || 0) > 0) {
      await admin.from('bespoke_orders').update({ payment_choice: 'advance', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      responseText = `Advance selected. Pay securely through FabricTrad Razorpay checkout: ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1&choice=advance`;
    } else if (/\bfull\b/i.test(text)) {
      await admin.from('bespoke_orders').update({ payment_choice: 'full', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      responseText = `Full payment selected. Pay securely through FabricTrad Razorpay checkout: ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1&choice=full`;
    } else responseText = `Reply ${Number(activeOrder?.advance_amount || 0) > 0 ? 'ADVANCE or ' : ''}FULL. Payment is completed only on FabricTrad secure checkout.`;
  } else if (stage === 'stitching') {
    responseText = `Stitching status: ${String(activeOrder?.stitching_status || 'queued').replaceAll('_', ' ')}. You will receive the next update automatically.`;
  } else if (stage === 'embroidery') {
    responseText = `Embroidery status: ${String(activeOrder?.embroidery_status || 'not required').replaceAll('_', ' ')}. You will receive the next update automatically.`;
  } else if (stage === 'trial') {
    responseText = `A physical trial/fitting is required. Book or manage it here: ${SITE_URL}/custom-order?order=${activeOrderId}#appointment`;
  } else if (stage === 'alteration') {
    responseText = `Alteration is a physical handoff. Your fitting notes stay attached to the order. Track the next approval here: ${SITE_URL}/custom-order?order=${activeOrderId}`;
  } else if (stage === 'final_approval') {
    if (/\bapprove(?:d)?\b/i.test(text)) {
      await admin.from('bespoke_orders').update({ stage: 'balance_payment', final_approved_at: new Date().toISOString(), human_action_required: false, human_action_reason: null, updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      nextStage = 'balance_payment';
      needsHuman = false;
      humanReason = null;
      responseText = `Final approval recorded. ${Number(activeOrder?.balance_amount || 0) > 0 ? `Balance due: ₹${Number(activeOrder?.balance_amount).toFixed(2)}. Pay at ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1` : 'No balance is due; delivery/pickup can now be arranged.'}`;
    } else responseText = 'If the finished piece is approved, reply APPROVE. If something needs attention, reply HUMAN with the issue.';
  } else if (stage === 'balance_payment') {
    const balance = Math.max(0, Number(activeOrder?.quoted_amount || 0) - Number(activeOrder?.paid_amount || 0));
    responseText = balance > 0
      ? `Balance due: ₹${balance.toFixed(2)}. Pay securely here: ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1&choice=full`
      : 'Payment is complete. Delivery/pickup is being unlocked.';
  } else if (stage === 'delivery_or_pickup') {
    if (/\bpick\s*up|pickup\b/i.test(text)) {
      await admin.from('bespoke_orders').update({ delivery_mode: 'pickup', delivery_details: { source: 'whatsapp' }, stage: 'review', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      nextStage = 'review';
      responseText = 'Pickup selected. We will send the confirmed pickup instructions automatically. After receiving the order, reply REVIEW 1-5 followed by any comments.';
    } else if (/\bdeliver(?:y)?\b/i.test(text)) {
      await admin.from('bespoke_orders').update({ delivery_mode: 'delivery', delivery_details: { source: 'whatsapp', use_profile_address: true }, stage: 'review', updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      nextStage = 'review';
      responseText = 'Delivery selected using your FabricTrad delivery profile. Shipment updates will be automated. After receiving it, reply REVIEW 1-5 followed by comments.';
    } else responseText = 'Reply DELIVERY to use your FabricTrad address or PICKUP to collect the finished order.';
  } else if (stage === 'review') {
    const match = text.match(/(?:review\s*)?([1-5])(?:\s*[-:]?\s*(.*))?/i);
    if (match) {
      const rating = Number(match[1]);
      const review = String(match[2] || '').trim().slice(0, 2000) || null;
      const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from('bespoke_orders').update({ review_rating: rating, review_text: review, stage: 'follow_up', follow_up_due_at: dueAt, updated_at: new Date().toISOString() }).eq('id', activeOrderId);
      await admin.from('bespoke_follow_up_jobs').insert({ bespoke_order_id: activeOrderId, user_id: typedProfile.id, whatsapp_phone: fromRaw, job_type: 'post_delivery_follow_up', due_at: dueAt, payload: { review_rating: rating } });
      nextStage = 'follow_up';
      responseText = `Thank you — ${rating}/5 review saved. FabricTrad will follow up automatically in about a week, and you can reply HUMAN anytime if you need service.`;
    } else responseText = 'Reply REVIEW 1-5 followed by optional comments, e.g. REVIEW 5 Perfect fit.';
  } else if (stage === 'follow_up') {
    responseText = 'Your order is in automated follow-up. Reply NEW ORDER anytime to start another, or HUMAN for customer service.';
  } else if (stage === 'completed') {
    responseText = 'This custom order is complete. Reply NEW ORDER to start another.';
  } else {
    responseText = await orderSummary(activeOrder);
  }

  await admin.from('whatsapp_buyer_sessions').upsert({
    ...sessionValues,
    active_order_id: activeOrderId,
    stage: nextStage,
    human_handoff_required: needsHuman,
    human_handoff_reason: humanReason,
    last_outbound_at: new Date().toISOString(),
  });
  await admin.from('whatsapp_buyer_messages').update({
    processing_status: needsHuman ? 'needs_human' : 'processed',
    bespoke_order_id: activeOrderId,
  }).eq('wa_message_id', waMessageId);
  await sendBuyerWhatsAppText(fromRaw, responseText || menu(), activeOrderId, typedProfile.id);
  return { handled: true };
}
