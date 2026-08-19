import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const flow = read('src/app/seller-registration/components/SellerRegistrationFlowV2.tsx');
const entry = read('src/app/seller-registration/components/SellerRegistrationEntry.tsx');
const submit = read('src/app/api/account/enable-selling/route.ts');
const status = read('src/app/api/seller/verification-status/route.ts');

const checks = [
  [flow.includes("useOnboardingDraft<SellerDraft>"), 'seller wizard must use persistent onboarding drafts'],
  [flow.includes("flow: 'seller'"), 'seller draft must use the seller flow key'],
  [flow.includes("'/api/seller/verification-status'"), 'seller wizard must restore server-side progress'],
  [flow.includes("draftOnly"), 'document autosave must use draft-only mode'],
  [flow.includes('Saving securely…'), 'document selection must visibly autosave'],
  [flow.includes('savedDocuments'), 'saved document state must survive page restoration'],
  [submit.includes("formData.get('draftOnly') === '1'"), 'seller submission API must support draft-only saves'],
  [submit.includes('existingRegistration?.business_name'), 'seller submission must reuse saved business identity'],
  [submit.includes('existingRegistration?.owner_name'), 'seller submission must reuse saved owner identity'],
  [submit.includes('existingRegistration?.phone'), 'seller submission must reuse saved phone'],
  [submit.includes(".from('seller_bank_profiles')") && submit.includes('.upsert('), 'settlement details must persist to seller bank profiles'],
  [status.includes("registrationStatus !== 'pending'"), 'saved drafts must not be reported as submitted applications'],
  [entry.includes('sellerApplicationSubmitted'), 'seller entry must distinguish submitted review from incomplete onboarding'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error('Seller onboarding persistence safeguard failed:');
  for (const message of failed) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Seller onboarding persistence safeguard passed (${checks.length} checks).`);
