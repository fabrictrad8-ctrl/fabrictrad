// OpenNext generates this module before Wrangler bundles the worker.
// @ts-ignore -- generated build artifact
import openNextWorker from './.open-next/worker.js';
import { processDueBespokeFollowUps } from './src/lib/bespokeFollowUps';

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};

export default {
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

// Required by OpenNext's queue/cache implementation when those bindings are used.
// @ts-ignore -- generated build artifact
export { DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js';
