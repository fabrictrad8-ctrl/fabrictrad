// OpenNext generates this module before Wrangler bundles the worker.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- generated build artifact is absent before OpenNext builds it
import openNextWorker from './.open-next/worker.js';
import { processDueBespokeFollowUps } from './src/lib/bespokeFollowUps';

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

const fabricTradWorker = {
  fetch: openNextWorker.fetch,
  async scheduled(_controller: unknown, _env: unknown, context: ExecutionContextLike) {
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
