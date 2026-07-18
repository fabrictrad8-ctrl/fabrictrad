import { readFileSync, writeFileSync } from 'node:fs';

const workerPath = '.open-next/worker.js';
const marker = 'globalThis.__fabrictradRequireShim';

let worker = readFileSync(workerPath, 'utf8');

if (!worker.includes(marker)) {
  const shim = `import * as nodeAsyncHooks from "node:async_hooks";
import * as nodeCrypto from "node:crypto";

const __fabrictradRequireModules = {
  async_hooks: nodeAsyncHooks,
  "node:async_hooks": nodeAsyncHooks,
  crypto: nodeCrypto,
  "node:crypto": nodeCrypto,
};

globalThis.__fabrictradRequireShim = function requireShim(specifier) {
  const resolved = __fabrictradRequireModules[specifier];
  if (resolved) {
    return resolved;
  }
  throw new Error(\`Unsupported dynamic require: \${specifier}\`);
};

if (typeof globalThis.require !== "function") {
  Object.defineProperty(globalThis, "require", {
    value: globalThis.__fabrictradRequireShim,
    configurable: true,
  });
}

`;

  worker = `${shim}${worker}`;
  writeFileSync(workerPath, worker);
}
