import { readFileSync, writeFileSync } from 'node:fs';

const workerPath = '.open-next/worker.js';
const marker = 'globalThis.__fabrictradRequireShim';

let worker = readFileSync(workerPath, 'utf8');

if (!worker.includes(marker)) {
  const shim = `import * as nodeAsyncHooks from "node:async_hooks";
import * as nodeAssert from "node:assert";
import * as nodeBuffer from "node:buffer";
import * as nodeCrypto from "node:crypto";
import * as nodeEvents from "node:events";
import * as nodeFs from "node:fs";
import * as nodeFsPromises from "node:fs/promises";
import * as nodeHttp from "node:http";
import * as nodeHttp2 from "node:http2";
import * as nodeHttps from "node:https";
import * as nodeNet from "node:net";
import * as nodeOs from "node:os";
import * as nodePath from "node:path";
import * as nodeStream from "node:stream";
import * as nodeStreamWeb from "node:stream/web";
import * as nodeTls from "node:tls";
import * as nodeTty from "node:tty";
import * as nodeUrl from "node:url";
import * as nodeUtil from "node:util";
import * as nodeVm from "node:vm";
import * as nodeZlib from "node:zlib";

const __fabrictradRequireModules = {
  "@builder.io/partytown/integration": {},
  assert: nodeAssert,
  async_hooks: nodeAsyncHooks,
  "node:async_hooks": nodeAsyncHooks,
  buffer: nodeBuffer,
  crypto: nodeCrypto,
  "node:crypto": nodeCrypto,
  events: nodeEvents,
  fs: nodeFs,
  "fs/promises": nodeFsPromises,
  http: nodeHttp,
  http2: nodeHttp2,
  https: nodeHttps,
  net: nodeNet,
  os: nodeOs,
  path: nodePath,
  "node:path": nodePath,
  stream: nodeStream,
  "node:stream": nodeStream,
  "node:stream/web": nodeStreamWeb,
  tls: nodeTls,
  tty: nodeTty,
  url: nodeUrl,
  util: nodeUtil,
  vm: nodeVm,
  zlib: nodeZlib,
  "node:zlib": nodeZlib,
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
