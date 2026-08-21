import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const enableSelling = read('src/app/api/account/enable-selling/route.ts');
const statusRoute = read('src/app/api/seller/verification-status/route.ts');
const readiness = read('src/app/seller-dashboard/components/SellerProfileReadiness.tsx');
const entry = read('src/app/seller-registration/components/SellerRegistrationEntry.tsx');
const resume = read('src/app/seller-registration/components/SellerApplicationResume.tsx');
const adminReview = read('src/app/api/admin/sellers/verification/route.ts');
const bankSync = read('supabase/migrations/20260806121000_sync_seller_registration_bank_profile.sql');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(
  enableSelling.includes(".in('upload_status', ['uploaded', 'under_review', 'approved'])") &&
    enableSelling.includes('missingDocuments'),
  'Seller submission must preserve previously uploaded documents and request only missing files.'
);
assert(
  enableSelling.includes('bankAccountNumberMasked') &&
    enableSelling.includes('existingBank?.account_number_masked'),
  'Seller submission must support both new and previously saved settlement details.'
);
assert(
  statusRoute.includes('applicationSubmitted') &&
    statusRoute.includes('missingDocuments') &&
    statusRoute.includes('submittedAt'),
  'Seller status must distinguish a draft from an application submitted for review.'
);
assert(
  readiness.includes('payload.status') && statusRoute.includes('status: readinessRecord'),
  'Seller dashboard readiness and verification-status API must share the same status response contract.'
);
assert(
  statusRoute.includes('...readinessRecord'),
  'Seller verification-status API must preserve its flat response for registration consumers.'
);
assert(
  entry.includes('profile?.can_sell') && entry.includes('<SellerApplicationResume />'),
  'Existing sellers must enter the resumable application instead of restarting registration.'
);
assert(
  resume.includes('Your seller application is not submitted yet') &&
    resume.includes('Review has not started because the application is incomplete'),
  'The seller UI must clearly explain why approval has not started.'
);
assert(
  adminReview.includes("'confirm_gstin'") &&
    adminReview.includes("'approve_document'") &&
    adminReview.includes("'verify_bank'") &&
    adminReview.includes("'approve_seller'"),
  'Administrator approval must be staged across GSTIN, documents, bank and final approval.'
);
assert(
  adminReview.includes('Complete all GSTIN, document and bank checks before final approval.'),
  'Final seller approval must fail closed while verification blockers remain.'
);
assert(
  bankSync.includes('seller_registration_sync_bank_profile') &&
    bankSync.includes('account_number_masked') &&
    bankSync.includes('when v_details_changed then false'),
  'Registration bank details must synchronize to an unverified masked settlement profile.'
);

console.log('Seller onboarding, readiness, resumability and staged approval checks passed.');
