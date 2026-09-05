import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = process.cwd();
const userId = 'dceea640-a2ee-4d65-9b64-dc16ad740001';
const productId = 'dceea640-a2ee-4d65-9b64-dc16ad740002';
const variantId = 'dceea640-a2ee-4d65-9b64-dc16ad740003';
const next = require('next/server');

function fixture(options = {}) {
  const calls = [];
  const records = {
    user_profiles: { role: 'buyer', is_active: true, can_buy: true, can_sell: true, ...options.profile },
    seller_profiles: { id: 'seller', user_id: 'seller-user' },
    seller_products: { id: productId, seller_id: 'seller', name: 'Blue textile', image_url: 'https://images.unsplash.com/example.jpg', ...options.product },
    seller_product_variants: options.variant || null,
    seller_product_media: [],
    seller_tax_invoices: options.invoice || null,
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: userId } } }) },
    from: (table) => {
      const result = { data: records[table] ?? null, error: null };
      const chain = { select() { return this; }, eq() { return this; }, neq() { return this; }, or() { return this; }, update(values) { calls.push({ table, values }); return this; }, order() { return this; }, maybeSingle: async () => result, then: (resolve) => Promise.resolve(result).then(resolve) };
      return chain;
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return options.rpcResult || { data: null, error: { code: 'UNAVAILABLE', message: 'Unavailable' } };
    },
  };
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const testModule = { exports: {} };
    cache.set(filename, testModule.exports);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name === '@/lib/supabase/server') return { createClient: async () => client };
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => client };
      if (name === '@/lib/gupshupWhatsApp') return { sendGupshupText: () => { throw new Error('Unexpected send'); } };
      if (name === '@rocketnew/llm-sdk') return { imageEdit: () => { throw new Error('Unexpected provider generation'); } };
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      return require(name);
    };
    vm.runInNewContext(source, { module: testModule, exports: testModule.exports, require: localRequire,
      Buffer, Blob, File, Request, Response, URL, Headers, TextEncoder, TextDecoder,
      AbortController, AbortSignal, ReadableStream, setTimeout, clearTimeout,
      process: { env: { OPENAI_API_KEY: 'test-only-placeholder', ...options.env } },
      fetch: options.fetch || (async () => { throw new Error('Unexpected network request'); }),
      console: { info() {}, warn() {}, error() {} },
    }, { filename });
    cache.set(filename, testModule.exports);
    return testModule.exports;
  }
  return { load, calls };
}
const request = (body, headers = {}) => new next.NextRequest('https://fabrictrad.test/api/ai/drape-on', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('seller product format preserves multiline fields and validates the full draft', () => {
  const { load } = fixture();
  const mod = load('src/lib/whatsappSellerCatalog.ts');
  const input = 'Name: Blue Cotton\r\nSKU: BLUE-1\r\nCategory: Cotton\r\nPrice: 100\r\nUnit: piece\r\nAvailable: 20\r\nMOQ: 1\r\nSale Channel: both';
  const parsed = mod.parseSellerCatalogFormat(mod.normalizeSellerCatalogText(input));
  assert.equal(parsed.name, 'Blue Cotton'); assert.equal(parsed.price, 100); assert.equal(parsed.available, 20);
  const validation = mod.validateSellerCatalogDraft(parsed);
  assert.equal(validation.errors.length, 0); assert.equal(validation.missing.length, 0);
});

test('webhook rejects missing, short, incorrect and raw authorization tokens', () => {
  const { whatsappWebhookAuthorized: auth } = fixture().load('src/lib/whatsappWebhookAuth.ts');
  const secret = 'a'.repeat(48);
  assert.equal(auth(new Request('https://example.com/callback'), secret), false);
  assert.equal(auth(new Request('https://example.com/callback', { headers: { authorization: 'Bearer ' + secret } }), secret), true);
  assert.equal(auth(new Request('https://example.com/callback', { headers: { authorization: secret } }), secret), false);
  assert.equal(auth(new Request('https://example.com/callback', { headers: { authorization: 'Bearer ' + 'b'.repeat(48) } }), secret), false);
  assert.equal(auth(new Request('https://example.com/callback?webhook_token=' + secret), secret), true);
  assert.equal(auth(new Request('https://example.com/callback?webhook_token=short'), 'short'), false);
});

test('manual shipment requires AWB, HTTPS tracking and a real calendar date', () => {
  const { validateManualShipment: validate, validTrackingUrl } = fixture().load('src/lib/shippingValidation.ts');
  const data = { orderType: 'catalog', orderId: productId, courierName: 'DTDC', awbNumber: 'AWB-123', trackingUrl: 'https://tracking.example.com/123', status: 'in_transit', estimatedDelivery: '2026-09-12' };
  assert.equal(validate(data), null);
  assert.ok(validate({ ...data, awbNumber: '' }));
  assert.ok(validate({ ...data, trackingUrl: '' }));
  assert.ok(validate({ ...data, estimatedDelivery: '2026-02-31' }));
  for (const url of ['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://127.0.0.1/x']) assert.equal(validTrackingUrl(url), false);
});

test('body reader enforces actual streamed byte limits without Content-Length', async () => {
  const { readLimitedBody, BodyLimitError } = fixture().load('src/lib/limitedBody.ts');
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(6)); c.enqueue(new Uint8Array(6)); }, cancel() { cancelled = true; } });
  await assert.rejects(readLimitedBody(stream, 10), BodyLimitError);
  assert.equal(cancelled, true);
});

test('AI ignores demo cookies and requires a real authenticated buyer', async () => {
  const { load, calls } = fixture({ anonymous: true });
  const response = await load('src/app/api/ai/drape-on/route.ts').POST(request({ productId, subjectMode: 'ai_model' }, { cookie: 'fabrictrad_demo_role=buyer' }));
  assert.equal(response.status, 401); assert.equal(calls.length, 0);
});

test('AI denies seller-primary accounts even when the account has can_buy', async () => {
  const { load } = fixture({ profile: { role: 'seller' } });
  assert.equal((await load('src/app/api/ai/drape-on/route.ts').POST(request({ productId, subjectMode: 'ai_model' }))).status, 403);
});

test('AI requires server-side consent before processing personal photos', async () => {
  const { load, calls } = fixture();
  const response = await load('src/app/api/ai/drape-on/route.ts').POST(request({ productId, modelImage: 'data:image/png;base64,YQ==' }));
  assert.equal(response.status, 400); assert.equal((await response.json()).code, 'PHOTO_CONSENT_REQUIRED'); assert.equal(calls.length, 0);
});

test('AI forbids arbitrary fabric-image generation outside an approved listing', async () => {
  const { load } = fixture();
  const response = await load('src/app/api/ai/drape-on/route.ts').POST(request({ subjectMode: 'ai_model', fabricImage: 'https://images.unsplash.com/example.jpg' }));
  assert.equal(response.status, 400); assert.equal((await response.json()).code, 'PRODUCT_REQUIRED');
});

test('selected colour cannot silently borrow the parent colour photo', async () => {
  const { load, calls } = fixture({ variant: { id: variantId, product_id: productId, color_name: 'Red', image_url: null, image_urls: [] } });
  const response = await load('src/app/api/ai/drape-on/route.ts').POST(request({ productId, variantId, subjectMode: 'ai_model' }));
  assert.equal(response.status, 400); assert.equal((await response.json()).code, 'NO_FABRIC_IMAGE'); assert.equal(calls.length, 0);
});

test('quota database failure fails closed before external image requests', async () => {
  const { load, calls } = fixture();
  const response = await load('src/app/api/ai/drape-on/route.ts').POST(request({ productId, subjectMode: 'ai_model' }));
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'AI_QUOTA_UNAVAILABLE'); assert.equal(calls.length, 1);
});

test('exhausted quota returns 429 without calling an image provider', async () => {
  const { load } = fixture({ rpcResult: { data: false, error: null } });
  const response = await load('src/app/api/ai/drape-on/route.ts').POST(request({ productId, subjectMode: 'ai_model' }));
  assert.equal(response.status, 429);
});

test('admin operations deny buyer sessions', async () => {
  const { load } = fixture();
  const response = await load('src/app/api/admin/orders/route.ts').GET(new next.NextRequest('https://fabrictrad.test/api/admin/orders'));
  assert.equal(response.status, 403);
});

const invoice = { id: productId, invoice_number: 'AUDIT-INV-1', email_status: 'pending',
  email_recipient: 'buyer@example.test', recipient: { name: 'Buyer <example>' }, supplier: { tradeName: 'Test supplier' },
  payment_reference: 'pay_fixture', lines: [{ description: 'Cotton <script>', quantity: 1, unit: 'piece', lineTotal: 100 }],
  total_amount: 100, taxable_value: 100 };

test('invoice email uses saved recipient, printable link and a stable provider idempotency key', async () => {
  const sends = [];
  const f = fixture({ invoice, env: { RESEND_API_KEY: 'test-email-key' }, rpcResult: { data: invoice, error: null },
    fetch: async (url, init) => { sends.push({ url, init }); return new Response(JSON.stringify({ id: 'email_fixture' }), { status: 200 }); } });
  const result = await f.load('src/lib/server/automaticInvoice.ts').ensureAutomaticInvoice({
    admin: { rpc: async () => ({ data: invoice, error: null }), from: () => {
      const c = { update() { return this; }, eq() { return this; }, neq() { return this; }, or() { return this; }, select() { return this; }, maybeSingle: async () => ({ data: { id: invoice.id }, error: null }), then: r => Promise.resolve({ error: null }).then(r) };
      return c;
    } }, kind: 'catalog', orderId: productId, paymentId: 'pay_fixture',
  });
  assert.equal(result.emailed, true); assert.equal(sends.length, 1);
  assert.equal(sends[0].url, 'https://api.resend.com/emails');
  assert.equal(sends[0].init.headers['Idempotency-Key'], 'fabrictrad-invoice/' + invoice.id);
  const email = JSON.parse(sends[0].init.body);
  assert.deepEqual(email.to, ['buyer@example.test']);
  assert.ok(email.html.includes('/api/invoices/' + invoice.id));
  assert.ok(!email.html.includes('Cotton <script>')); assert.ok(email.html.includes('Cotton &lt;script&gt;'));
});

test('previously submitted invoice is not sent again', async () => {
  const f = fixture();
  const result = await f.load('src/lib/server/automaticInvoice.ts').ensureAutomaticInvoice({
    admin: { rpc: async () => ({ data: { ...invoice, email_status: 'sent' }, error: null }) },
    kind: 'catalog', orderId: productId, paymentId: 'pay_fixture',
  });
  assert.equal(result.emailed, true);
});

test('missing email credentials records configuration failure without sending', async () => {
  const updates = [];
  const f = fixture();
  const result = await f.load('src/lib/server/automaticInvoice.ts').ensureAutomaticInvoice({
    admin: { rpc: async () => ({ data: invoice, error: null }), from: () => {
      const c = { update(v) { updates.push(v); return this; }, eq() { return this; }, neq() { return Promise.resolve({ error: null }); } };
      return c;
    } }, kind: 'catalog', orderId: productId, paymentId: 'pay_fixture',
  });
  assert.equal(result.emailed, false); assert.equal(updates[0].email_status, 'not_configured');
});
