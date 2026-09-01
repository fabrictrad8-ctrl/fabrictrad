import { readFileSync } from 'node:fs';

const landingSource = readFileSync(
  new URL('../src/app/components/PublicAccessLanding.tsx', import.meta.url),
  'utf8'
);
const translationSource = readFileSync(
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
    !landingSource.includes(marker),
    `The logged-out homepage must not expose signed-in workspace preview content: ${marker}`
  );
}

assert(
  !landingSource.includes('href="/marketplace"'),
  'The logged-out homepage must not link directly into the marketplace.'
);
assert(
  landingSource.includes('copy.privateGuidanceTitle') && landingSource.includes('copy.privateGuidanceCopy'),
  'The public homepage must render its privacy-boundary guidance.'
);
assert(
  translationSource.includes("privateGuidanceTitle: 'Private commerce, public guidance'") &&
    translationSource.includes('Live marketplace records and account data stay behind sign-in'),
  'The English public guidance must clearly state that live marketplace and account data require sign-in.'
);
assert(
  landingSource.includes('href="/login"') && landingSource.includes('href="/register"'),
  'The public homepage must provide sign-in and account-creation entry points.'
);
assert(
  translationSource.includes('Live marketplace records and account data stay behind sign-in'),
  'The public homepage must explain its privacy boundary.'
);

console.log('Public homepage privacy boundary checks passed.');
