import { NextRequest, NextResponse } from 'next/server';
import {
  getMissingShopifyScopes,
  getShopifyAccessToken,
  getShopifyConfiguration,
  ShopifyConfigurationError,
  shopifyGraphql,
} from '@/lib/shopifyAdmin';
import { ensureShopifyWebhookSubscriptions } from '@/lib/shopifyWebhooks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store, max-age=0' };

type ShopStatusData = {
  shop: {
    name: string;
    myshopifyDomain: string;
    currencyCode: string;
    customerAccounts: string;
    primaryDomain: { url: string };
  };
};

export async function GET(request: NextRequest) {
  try {
    const configuration = getShopifyConfiguration();
    const verify = request.nextUrl.searchParams.get('verify') === '1';
    const ensure = request.nextUrl.searchParams.get('ensure') === '1';

    if (!verify && !ensure) {
      return NextResponse.json(
        {
          configured: true,
          authenticated: null,
          shop: configuration.host,
          apiVersion: '2026-07',
        },
        { headers: noStore }
      );
    }

    const token = await getShopifyAccessToken();
    const missingScopes = getMissingShopifyScopes(token.scope);
    const data = await shopifyGraphql<ShopStatusData>(`#graphql
      query FabricTradShopStatus {
        shop {
          name
          myshopifyDomain
          currencyCode
          customerAccounts
          primaryDomain { url }
        }
      }
    `);

    const domainMatches = data.shop.myshopifyDomain.toLowerCase() === configuration.host;
    const webhookStatus = ensure ? await ensureShopifyWebhookSubscriptions() : null;
    const productionReady = domainMatches && missingScopes.length === 0 && (!ensure || webhookStatus?.ready === true);

    return NextResponse.json(
      {
        configured: true,
        authenticated: true,
        productionReady,
        apiVersion: '2026-07',
        shop: data.shop.myshopifyDomain,
        shopName: data.shop.name,
        primaryDomain: data.shop.primaryDomain.url,
        currency: data.shop.currencyCode,
        customerAccounts: data.shop.customerAccounts,
        domainMatches,
        grantedScopes: token.scope,
        missingScopes,
        webhooks: webhookStatus,
      },
      { status: productionReady || !ensure ? 200 : 502, headers: noStore }
    );
  } catch (error) {
    const configured = !(error instanceof ShopifyConfigurationError);
    return NextResponse.json(
      {
        configured,
        authenticated: false,
        productionReady: false,
        error: error instanceof Error ? error.message : 'Shopify authentication failed.',
      },
      { status: configured ? 502 : 503, headers: noStore }
    );
  }
}
