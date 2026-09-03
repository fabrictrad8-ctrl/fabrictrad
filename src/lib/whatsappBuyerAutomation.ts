import { createAdminClient } from '@/lib/supabase/admin';
import { downloadGupshupMedia, sendGupshupText } from '@/lib/gupshupWhatsApp';
import { storeKey, storeSuggestionSeeds, validateStoreName } from '@/lib/buyerStores';

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

type AppointmentType = 'physical_measurement' | 'design_approval' | 'trial_fitting' | 'alteration';

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

export async function sendBuyerWhatsAppText(
  toRaw: string,
  text: string,
  orderId?: string | null,
  userId?: string | null
) {
  const result = await sendGupshupText(toRaw, text.slice(0, 4000), true);
  const outboundId = String(result.messageId || '').trim();
  if (outboundId) {
    const admin = createAdminClient();
    await admin
      .from('whatsapp_buyer_messages')
      .insert({
        wa_message_id: outboundId,
        whatsapp_phone: normalizePhone(toRaw) || toRaw.replace(/\D/g, '').slice(-15),
        user_id: userId || null,
        bespoke_order_id: orderId || null,
        direction: 'outbound',
        message_type: 'text',
        message_text: text.slice(0, 12_000),
        processing_status: 'processed',
      })
      .then(() => undefined, () => undefined);
  }
  return { sent: true, id: outboundId } as const;
}

async function downloadImage(mediaUrl: string) {
  const downloaded = await downloadGupshupMedia(mediaUrl, MAX_MEDIA_BYTES);
  if (!downloaded.mime.startsWith('image/')) throw new Error('reference_image_required');
  return downloaded;
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
    input.admin
      .from('buyer_stores')
      .select('id')
      .eq('user_id', input.profile.id)
      .eq('is_primary', true)
      .maybeSingle(),
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
      return {
        ok: false as const,
        message: 'That store name was just claimed by another account. Reply with another STORE: name.',
      };
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
    order.human_action_required
      ? `Human action: ${String(order.human_action_reason || 'required').replaceAll('_', ' ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function createAppointment(input: {
  admin: ReturnType<typeof createAdminClient>;
  orderId: string;
  userId: string;
  whatsappPhone: string;
  requested: Date;
  appointmentType: AppointmentType;
  requestedText: string;
}) {
  const { data: existing } = await input.admin
    .from('bespoke_appointments')
    .select('id,requested_at,status')
    .eq('bespoke_order_id', input.orderId)
    .eq('appointment_type', input.appointmentType)
    .in('status', ['requested', 'confirmed', 'reschedule_requested'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    return { id: existing.id, requestedAt: new Date(existing.requested_at), reused: true };
  }

  const { data: appointment, error } = await input.admin
    .from('bespoke_appointments')
    .insert({
      bespoke_order_id: input.orderId,
      user_id: input.userId,
      appointment_type: input.appointmentType,
      requested_at: input.requested.toISOString(),
      location_type: 'store',
      location_details: { source: 'whatsapp', requested_text: input.requestedText },
    })
    .select('id,requested_at')
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: racedAppointment } = await input.admin
        .from('bespoke_appointments')
        .select('id,requested_at')
        .eq('bespoke_order_id', input.orderId)
        .eq('appointment_type', input.appointmentType)
        .in('status', ['requested', 'confirmed', 'reschedule_requested'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (racedAppointment?.id) {
        return {
          id: racedAppointment.id,
          requestedAt: new Date(racedAppointment.requested_at),
          reused: true,
        };
      }
    }
    throw error;
  }

  await input.admin.from('bespoke_follow_up_jobs').insert({
    bespoke_order_id: input.orderId,
    user_id: input.userId,
    whatsapp_phone: input.whatsappPhone,
    job_type: 'appointment_reminder',
    due_at: new Date(
      Math.max(Date.now(), input.requested.getTime() - 24 * 60 * 60 * 1000)
    ).toISOString(),
    payload: { appointment_id: appointment.id, appointment_type: input.appointmentType },
  });
  return { id: appointment.id, requestedAt: new Date(appointment.requested_at), reused: false };
}

const appointmentTypeForStage = (
  stage: string,
  humanReason: unknown
): AppointmentType => {
  if (stage === 'trial') return 'trial_fitting';
  if (stage === 'alteration') return 'alteration';
  return humanReason === 'physical_measurement' ? 'physical_measurement' : 'design_approval';
};

export async function handleBuyerWhatsAppMessage(
  message: MetaMessage
): Promise<{ handled: boolean }> {
  const waMessageId = String(message.id || '').trim();
  const fromRaw = String(message.from || '').replace(/\D/g, '');
  const phone = normalizePhone(fromRaw);
  if (!waMessageId || !phone) return { handled: false };

  const admin = createAdminClient();
  const rawText = messageText(message).slice(0, 12_000);
  const menuChoice = rawText.trim();
  const naturalCommand =
    /\bstatus\b.*\bcustom\s+order\b/i.test(menuChoice)
      ? 'STATUS'
      : /\b(?:start|place|create|make)\b.*\bcustom\s+order\b/i.test(menuChoice)
        ? 'CATALOGUE'
        : /^hi(?:\s+fabrictrad)?[\s!,.]*$/i.test(menuChoice)
          ? 'HI'
          : menuChoice;
  const text =
    menuChoice === '1'
      ? 'CATALOGUE'
      : menuChoice === '2'
        ? '__STORE_MENU__'
        : menuChoice === '3'
          ? 'STATUS'
          : menuChoice === '4'
            ? 'HUMAN'
            : naturalCommand;
  const { data: already } = await admin
    .from('whatsapp_buyer_messages')
    .select('id,processing_status')
    .eq('wa_message_id', waMessageId)
    .maybeSingle();
  if (already?.id) return { handled: true };

  const [{ data: matchingProfiles }, { data: session }] = await Promise.all([
    admin
      .from('user_profiles')
      .select('id,is_active,can_buy,can_sell,full_name')
      .like('phone', `%${phone}`)
      .eq('is_active', true)
      .limit(2),
    admin.from('whatsapp_buyer_sessions').select('*').eq('whatsapp_phone', phone).maybeSingle(),
  ]);
  const ambiguousPhoneIdentity = (matchingProfiles?.length || 0) > 1;
  const typedProfile = (
    matchingProfiles?.length === 1 ? matchingProfiles[0] : null
  ) as UserProfile | null;

  if (/^(sell|seller|upload product|catalog upload)\b/i.test(text) && typedProfile?.can_sell === true) {
    if (session) await admin.from('whatsapp_buyer_sessions').delete().eq('whatsapp_phone', phone);
    return { handled: false };
  }

  const explicitBuyerIntent =
    text === '__STORE_MENU__' ||
    /^(?:hi|hello|hey|menu|start|buy|new(?:\s+order)?|order|custom(?:\s+order)?|stitch|tailor|catalogue|catalog|product|sku|measurement|appointment|store\s*(?:name)?\s*[:=]|status|human|help|support|agent)\b/i.test(
      text
    );
  // A dual-role account without an active buyer conversation defaults to the
  // long-standing seller catalogue ingestion path. Buyer mode is entered by a
  // clear buyer/menu command, and remains active until SELL explicitly exits.
  if (!session && typedProfile?.can_sell === true && !explicitBuyerIntent) {
    return { handled: false };
  }

  const { error: messageInsertError } = await admin.from('whatsapp_buyer_messages').insert({
    wa_message_id: waMessageId,
    whatsapp_phone: phone,
    user_id: typedProfile?.id || null,
    bespoke_order_id: session?.active_order_id || null,
    direction: 'inbound',
    message_type: message.type || 'unknown',
    message_text: rawText || null,
    media_id: imageMedia(message)?.id || null,
    processing_status: 'received',
  });
  if (messageInsertError) {
    if (messageInsertError.code === '23505') return { handled: true };
    throw messageInsertError;
  }

  if (ambiguousPhoneIdentity) {
    await admin
      .from('whatsapp_buyer_messages')
      .update({
        processing_status: 'needs_human',
        error_message: 'ambiguous_active_phone_identity',
      })
      .eq('wa_message_id', waMessageId);
    await admin.from('whatsapp_buyer_sessions').upsert({
      whatsapp_phone: phone,
      user_id: null,
      stage: session?.stage || 'catalogue',
      context: { from_raw: fromRaw },
      human_handoff_required: true,
      human_handoff_reason: 'ambiguous_active_phone_identity',
      last_inbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await sendBuyerWhatsAppText(
      fromRaw,
      'This mobile number is linked to more than one active FabricTrad account, so automation has stopped safely. Customer service has been flagged to resolve the account identity before any order details are changed.'
    );
    return { handled: true };
  }

  const statedStoreName = extractStoreName(text);
  const deferredStoreName = String(
    (session?.context as Record<string, unknown> | null)?.requested_store_name || ''
  ).trim();
  const requestedStoreName =
    statedStoreName || (typedProfile?.can_buy !== false ? deferredStoreName : '');
  if (!typedProfile || typedProfile.can_buy === false) {
    const context = {
      ...(session?.context && typeof session.context === 'object' ? session.context : {}),
      requested_store_name:
        statedStoreName ||
        (session?.context as Record<string, unknown> | null)?.requested_store_name ||
        null,
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
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'processed' })
      .eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(
      fromRaw,
      `${statedStoreName ? `I saved “${statedStoreName}” as your requested store name.\n\n` : ''}To attach WhatsApp orders securely, sign in or create a FabricTrad buyer account with this same mobile number (${phone}).\n${SITE_URL}/buyer-registration?type=retail_store\n\nAfter that, send HI here again and I will continue automatically.`,
      null,
      typedProfile?.id || null
    );
    return { handled: true };
  }

  if (text === '__STORE_MENU__') {
    await admin.from('whatsapp_buyer_sessions').upsert({
      whatsapp_phone: phone,
      user_id: typedProfile.id,
      buyer_store_id: session?.buyer_store_id || null,
      active_order_id: session?.active_order_id || null,
      stage: session?.stage || 'catalogue',
      context: {
        ...(session?.context && typeof session.context === 'object' ? session.context : {}),
        from_raw: fromRaw,
      },
      last_inbound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'processed' })
      .eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(
      fromRaw,
      'Reply STORE: followed by your preferred unique store name, for example STORE: Mehta Textiles. I will check availability and suggest close alternatives if it is taken.',
      session?.active_order_id || null,
      typedProfile.id
    );
    return { handled: true };
  }

  let storeId: string | null = session?.buyer_store_id || null;
  if (requestedStoreName) {
    const storeResult = await attachStoreName({
      admin,
      profile: typedProfile,
      phone,
      requestedName: requestedStoreName,
    });
    if (!storeResult.ok) {
      await admin
        .from('whatsapp_buyer_messages')
        .update({ processing_status: 'processed' })
        .eq('wa_message_id', waMessageId);
      await sendBuyerWhatsAppText(
        fromRaw,
        storeResult.message,
        session?.active_order_id || null,
        typedProfile.id
      );
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

  const startsNewOrder = /^(new|new order|start over)$/i.test(text);
  const opensCatalogue = /^(catalogue|catalog)$/i.test(text);
  const informationalCommand = /^(hi|hello|hey|menu|start|status|human|help|support|agent)$/i.test(text);
  if (startsNewOrder || (!activeOrder && !requestedStoreName && !informationalCommand)) {
    const { data: buyer } = await admin
      .from('buyer_profiles')
      .select('id')
      .eq('user_id', typedProfile.id)
      .maybeSingle();
    if (!buyer?.id) {
      await sendBuyerWhatsAppText(
        fromRaw,
        `Your buyer profile is still being prepared. Complete it here: ${SITE_URL}/buyer-registration?resume=1`,
        null,
        typedProfile.id
      );
      await admin
        .from('whatsapp_buyer_messages')
        .update({ processing_status: 'processed' })
        .eq('wa_message_id', waMessageId);
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
  const context =
    session?.context && typeof session.context === 'object'
      ? { ...(session.context as Record<string, unknown>) }
      : {};
  if (storeId && requestedStoreName) delete context.requested_store_name;
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
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'processed', bespoke_order_id: activeOrderId })
      .eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(
      fromRaw,
      `Store saved. Reply CATALOGUE to begin a custom order.\n\n${menu()}`,
      activeOrderId,
      typedProfile.id
    );
    return { handled: true };
  }

  if (/^(hi|hello|hey|menu|start)$/i.test(text)) {
    await admin.from('whatsapp_buyer_sessions').upsert(sessionValues);
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'processed', bespoke_order_id: activeOrderId })
      .eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(fromRaw, menu(), activeOrderId, typedProfile.id);
    return { handled: true };
  }

  if (/^status\b/i.test(text)) {
    await admin.from('whatsapp_buyer_sessions').upsert(sessionValues);
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'processed', bespoke_order_id: activeOrderId })
      .eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(
      fromRaw,
      await orderSummary(activeOrder),
      activeOrderId,
      typedProfile.id
    );
    return { handled: true };
  }

  if (/^(human|help|support|agent)\b/i.test(text)) {
    if (activeOrderId) {
      await admin
        .from('bespoke_orders')
        .update({
          human_action_required: true,
          human_action_reason: 'customer_service',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
    }
    await admin.from('whatsapp_buyer_sessions').upsert({
      ...sessionValues,
      human_handoff_required: true,
      human_handoff_reason: 'customer_service',
    });
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'needs_human', bespoke_order_id: activeOrderId })
      .eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(
      fromRaw,
      'Customer-service handoff requested. Your digital order context is saved, so you will not need to repeat the details.',
      activeOrderId,
      typedProfile.id
    );
    return { handled: true };
  }

  if (!activeOrderId) {
    await admin.from('whatsapp_buyer_sessions').upsert(sessionValues);
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'processed' })
      .eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(fromRaw, menu(), null, typedProfile.id);
    return { handled: true };
  }

  if (opensCatalogue && !['catalogue', 'product'].includes(stage)) {
    await admin.from('whatsapp_buyer_sessions').upsert(sessionValues);
    await admin
      .from('whatsapp_buyer_messages')
      .update({ processing_status: 'processed', bespoke_order_id: activeOrderId })
      .eq('wa_message_id', waMessageId);
    await sendBuyerWhatsAppText(
      fromRaw,
      `Browse the live catalogue without losing your active custom order: ${SITE_URL}/marketplace\n\n${await orderSummary(activeOrder)}\n\nReply NEW ORDER only if you want to start a separate custom order.`,
      activeOrderId,
      typedProfile.id
    );
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
      const safe = productText
        .replace(/[%_,()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
      const { data: products } = await admin
        .from('seller_products')
        .select('id,name,sku,fabric_name,price_per_unit,unit')
        .eq('status', 'active')
        .eq('approval_status', 'approved')
        .or(`sku.ilike.%${safe}%,name.ilike.%${safe}%`)
        .limit(3);
      if (products?.length === 1) {
        await admin
          .from('bespoke_orders')
          .update({
            product_id: products[0].id,
            stage: 'reference_image',
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeOrderId);
        nextStage = 'reference_image';
        responseText = `Selected: ${products[0].name} (${products[0].sku}).\nNow send a reference image for the design, or reply SKIP if you do not have one.`;
      } else if ((products?.length || 0) > 1) {
        responseText = `I found several matches:\n${products
          ?.map((item, index) => `${index + 1}. ${item.name} — ${item.sku}`)
          .join('\n')}\nReply PRODUCT: exact SKU.`;
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
        const { error: uploadError } = await admin.storage
          .from('buyer-reference-images')
          .upload(path, downloaded.buffer, {
            contentType: downloaded.mime,
            cacheControl: '3600',
            upsert: true,
          });
        if (uploadError) throw uploadError;
        await admin
          .from('bespoke_orders')
          .update({
            reference_image_path: path,
            reference_image_meta: {
              source: 'whatsapp',
              wa_message_id: waMessageId,
              media_id: media.id,
              mime_type: downloaded.mime,
            },
            stage: 'fabric',
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeOrderId);
        await admin
          .from('whatsapp_buyer_messages')
          .update({ media_storage_path: path })
          .eq('wa_message_id', waMessageId);
        nextStage = 'fabric';
        responseText =
          'Reference image saved privately. Now describe your fabric choice, e.g. “FABRIC: navy linen, 180 GSM”.';
      } catch {
        responseText =
          'I could not save that image. Please resend a JPG/PNG/WebP image under 10 MB, or reply SKIP.';
      }
    } else if (/^skip\b/i.test(text)) {
      await admin
        .from('bespoke_orders')
        .update({ stage: 'fabric', updated_at: new Date().toISOString() })
        .eq('id', activeOrderId);
      nextStage = 'fabric';
      responseText =
        'No reference image added. Describe your fabric choice, e.g. “FABRIC: navy linen, 180 GSM”.';
    } else {
      responseText = 'Please send the design/reference image now, or reply SKIP.';
    }
  } else if (stage === 'fabric') {
    const value = text.replace(/^fabric\s*[:\-]?\s*/i, '').trim();
    if (value.length < 2) {
      responseText = 'Describe the fabric, colour, GSM/weight or finish you want.';
    } else {
      await admin
        .from('bespoke_orders')
        .update({
          fabric_selection: { description: value, source: 'whatsapp' },
          stage: 'customization',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      nextStage = 'customization';
      responseText =
        'Fabric preference saved. Now send customization details: garment/style, fit, collar/neck, sleeves, pockets, lining, buttons, embroidery placement, initials, etc.';
    }
  } else if (stage === 'customization') {
    const value = text.replace(/^(custom|customization)\s*[:\-]?\s*/i, '').trim();
    if (value.length < 3) {
      responseText = 'Please describe at least one customization detail.';
    } else {
      await admin
        .from('bespoke_orders')
        .update({
          customization: { description: value, source: 'whatsapp' },
          stage: 'measurement',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      nextStage = 'measurement';
      responseText =
        'Customization saved. For measurement, reply PHYSICAL to book an in-person measurement, or SAVED: followed by your existing measurements.';
    }
  } else if (stage === 'measurement') {
    if (/\bphysical\b/i.test(text)) {
      await admin
        .from('bespoke_orders')
        .update({
          measurement: { mode: 'physical', source: 'whatsapp' },
          stage: 'appointment',
          human_action_required: true,
          human_action_reason: 'physical_measurement',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      nextStage = 'appointment';
      needsHuman = true;
      humanReason = 'physical_measurement';
      responseText = `Physical measurement selected. Reply APPOINTMENT YYYY-MM-DD HH:MM (India time), e.g. APPOINTMENT 2026-09-05 15:00, or book on ${SITE_URL}/custom-order?order=${activeOrderId}#appointment`;
    } else if (
      /^saved\s*:/i.test(text) ||
      /\b(chest|waist|hip|shoulder|inseam|length)\b/i.test(text)
    ) {
      await admin
        .from('bespoke_orders')
        .update({
          measurement: {
            mode: 'saved',
            description: text.replace(/^saved\s*:/i, '').trim(),
            source: 'whatsapp',
          },
          stage: 'appointment',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      nextStage = 'appointment';
      responseText = `Saved measurements recorded. A design-approval appointment is next. Reply APPOINTMENT YYYY-MM-DD HH:MM (India time), or choose it on ${SITE_URL}/custom-order?order=${activeOrderId}#appointment`;
    } else {
      responseText = 'Reply PHYSICAL for in-person measurement, or SAVED: followed by your measurements.';
    }
  } else if (stage === 'appointment' || stage === 'trial' || stage === 'alteration') {
    const requested = parseAppointmentIso(text);
    const appointmentType = appointmentTypeForStage(stage, humanReason);
    if (requested) {
      const appointment = await createAppointment({
        admin,
        orderId: activeOrderId,
        userId: typedProfile.id,
        whatsappPhone: fromRaw,
        requested,
        appointmentType,
        requestedText: text,
      });
      await admin
        .from('bespoke_orders')
        .update({
          human_action_required: true,
          human_action_reason: appointmentType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      needsHuman = true;
      humanReason = appointmentType;
      responseText = `${appointment.reused ? 'Existing' : 'New'} ${appointmentType.replaceAll('_', ' ')} appointment ${appointment.reused ? 'kept for' : 'requested for'} ${appointment.requestedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}. Your full digital order brief is attached for staff.`;
    } else {
      const label = appointmentType.replaceAll('_', ' ');
      responseText = `A ${label} appointment is required. Reply APPOINTMENT YYYY-MM-DD HH:MM (India time), e.g. APPOINTMENT 2026-09-05 15:00, or manage it on ${SITE_URL}/custom-order?order=${activeOrderId}#appointment`;
    }
  } else if (stage === 'quotation') {
    const quote = Number(activeOrder?.quoted_amount || 0);
    responseText =
      quote > 0
        ? `Your quotation is ₹${quote.toFixed(2)}. ${Number(activeOrder?.advance_amount || 0) > 0 ? `Advance available: ₹${Number(activeOrder?.advance_amount).toFixed(2)}. ` : ''}Reply ADVANCE or FULL, then pay securely on ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1`
        : 'Your design/measurement details are complete. The quotation is being generated from the approved brief.';
  } else if (stage === 'advance_or_full_payment') {
    if (/^advance$/i.test(text.trim()) && Number(activeOrder?.advance_amount || 0) > 0) {
      await admin
        .from('bespoke_orders')
        .update({ payment_choice: 'advance', updated_at: new Date().toISOString() })
        .eq('id', activeOrderId);
      responseText = `Advance selected. Pay securely through FabricTrad Razorpay checkout: ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1&choice=advance`;
    } else if (/^(?:full|pay full)$/i.test(text.trim())) {
      await admin
        .from('bespoke_orders')
        .update({ payment_choice: 'full', updated_at: new Date().toISOString() })
        .eq('id', activeOrderId);
      responseText = `Full payment selected. Pay securely through FabricTrad Razorpay checkout: ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1&choice=full`;
    } else {
      responseText = `Reply ${Number(activeOrder?.advance_amount || 0) > 0 ? 'ADVANCE or ' : ''}FULL. Payment is completed only on FabricTrad secure checkout.`;
    }
  } else if (stage === 'stitching') {
    responseText = `Stitching status: ${String(activeOrder?.stitching_status || 'queued').replaceAll('_', ' ')}. You will receive the next update automatically.`;
  } else if (stage === 'embroidery') {
    responseText = `Embroidery status: ${String(activeOrder?.embroidery_status || 'not required').replaceAll('_', ' ')}. You will receive the next update automatically.`;
  } else if (stage === 'final_approval') {
    if (/^(?:approve|approved|final approve)$/i.test(text.trim())) {
      const quote = Math.max(0, Number(activeOrder?.quoted_amount || 0));
      const paid = Math.max(0, Number(activeOrder?.paid_amount || 0));
      const balance = Math.max(0, Math.round((quote - paid) * 100) / 100);
      const approvedStage = balance >= 0.01 ? 'balance_payment' : 'delivery_or_pickup';
      await admin
        .from('bespoke_orders')
        .update({
          stage: approvedStage,
          balance_amount: balance,
          final_approved_at: new Date().toISOString(),
          human_action_required: false,
          human_action_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      nextStage = approvedStage;
      needsHuman = false;
      humanReason = null;
      responseText =
        balance >= 0.01
          ? `Final approval recorded. Balance due: ₹${balance.toFixed(2)}. Pay securely at ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1`
          : 'Final approval recorded. Payment is complete, so reply DELIVERY or PICKUP to choose the fulfilment method.';
    } else {
      responseText =
        'If the finished piece is approved, reply APPROVE. If something needs attention, reply HUMAN with the issue.';
    }
  } else if (stage === 'balance_payment') {
    const balance = Math.max(
      0,
      Number(activeOrder?.quoted_amount || 0) - Number(activeOrder?.paid_amount || 0)
    );
    responseText =
      balance > 0
        ? `Balance due: ₹${balance.toFixed(2)}. Pay securely here: ${SITE_URL}/custom-order?order=${activeOrderId}&pay=1&choice=full`
        : 'Payment is complete. Delivery/pickup is being unlocked.';
  } else if (stage === 'delivery_or_pickup') {
    if (/^(?:pick\s*up|pickup)$/i.test(text.trim())) {
      await admin
        .from('bespoke_orders')
        .update({
          delivery_mode: 'pickup',
          delivery_details: { source: 'whatsapp' },
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      responseText =
        'Pickup preference saved. FabricTrad will send the confirmed pickup instructions. Review unlocks only after staff records the actual handover.';
    } else if (/^(?:deliver|delivery)$/i.test(text.trim())) {
      await admin
        .from('bespoke_orders')
        .update({
          delivery_mode: 'delivery',
          delivery_details: { source: 'whatsapp', use_profile_address: true },
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      responseText =
        'Delivery preference saved using your FabricTrad delivery profile. Shipment updates will be automated, and review unlocks only after confirmed handover.';
    } else {
      responseText = 'Reply DELIVERY to use your FabricTrad address or PICKUP to collect the finished order.';
    }
  } else if (stage === 'review') {
    const match = text.trim().match(/^(?:review\s*)?([1-5])(?:\s*[-:]?\s*(.*))?$/i);
    if (match) {
      const rating = Number(match[1]);
      const review = String(match[2] || '').trim().slice(0, 2000) || null;
      const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await admin
        .from('bespoke_orders')
        .update({
          review_rating: rating,
          review_text: review,
          stage: 'follow_up',
          follow_up_due_at: dueAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrderId);
      await admin.from('bespoke_follow_up_jobs').insert({
        bespoke_order_id: activeOrderId,
        user_id: typedProfile.id,
        whatsapp_phone: fromRaw,
        job_type: 'post_delivery_follow_up',
        due_at: dueAt,
        payload: { review_rating: rating },
      });
      nextStage = 'follow_up';
      responseText = `Thank you — ${rating}/5 review saved. FabricTrad will follow up automatically in about a week, and you can reply HUMAN anytime if you need service.`;
    } else {
      responseText =
        'Reply REVIEW 1-5 followed by optional comments, e.g. REVIEW 5 Perfect fit.';
    }
  } else if (stage === 'follow_up') {
    responseText =
      'Your order is in automated follow-up. Reply NEW ORDER anytime to start another, or HUMAN for customer service.';
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
  await admin
    .from('whatsapp_buyer_messages')
    .update({
      processing_status: needsHuman ? 'needs_human' : 'processed',
      bespoke_order_id: activeOrderId,
    })
    .eq('wa_message_id', waMessageId);
  await sendBuyerWhatsAppText(fromRaw, responseText || menu(), activeOrderId, typedProfile.id);
  return { handled: true };
}
