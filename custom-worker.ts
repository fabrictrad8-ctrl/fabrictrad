// OpenNext generates this module before Wrangler bundles the worker.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated build artifact is absent before OpenNext builds it
import openNextWorker from './.open-next/worker.js';
import { processDueBespokeFollowUps } from './src/lib/bespokeFollowUps';
import { processSellerWhatsAppQueue } from './src/lib/server/sellerWhatsappQueue';

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

const fabricTradWorker = {
  async fetch(request: Request, env: unknown, context: ExecutionContextLike) {
    const url = new URL(request.url);
    if (url.hostname.toLowerCase() === 'www.fabrictrad.com') {
      url.hostname = 'fabrictrad.com';
      return Response.redirect(url.toString(), 308);
    }

    const response = await openNextWorker.fetch(request, env, context);
    const headers = new Headers(response.headers);
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (url.protocol === 'https:') {
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
  async scheduled(_controller: unknown, _env: unknown, context: ExecutionContextLike) {
    context.waitUntil(processSellerWhatsAppQueue().catch((error) => {
      console.error('Seller WhatsApp retry failed', { message: error instanceof Error ? error.message : 'unknown_error' });
    }));
    context.waitUntil(
      processDueBespokeFollowUps().catch((error) => {
        console.error('FabricTrad bespoke follow-up scheduler failed', {
          message: error instanceof Error ? error.message : 'unknown_error',
        });
      })
    );
  },
};

export default fabricTradWorker;

// Required by OpenNext's queue/cache implementation when those bindings are used.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated build artifact is absent before OpenNext builds it
export { DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js';
