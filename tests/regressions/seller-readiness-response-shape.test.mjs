import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const route = readFileSync(
  new URL('../../src/app/api/seller/verification-status/route.ts', import.meta.url),
  'utf8'
);
const readiness = readFileSync(
  new URL('../../src/app/seller-dashboard/components/SellerProfileReadiness.tsx', import.meta.url),
  'utf8'
);

assert.match(
  readiness,
  /payload\.status/,
  'Seller readiness UI expects the API response to expose a status object.'
);
assert.match(
  route,
  /status:\s*readinessRecord/,
  'Seller verification API must expose the readiness RPC result under status.'
);
assert.match(
  route,
  /\.\.\.readinessRecord/,
  'Seller verification API must preserve the existing flat response for registration consumers.'
);

console.log('Seller readiness response contract regression passed.');
