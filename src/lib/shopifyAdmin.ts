import 'server-only';

export const SHOPIFY_ADMIN_API_VERSION = '2026-07';

const REQUIRED_SCOPES = [
  'write_products',
  'write_inventory',
  'write_orders',
  'write_customers',
  'read_locations',
  'write_publications',
] as const;

type ShopifyTokenResponse = {
  access_token: string;
  scope?: string;
  expires_in?: number;
};

type CachedToken = {
  accessToken: string;
  scope: string[];
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

export class ShopifyConfigurationError extends Error {
  constructor(message = 'Shopify server integration is not configured.') {
    super(message);
    this.name = 'ShopifyConfigurationError';
  }
}

export class ShopifyApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ShopifyApiError';
    this.status = status;
    this.details = details;
  }
}

export function normalizeShopifyShop(value: string | undefined | null) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const host = raw.endsWith('.myshopify.com') ? raw : `${raw}.myshopify.com`;
  const subdomain = host.replace(/\.myshopify\.com$/, '');

  if (!subdomain || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain)) {
    throw new ShopifyConfigurationError('SHOPIFY_SHOP must be a valid myshopify.com shop subdomain.');
  }

  return { host, subdomain };
}

export function getShopifyConfiguration() {
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  const shop = normalizeShopifyShop(process.env.SHOPIFY_SHOP);

  if (!clientId || !clientSecret) {
    throw new ShopifyConfigurationError(
      'SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET must be configured as server-only secrets.'
    );
  }

  return { clientId, clientSecret, ...shop };
}

async function requestAccessToken(): Promise<CachedToken> {
  const { host, clientId, clientSecret } = getShopifyConfiguration();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`https://${host}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<ShopifyTokenResponse> & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new ShopifyApiError(
      payload.error_description || payload.error || `Shopify token exchange failed (${response.status}).`,
      response.status
    );
  }

  const expiresIn = Math.max(60, Number(payload.expires_in ?? 86_399));
  return {
    accessToken: payload.access_token,
    scope: String(payload.scope ?? '')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean),
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

export async function getShopifyAccessToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken;
  }

  cachedToken = await requestAccessToken();
  return cachedToken;
}

export function clearShopifyAccessTokenCache() {
  cachedToken = null;
}

export function getMissingShopifyScopes(granted: string[]) {
  return REQUIRED_SCOPES.filter((scope) => !granted.includes(scope));
}

export async function shopifyGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  retryOnAuthFailure = true
): Promise<T> {
  const { host } = getShopifyConfiguration();
  const token = await getShopifyAccessToken();

  const response = await fetch(`https://${host}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token.accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });

  if ((response.status === 401 || response.status === 403) && retryOnAuthFailure) {
    clearShopifyAccessTokenCache();
    await getShopifyAccessToken(true);
    return shopifyGraphql<T>(query, variables, false);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    errors?: Array<{ message?: string; extensions?: unknown }>;
  };

  if (!response.ok) {
    throw new ShopifyApiError(`Shopify GraphQL request failed (${response.status}).`, response.status, payload);
  }

  if (payload.errors?.length) {
    throw new ShopifyApiError(
      payload.errors.map((error) => error.message || 'Shopify GraphQL error').join('; '),
      response.status,
      payload.errors
    );
  }

  if (!payload.data) {
    throw new ShopifyApiError('Shopify GraphQL response did not contain data.', response.status, payload);
  }

  return payload.data;
}
