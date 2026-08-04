import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/app/components/PublicAccessLanding.tsx', import.meta.url),
  'utf8'
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const privateWorkspaceMarkers = [
  'Seller overview',
  'Good morning, Aarna Textiles',
  'Search products, orders and customers',
  "Today's activity",
  'Add product',
  '₹4.8L',
  'previewRows',
];

for (const marker of privateWorkspaceMarkers) {
  assert(
    !source.includes(marker),
    `The logged-out homepage must not expose signed-in workspace preview content: ${marker}`
  );
}

assert(
  !source.includes('href="/marketplace"'),
  'The logged-out homepage must not link directly into the marketplace.'
);
assert(
  source.includes('Marketplace hidden before sign-in'),
  'The public homepage must clearly state that marketplace content requires authentication.'
);
assert(
  source.includes('href="/login"') && source.includes('href="/register"'),
  'The public homepage must provide sign-in and account-creation entry points.'
);
assert(
  source.includes('No products, seller information, prices, dashboards or transaction data are shown publicly.'),
  'The public homepage must explain its privacy boundary.'
);

console.log('Public homepage privacy boundary checks passed.');
