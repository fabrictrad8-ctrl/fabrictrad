import assert from 'node:assert/strict';

const endpoint = 'https://fabrictrad.com/api/ai/drape-on';
const status = await fetch(endpoint, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
assert.equal(status.status, 200, 'Drape status endpoint is unavailable');
const readiness = await status.json();
assert.equal(readiness.mode, 'real_ai_image_try_on');
assert.equal(readiness.usesListingMedia, true);
console.log(JSON.stringify({ check: 'configuration', configured: readiness.configured, mode: readiness.mode, generationVerified: false }));

// A demo role must never authorize a paid generation. This probe must stop at auth.
const unauthorized = await fetch(endpoint, {
  method: 'POST', signal: AbortSignal.timeout(30000),
  headers: { 'Content-Type': 'application/json', Cookie: 'fabrictrad_demo_role=buyer' },
  body: JSON.stringify({ subjectMode: 'ai_model' }),
});
assert.equal(unauthorized.status, 401, 'Unauthenticated drape generation must be rejected');
console.log('Authentication boundary verified; no provider generation requested.');

if (process.env.RUN_PAID_DRAPE_GENERATION === 'true') {
  const cookie = process.env.DRAPE_TEST_BUYER_COOKIE?.trim();
  const productId = process.env.DRAPE_TEST_PRODUCT_ID?.trim();
  assert.ok(cookie && !/[\r\n]/.test(cookie), 'Configure a valid authenticated test buyer session in DRAPE_TEST_BUYER_COOKIE');
  assert.match(productId || '', /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i, 'Choose a current approved listing ID');
  // Use a generated adult model: no personal photograph is transmitted by CI.
  const generated = await fetch(endpoint, {
    method: 'POST', signal: AbortSignal.timeout(300000),
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ productId, subjectMode: 'ai_model', modelGender: 'woman', garmentId: 'shirt', fit: 'regular' }),
  });
  const result = await generated.json();
  assert.equal(generated.status, 200, `Generation failed: HTTP ${generated.status}; code ${String(result.code || 'unspecified')}`);
  assert.match(result.image || '', /^data:image\//);
  const bytes = Buffer.from(result.image.split(',')[1] || '', 'base64').length;
  assert.ok(bytes > 20000, 'Provider returned an incomplete image');
  console.log(JSON.stringify({ check: 'authenticated_listing_generation', generationVerified: true, provider: result.provider, imageBytes: bytes }));
}
