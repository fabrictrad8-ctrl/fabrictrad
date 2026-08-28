import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/app/components/PublicAccessLanding.tsx', import.meta.url),
  'utf8'
);
const translations = readFileSync(
  new URL('../src/lib/publicLandingTranslations.ts', import.meta.url),
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
  source.includes('copy.privateGuidanceTitle') && source.includes('copy.privateGuidanceCopy'),
  'The public homepage must render its privacy-boundary guidance.'
);
assert(
  translations.includes("privateGuidanceTitle: 'Private commerce, public guidance'") &&
    translations.includes('Live marketplace records and account data stay behind sign-in'),
  'The English public homepage must clearly state that marketplace/account content requires authentication.'
);
assert(
  source.includes('href="/login"') && source.includes('href="/register"'),
  'The public homepage must provide sign-in and account-creation entry points.'
);
assert(
  !source.includes('product.price') &&
    !source.includes('seller.gstin') &&
    !source.includes('order.total') &&
    !source.includes('transaction'),
  'The public homepage must not render product, seller, order or transaction records.'
);

console.info('Public homepage privacy boundary checks passed.');
