import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getShopifyConfiguration, shopifyGraphql } from '@/lib/shopifyAdmin';

export const SHOPIFY_WEBHOOK_PATH = '/api/shopify/webhook';
export const SHOPIFY_WEBHOOK_URI = `https://fabrictrad.com${SHOPIFY_WEBHOOK_PATH}`;

export const SHOPIFY_WEBHOOK_TOPICS = [
  'ORDERS_CREATE',
  'ORDERS_UPDATED',
  'ORDERS_PAID',
  'ORDERS_CANCELLED',
  'ORDERS_FULFILLED',
  'CUSTOMERS_CREATE',
  'CUSTOMERS_UPDATE',
  'PRODUCTS_UPDATE',
  'PRODUCTS_DELETE',
  'INVENTORY_LEVELS_UPDATE',
] as const;

type ShopifyWebhookTopic = (typeof SHOPIFY_WEBHOOK_TOPICS)[number];

type WebhookSubscriptionNode = {
  id: string;
  topic: string;
  uri: string;
};

type WebhookSubscriptionsResponse = {
  webhookSubscriptions: {
    nodes: WebhookSubscriptionNode[];
  };
};

type WebhookCreateResponse = {
  webhookSubscriptionCreate: {
    webhookSubscription?: WebhookSubscriptionNode | null;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
};

function headerValue(headers: Headers, name: string) {
  return headers.get(name)?.trim() || '';
}

export function verifyShopifyWebhookHmac(rawBody: string, providedHmac: string) {
  if (!providedHmac) return false;
  const { clientSecret } = getShopifyConfiguration();
  const calculated = createHmac('sha256', clientSecret).update(rawBody, 'utf8').digest();

  let supplied: Buffer;
  try {
    supplied = Buffer.from(providedHmac, 'base64');
  } catch {
    return false;
  }

  return supplied.length === calculated.length && timingSafeEqual(supplied, calculated);
}

export function validateShopifyWebhookHeaders(headers: Headers, rawBody: string) {
  const hmac = headerValue(headers, 'x-shopify-hmac-sha256');
  const webhookId = headerValue(headers, 'x-shopify-webhook-id');
  const topic = headerValue(headers, 'x-shopify-topic').toLowerCase();
  const shopDomain = headerValue(headers, 'x-shopify-shop-domain').toLowerCase();
  const eventId = headerValue(headers, 'x-shopify-event-id');
  const { host } = getShopifyConfiguration();

  if (!verifyShopifyWebhookHmac(rawBody, hmac)) {
    return { valid: false as const, status: 401, reason: 'Invalid Shopify webhook signature.' };
  }
  if (!webhookId || !topic || !shopDomain) {
    return { valid: false as const, status: 400, reason: 'Missing Shopify webhook headers.' };
  }
  if (shopDomain !== host) {
    return { valid: false as const, status: 403, reason: 'Webhook shop does not match FabricTrad.' };
  }

  return { valid: true as const, webhookId, topic, shopDomain, eventId };
}

export async function ensureShopifyWebhookSubscriptions() {
  const query = `#graphql
    query FabricTradWebhookSubscriptions {
      webhookSubscriptions(first: 100) {
        nodes { id topic uri }
      }
    }
  `;

  const current = await shopifyGraphql<WebhookSubscriptionsResponse>(query);
  const existing = new Map(
    current.webhookSubscriptions.nodes
      .filter((node) => node.uri === SHOPIFY_WEBHOOK_URI)
      .map((node) => [node.topic, node])
  );

  const createMutation = `#graphql
    mutation FabricTradWebhookCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription { id topic uri }
        userErrors { field message }
      }
    }
  `;

  const created: WebhookSubscriptionNode[] = [];
  const errors: Array<{ topic: ShopifyWebhookTopic; message: string }> = [];

  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    if (existing.has(topic)) continue;
    const result = await shopifyGraphql<WebhookCreateResponse>(createMutation, {
      topic,
      webhookSubscription: { uri: SHOPIFY_WEBHOOK_URI },
    });
    const mutation = result.webhookSubscriptionCreate;
    if (mutation.userErrors.length) {
      for (const error of mutation.userErrors) errors.push({ topic, message: error.message });
    } else if (mutation.webhookSubscription) {
      created.push(mutation.webhookSubscription);
      existing.set(topic, mutation.webhookSubscription);
    }
  }

  return {
    targetUri: SHOPIFY_WEBHOOK_URI,
    desiredCount: SHOPIFY_WEBHOOK_TOPICS.length,
    configuredCount: SHOPIFY_WEBHOOK_TOPICS.filter((topic) => existing.has(topic)).length,
    createdCount: created.length,
    errors,
    ready: errors.length === 0 && SHOPIFY_WEBHOOK_TOPICS.every((topic) => existing.has(topic)),
  };
}

function asString(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function gid(resource: 'Order' | 'Customer' | 'Product', payload: Record<string, any>) {
  const adminGid = asString(payload.admin_graphql_api_id);
  if (adminGid.startsWith(`gid://shopify/${resource}/`)) return adminGid;
  const id = asString(payload.id);
  return id ? `gid://shopify/${resource}/${id}` : '';
}

function customerGid(payload: Record<string, any>) {
  const customer = payload.customer;
  if (!customer || typeof customer !== 'object') return '';
  const adminGid = asString(customer.admin_graphql_api_id);
  if (adminGid.startsWith('gid://shopify/Customer/')) return adminGid;
  const id = asString(customer.id);
  return id ? `gid://shopify/Customer/${id}` : '';
}

async function resolveSupabaseUserId(customerShopifyGid: string, email: string) {
  const admin = createAdminClient();

  if (customerShopifyGid) {
    const { data } = await admin
      .from('shopify_customer_links')
      .select('supabase_user_id')
      .eq('shopify_customer_gid', customerShopifyGid)
      .maybeSingle();
    if (data?.supabase_user_id) return String(data.supabase_user_id);
  }

  if (!email) return null;
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id,email')
    .ilike('email', email)
    .maybeSingle();

  if (!profile?.id) return null;

  if (customerShopifyGid) {
    await admin.from('shopify_customer_links').upsert(
      {
        supabase_user_id: profile.id,
        shopify_customer_gid: customerShopifyGid,
        email: profile.email || email,
        last_synced_at: new Date().toISOString(),
        metadata: { source: 'shopify_webhook' },
      },
      { onConflict: 'supabase_user_id' }
    );
  }

  return String(profile.id);
}

async function processOrderWebhook(topic: string, payload: Record<string, any>) {
  const orderGid = gid('Order', payload);
  if (!orderGid) return;

  const email = asString(payload.email || payload.contact_email).trim().toLowerCase();
  const linkedCustomerGid = customerGid(payload);
  const supabaseUserId = await resolveSupabaseUserId(linkedCustomerGid, email);
  const admin = createAdminClient();

  const metadata = {
    topic,
    customer_gid: linkedCustomerGid || null,
    currency: asString(payload.currency) || null,
    total_price: asString(payload.total_price) || null,
    created_at: asString(payload.created_at) || null,
    updated_at: asString(payload.updated_at) || null,
    payment_gateway_names: Array.isArray(payload.payment_gateway_names)
      ? payload.payment_gateway_names.map(asString).filter(Boolean).slice(0, 8)
      : [],
  };

  const { error } = await admin.from('shopify_order_links').upsert(
    {
      shopify_order_gid: orderGid,
      supabase_user_id: supabaseUserId,
      shopify_order_name: asString(payload.name),
      financial_status: asString(payload.financial_status),
      fulfillment_status: asString(payload.fulfillment_status),
      last_synced_at: new Date().toISOString(),
      metadata,
    },
    { onConflict: 'shopify_order_gid' }
  );
  if (error) throw error;
}

async function processCustomerWebhook(topic: string, payload: Record<string, any>) {
  const customerShopifyGid = gid('Customer', payload);
  if (!customerShopifyGid) return;
  const email = asString(payload.email).trim().toLowerCase();
  const supabaseUserId = await resolveSupabaseUserId(customerShopifyGid, email);
  if (!supabaseUserId) return;

  const admin = createAdminClient();
  const { error } = await admin.from('shopify_customer_links').upsert(
    {
      supabase_user_id: supabaseUserId,
      shopify_customer_gid: customerShopifyGid,
      email: email || null,
      last_synced_at: new Date().toISOString(),
      metadata: {
        source: 'shopify_webhook',
        topic,
        updated_at: asString(payload.updated_at) || null,
      },
    },
    { onConflict: 'supabase_user_id' }
  );
  if (error) throw error;
}

async function processProductWebhook(topic: string, payload: Record<string, any>) {
  const productGid = gid('Product', payload);
  if (!productGid) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from('shopify_product_links')
    .update({
      sync_status: topic === 'products/delete' ? 'archived' : 'synced',
      last_synced_at: new Date().toISOString(),
    })
    .eq('shopify_product_gid', productGid);
  if (error) throw error;
}

async function processInventoryWebhook(payload: Record<string, any>) {
  const inventoryItemId = asString(payload.inventory_item_id);
  if (!inventoryItemId) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from('shopify_product_links')
    .update({ sync_status: 'synced', last_synced_at: new Date().toISOString() })
    .eq('shopify_inventory_item_gid', `gid://shopify/InventoryItem/${inventoryItemId}`);
  if (error) throw error;
}

function minimalAuditPayload(payload: Record<string, any>) {
  return {
    id: payload.id ?? null,
    admin_graphql_api_id: payload.admin_graphql_api_id ?? null,
    name: payload.name ?? null,
    financial_status: payload.financial_status ?? null,
    fulfillment_status: payload.fulfillment_status ?? null,
    product_id: payload.product_id ?? null,
    inventory_item_id: payload.inventory_item_id ?? null,
    available: payload.available ?? null,
    currency: payload.currency ?? null,
    total_price: payload.total_price ?? null,
    created_at: payload.created_at ?? null,
    updated_at: payload.updated_at ?? null,
  };
}

export async function processShopifyWebhook(
  webhookId: string,
  topic: string,
  rawBody: string
) {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from('shopify_webhook_events')
    .select('shopify_webhook_id')
    .eq('shopify_webhook_id', webhookId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { duplicate: true };

  const parsed = JSON.parse(rawBody) as Record<string, any>;

  if (topic.startsWith('orders/')) {
    await processOrderWebhook(topic, parsed);
  } else if (topic.startsWith('customers/')) {
    await processCustomerWebhook(topic, parsed);
  } else if (topic.startsWith('products/')) {
    await processProductWebhook(topic, parsed);
  } else if (topic === 'inventory_levels/update') {
    await processInventoryWebhook(parsed);
  }

  const { error: auditError } = await admin.from('shopify_webhook_events').insert({
    shopify_webhook_id: webhookId,
    topic,
    processed_at: new Date().toISOString(),
    payload: minimalAuditPayload(parsed),
  });

  if (auditError && auditError.code !== '23505') throw auditError;
  return { duplicate: auditError?.code === '23505' };
}
