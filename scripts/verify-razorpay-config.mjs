import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function loadLocalEnvironment() {
  for (const filename of ['.env', '.env.local']) {
    const filepath = path.join(root, filename);
    if (!fs.existsSync(filepath)) continue;
    const lines = fs.readFileSync(filepath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadLocalEnvironment();

const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
const runApiCheck = process.argv.includes('--api');

const failures = [];
if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
  failures.push('RAZORPAY_KEY_ID is missing or does not look like a Razorpay Test/Live Key ID.');
}
if (keySecret.length < 20) {
  failures.push('RAZORPAY_KEY_SECRET is missing or too short.');
}
if (keySecret.startsWith('rzp_')) {
  failures.push('RAZORPAY_KEY_SECRET appears to contain a Key ID instead of the secret.');
}

if (failures.length) {
  console.error('Razorpay configuration verification failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Razorpay environment is present (${keyId.startsWith('rzp_test_') ? 'Test Mode' : 'Live Mode'} Key ID).`
);
console.log('The Key Secret is server-only and was not printed.');
if (webhookSecret.length >= 16) {
  console.log('A separate Razorpay webhook secret is configured.');
} else {
  console.warn(
    'RAZORPAY_WEBHOOK_SECRET is not configured yet. Checkout can open, but signed webhook reconciliation will remain unavailable.'
  );
}

if (!runApiCheck) {
  console.log(
    'Run `npm run verify:razorpay -- --api` to create a harmless 100-paise Razorpay order and verify API authentication.'
  );
  process.exit(0);
}

const amount = 100;
const receipt = `FT-CONFIG-${Date.now()}`.slice(0, 40);
let response;
try {
  response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt,
      notes: { purpose: 'FabricTrad configuration verification' },
    }),
    signal: AbortSignal.timeout(20_000),
  });
} catch (error) {
  console.error(
    error instanceof Error && error.name === 'TimeoutError'
      ? 'Razorpay API verification timed out.'
      : 'Razorpay API could not be reached.'
  );
  process.exit(1);
}

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  const description = payload?.error?.description || `Razorpay returned HTTP ${response.status}.`;
  console.error(`Razorpay API verification failed: ${description}`);
  process.exit(1);
}
if (!payload?.id || Number(payload.amount) !== amount || payload.currency !== 'INR') {
  console.error('Razorpay API returned an unexpected order response.');
  process.exit(1);
}

console.log(`Razorpay API authentication succeeded. Test order: ${payload.id}`);
console.log('No payment was made; the verifier created only a 100-paise order record in Razorpay.');
