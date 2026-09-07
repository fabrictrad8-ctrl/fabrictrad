import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
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
    ...options.records,
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: userId, ...options.authUser } } }) },
    from: (table) => {
      const result = { data: records[table] ?? null, error: null };
      const chain = { select() { return this; }, in() { return this; }, limit() { return this; }, upsert(values) { calls.push({ table, upsert: values }); return this; }, insert(values) { calls.push({ table, insert: values }); return this; }, eq() { return this; }, neq() { return this; }, or() { return this; }, update(values) { calls.push({ table, values }); return this; }, order() { return this; }, maybeSingle: async () => result, single: async () => result, then: (resolve) => Promise.resolve(result).then(resolve) };
      return chain;
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (options.rpc) return options.rpc(name, args);
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
      if (name === '@/lib/razorpayCredentials' && options.razorpay) return { getRazorpayCredentials: async () => ({ keyId: 'rzp_live_fixture', keySecret: 'fixture-secret-with-32-characters' }) };
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

test('an admin role without an approved email OTP session cannot use privileged APIs', async () => {
  const f = fixture({ profile: { role: 'super_admin' }, rpcResult: { data: false, error: null } });
  const response = await f.load('src/app/api/admin/orders/route.ts').GET(new next.NextRequest('https://fabrictrad.test/api/admin/orders'));
  assert.equal(response.status, 403);
  assert.equal(f.calls.filter(call => call.name === 'is_admin').length, 1);
});

test('admin access fails closed if the session policy cannot be verified', async () => {
  const f = fixture({ profile: { role: 'admin_staff' } });
  assert.equal(await f.load('src/lib/server/requireAdministrator.ts').requireAdministrator(), false);
});

test('active administrators with a verified email OTP session pass the access guard', async () => {
  const f = fixture({ profile: { role: 'super_admin' }, rpcResult: { data: true, error: null } });
  assert.equal(await f.load('src/lib/server/requireAdministrator.ts').requireAdministrator(), true);
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

test('void invoice retries never send an issued invoice email', async () => {
  const f = fixture({ env: { RESEND_API_KEY: 'test-email-key' }, fetch: async () => { throw new Error('Void document was emailed'); } });
  for (const email_status of ['pending', 'sent']) {
    const result = await f.load('src/lib/server/automaticInvoice.ts').ensureAutomaticInvoice({
      admin: { rpc: async () => ({ data: { ...invoice, status: 'void', email_status }, error: null }) },
      kind: 'catalog', orderId: productId, paymentId: 'pay_fixture',
    });
    assert.equal(result.emailed, false);
    assert.match(result.error, /void billing document/i);
  }
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


const payoutBank = { account_number: '123456789012', ifsc_code: 'HDFC0000001', beneficiary_name: 'QA Seller' };
const routeAccount = { seller_id: 'seller', linked_account_id: 'acc_fixture', product_id: 'acc_prd_fixture', setup_state: 'submitted', bank_last4: '9012', bank_ifsc: payoutBank.ifsc_code, bank_fingerprint: createHmac('sha256', 'fixture-secret-with-32-characters').update(`fabrictrad-bank-v1:${payoutBank.ifsc_code}:${payoutBank.account_number}`).digest('hex'), updated_at: '2026-09-06T00:00:00Z' };
function checkoutFixture(options = {}) {
  const requests = [];
  const f = fixture({ razorpay: true, records: {
    buyer_profiles: { id: userId },
    seller_profiles: { id: 'seller', user_id: 'seller-user', is_active: true, gstin_verified: true, verification_status: 'verified' },
    catalog_order_requests: { id: productId, buyer_id: userId, seller_id: 'seller', status: 'accepted', total_amount: 100, amount_paid: 0, amount_refunded: 0, deposit_percent: 100 },
    seller_payout_accounts: options.account === undefined ? routeAccount : options.account,
    catalog_order_payments: options.existing || null,
  }, rpc: async () => ({ data: true, error: null }), fetch: async (url, init = {}) => {
    requests.push({ url, init });
    if (url.endsWith('/products/acc_prd_fixture')) return Response.json({ id: 'acc_prd_fixture', account_id: 'acc_fixture', product_name: 'route', activation_status: options.activation || 'activated', requirements: options.requirements || [], active_configuration: { settlements: options.bank || payoutBank } });
    if (url.endsWith('/v2/accounts/acc_fixture')) return Response.json({ id: 'acc_fixture', type: 'route', status: options.accountStatus || 'created' });
    if (url === 'https://api.razorpay.com/v1/orders/order_fixture?expand%5B%5D=transfers') return Response.json({ id: 'order_fixture', entity: 'order', amount: 10000, currency: 'INR', status: 'created', transfers: { entity: 'collection', count: 1, items: [{ recipient: 'acc_fixture', amount: 9000, currency: 'INR', on_hold: false, status: 'created' }] } });
    if (url.endsWith('/v1/orders') && init.method === 'POST') return Response.json({ id: 'order_fixture', amount: 10000, currency: 'INR', status: 'created' });
    throw new Error('Unexpected provider call');
  } });
  return { ...f, requests };
}
const checkoutRequest = () => new next.NextRequest('https://fabrictrad.test/api/razorpay/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: productId, orderType: 'catalog' }) });

test('90/10 allocations preserve every paise without additional seller deductions', () => {
  const { marketplaceSplit, marketplaceTransfer } = fixture().load('src/lib/marketplaceSplit.ts');
  for (const amount of [100, 101, 105, 10000, 100000, 1000000, 99999999]) {
    const split = marketplaceSplit(amount);
    assert.equal(split.sellerPaise + split.platformPaise, amount);
    assert.ok(Math.abs(split.sellerPaise - amount * 0.9) <= 0.50001);
    assert.equal(marketplaceTransfer(amount, 'acc_fixture').on_hold, false);
  }
  assert.equal(marketplaceSplit(10000).sellerPaise, 9000);
  for (const amount of [0, -1, 99, 100.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => marketplaceSplit(amount));
});

test('checkout fails closed when seller has no provider-verified payout account', async () => {
  const f = checkoutFixture({ account: null });
  const response = await f.load('src/app/api/razorpay/order/route.ts').POST(checkoutRequest());
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'SELLER_PAYOUT_NOT_READY');
  assert.equal(f.requests.length, 0); assert.equal(f.calls.filter(c => c.insert).length, 0);
});

for (const scenario of [{ activation: 'under_review' }, { accountStatus: 'suspended' }, { bank: { ...payoutBank, account_number: '999999999012' } }, { requirements: [{ status: 'required', field_reference: 'kyc.pan' }] }]) {
  test('checkout blocks pending, suspended, mismatched or incomplete provider verification: ' + JSON.stringify(scenario), async () => {
    const f = checkoutFixture(scenario);
    assert.equal((await f.load('src/app/api/razorpay/order/route.ts').POST(checkoutRequest())).status, 409);
    assert.equal(f.requests.filter(r => r.init.method === 'POST').length, 0);
  });
}

test('verified checkout sends and persists 90% seller allocation without a settlement hold', async () => {
  const f = checkoutFixture();
  const response = await f.load('src/app/api/razorpay/order/route.ts').POST(checkoutRequest());
  assert.equal(response.status, 200);
  const provider = JSON.parse(f.requests.find(r => r.init.method === 'POST').init.body);
  assert.equal(provider.amount, 10000); assert.equal(provider.transfers.length, 1);
  assert.deepEqual(provider.transfers[0], { account: 'acc_fixture', amount: 9000, currency: 'INR', on_hold: false });
  const saved = f.calls.find(c => c.table === 'catalog_order_payments' && c.insert).insert;
  assert.equal(saved.seller_payable, 90); assert.equal(saved.platform_retained, 10); assert.equal(saved.razorpay_fee, 0);
  assert.equal(Math.round((saved.platform_commission + saved.gst_on_commission) * 100), 1000);
  assert.equal(saved.transfer_account_id, 'acc_fixture');
});

test('legacy unsplit checkout is never reused or silently replaced with a second payable order', async () => {
  const f = checkoutFixture({ existing: { id: 'payment-fixture', razorpay_order_id: 'order_old', amount: 100, currency: 'INR', status: 'initiated', split_version: null } });
  const response = await f.load('src/app/api/razorpay/order/route.ts').POST(checkoutRequest());
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'LEGACY_CHECKOUT_REVIEW_REQUIRED');
  assert.equal(f.requests.filter(r => r.init.method === 'POST').length, 0);
});

test('bank setup requires a seller and never accepts a buyer session', async () => {
  const f = fixture();
  const response = await f.load('src/app/api/seller/payout-account/route.ts').POST(new next.NextRequest('https://fabrictrad.test/api/seller/payout-account', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 403);
});

test('a transfer ID alone cannot be mistaken for bank settlement', () => {
  const { transferState } = fixture().load('src/lib/server/routeTransferReconciliation.ts');
  const transfer = { id: 'trf_fixture', source: 'pay_fixture', recipient: 'acc_fixture', amount: 9000, currency: 'INR', status: 'created', amount_reversed: 0 };
  assert.equal(transferState(transfer), 'created');
  assert.equal(transferState({ ...transfer, status: 'processed' }), 'processed');
  assert.equal(transferState({ ...transfer, status: 'processed', settlement_status: 'settled', recipient_settlement_id: 'setl_fixture' }), 'settled');
  assert.equal(transferState({ ...transfer, status: 'processed', amount_reversed: 1000 }), 'partially_reversed');
  assert.equal(transferState({ ...transfer, status: 'processed', amount_reversed: 9000 }), 'reversed');
});

const validBankSetup = {
  businessType: 'proprietorship', contactName: 'Example Seller', contactPan: 'ABCPD1234E',
  street: 'Example Road', city: 'Surat', state: 'Gujarat', pincode: '395001',
  registeredStreet: 'Example Market', registeredCity: 'Surat', registeredState: 'Gujarat', registeredPincode: '395001',
  accountName: 'Example Seller', accountNumber: payoutBank.account_number, confirmAccountNumber: payoutBank.account_number,
  ifsc: payoutBank.ifsc_code, termsAccepted: true,
};

test('an interrupted linked-account creation cannot be retried as a duplicate account', async () => {
  const row = { seller_id: 'seller', setup_state: 'draft', activation_status: 'pending' };
  let providerCalls = 0;
  const f = fixture({ razorpay: true, authUser: { email: 'seller@example.test' }, profile: { role: 'seller' },
    records: { seller_profiles: { id: 'seller', gstin_verified: true, contact_phone: '9999999999' }, seller_payout_accounts: row },
    fetch: async () => { providerCalls++; throw new Error('Connection lost after request'); },
  });
  const api = f.load('src/app/api/seller/payout-account/route.ts');
  const req = () => new next.NextRequest('https://fabrictrad.test/api/seller/payout-account', { method: 'POST', body: JSON.stringify(validBankSetup) });
  const first = await api.POST(req());
  assert.equal(first.status, 503); assert.equal(providerCalls, 1);
  assert.equal(row.setup_state, 'creating_account');
  const second = await api.POST(req());
  assert.equal(second.status, 409); assert.equal((await second.json()).code, 'PAYOUT_RECONCILIATION_REQUIRED');
  assert.equal(providerCalls, 1);
  assert.ok(!JSON.stringify(f.calls).includes(payoutBank.account_number));
  assert.ok(!JSON.stringify(f.calls).includes(validBankSetup.contactPan));
});

test('provider rejection never exposes a bank number or PAN in a seller error', async () => {
  const f = fixture({ razorpay: true, fetch: async () => Response.json({ error: { description: `${payoutBank.account_number} ${validBankSetup.contactPan}` } }, { status: 400 }) });
  try {
    await f.load('src/lib/server/razorpayRoute.ts').razorpayRequest('/v2/accounts', 'POST', {});
    assert.fail('The rejected request must throw');
  } catch (error) {
    assert.equal(error.code, 'RAZORPAY_DETAILS_REJECTED');
    assert.ok(!error.message.includes(payoutBank.account_number));
    assert.ok(!error.message.includes(validBankSetup.contactPan));
  }
});

test('custom quotations require explicit tax classification, including an explicit zero rate', () => {
  const { parseBespokeInvoiceDetails: parse } = fixture().load('src/lib/bespokeInvoiceDetails.ts');
  const details = { description: 'Tailoring service', hsnCode: '998822', gstRate: 18, supplyType: 'services' };
  assert.equal(parse(details).gstRate, 18);
  assert.equal(parse({ ...details, gstRate: 0 }).gstRate, 0);
  for (const bad of [null, {}, { ...details, gstRate: '' }, { ...details, gstRate: null }, { ...details, gstRate: NaN }, { ...details, gstRate: 101 }, { ...details, gstRate: 5.123 }, { ...details, hsnCode: 'abc' }, { ...details, supplyType: '' }]) assert.equal(parse(bad), null);
});

test('custom checkout refuses incomplete invoice details before contacting Razorpay', async () => {
  const f = fixture({ records: { bespoke_orders: { id: productId, user_id: userId, seller_id: 'seller', stage: 'advance_or_full_payment', quoted_amount: 1180, quotation: {} } } });
  const response = await f.load('src/app/api/bespoke/payment/order/route.ts').POST(request({ orderId: productId }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'INVOICE_DETAILS_REQUIRED');
  assert.equal(f.calls.some(call => call.table === 'bespoke_payments'), false);
});

test('custom capture emails distinguish payment receipt and final invoice with separate idempotency keys', async () => {
  const sends = [];
  const receipt = { ...invoice, id: 'receipt-fixture', invoice_number: 'FR/26-27/000001', document_type: 'payment_receipt', total_amount: 590, document_metadata: { paymentPurpose: 'advance', balanceAtIssue: 590 } };
  const final = { ...invoice, id: 'final-fixture', invoice_number: 'FT/26-27/000002', document_type: 'tax_invoice', total_amount: 1180 };
  const f = fixture({ env: { RESEND_API_KEY: 'test-email-key' }, fetch: async (url, init) => { sends.push({ url, init }); return new Response(JSON.stringify({ id: 'accepted-' + sends.length }), { status: 200 }); } });
  const admin = { rpc: async () => ({ data: { documents: [receipt, final], invoiceError: null }, error: null }), from: () => {
    const chain = { update() { return this; }, eq() { return this; }, neq() { return this; }, or() { return this; }, select() { return this; }, maybeSingle: async () => ({ data: { id: 'reserved' }, error: null }), then: r => Promise.resolve({ error: null }).then(r) }; return chain;
  } };
  const result = await f.load('src/lib/server/automaticInvoice.ts').ensureBespokePaymentDocuments({ admin, orderId: productId, paymentId: 'pay-fixture' });
  assert.equal(result.documents.length, 2); assert.equal(result.emailed, true);
  assert.equal(sends[0].init.headers['Idempotency-Key'], 'fabrictrad-invoice/receipt-fixture');
  assert.equal(sends[1].init.headers['Idempotency-Key'], 'fabrictrad-invoice/final-fixture');
  const first = JSON.parse(sends[0].init.body); const second = JSON.parse(sends[1].init.body);
  assert.match(first.subject, /payment receipt/); assert.match(first.html, /Balance at issue: ₹590/);
  assert.match(second.subject, /tax invoice/); assert.match(second.text, /Invoice total: ₹1,180/);
  assert.ok(!first.html.includes('Your final FabricTrad invoice has been generated'));
});

test('an invoice URL requires authentication and does not reveal an inaccessible invoice', async () => {
  const context = { params: Promise.resolve({ invoiceId: productId }) };
  const req = new next.NextRequest('https://fabrictrad.test/api/invoices/' + productId);
  const anonymous = await fixture({ anonymous: true }).load('src/app/api/invoices/[invoiceId]/route.ts').GET(req, context);
  assert.equal(anonymous.status, 307); assert.match(anonymous.headers.get('Location'), /\/login\?/);
  const other = await fixture().load('src/app/api/invoices/[invoiceId]/route.ts').GET(req, context);
  assert.equal(other.status, 404);
});
