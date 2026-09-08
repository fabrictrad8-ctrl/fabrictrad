import { NextRequest, NextResponse } from 'next/server';
import {
  processShopifyWebhook,
  validateShopifyWebhookHeaders,
} from '@/lib/shopifyWebhooks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read webhook body.' }, { status: 400 });
  }

  let validation: ReturnType<typeof validateShopifyWebhookHeaders>;
  try {
    validation = validateShopifyWebhookHeaders(request.headers, rawBody);
  } catch {
    return NextResponse.json({ error: 'Shopify webhook verification is not configured.' }, { status: 503 });
  }

  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason }, { status: validation.status });
  }

  try {
    const result = await processShopifyWebhook(validation.webhookId, validation.topic, rawBody);
    return NextResponse.json(
      {
        ok: true,
        duplicate: result.duplicate,
        webhookId: validation.webhookId,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Shopify webhook processing failed', {
      webhookId: validation.webhookId,
      topic: validation.topic,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
