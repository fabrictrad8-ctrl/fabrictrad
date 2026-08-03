import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (relative) => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing required file: ${relative}`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
};
const requireText = (relative, needle) => {
  if (!read(relative).includes(needle)) failures.push(`${relative} must contain: ${needle}`);
};
const forbidText = (relative, needle) => {
  if (read(relative).includes(needle)) failures.push(`${relative} must not contain: ${needle}`);
};

const deletionSecurityMigration =
  'supabase/migrations/20260803171245_account_deletion_service_role_only.sql';
const requiredFiles = [
  'src/app/api/auth/password-login/route.ts',
  'src/app/api/auth/session-destination/route.ts',
  'src/app/login/EmailOtpLoginClient.tsx',
  'src/app/login/LoginRedirectGuard.tsx',
  'src/app/api/account/onboarding-draft/route.ts',
  'src/lib/hooks/useOnboardingDraft.ts',
  'src/app/buyer-registration/components/BuyerRegistrationEntry.tsx',
  'src/app/buyer-registration/components/BuyerRegistrationFlowV2.tsx',
  'src/app/seller-registration/components/SellerRegistrationFlow.tsx',
  'src/app/api/account/delete/request/route.ts',
  'src/app/api/account/delete/confirm/route.ts',
  'src/components/account/DeleteAccountPanel.tsx',
  'src/lib/accountDeletion.ts',
  'supabase/migrations/20260803164000_resumable_onboarding_and_account_deletion.sql',
  deletionSecurityMigration,
];
requiredFiles.forEach(read);

// Server-authoritative password login must finish in the same navigation without
// waiting for a client-side auth callback or requiring a manual page reload.
requireText('src/app/api/auth/password-login/route.ts', 'signInWithPassword');
requireText('src/app/api/auth/password-login/route.ts', 'ensureAuthenticatedAccountProvisioned');
requireText('src/app/api/auth/password-login/route.ts', "role === 'seller' ? '/account' : '/marketplace'");
requireText('src/app/login/EmailOtpLoginClient.tsx', "fetch('/api/auth/password-login'");
requireText('src/app/login/EmailOtpLoginClient.tsx', 'window.location.replace');
requireText('src/app/login/LoginRedirectGuard.tsx', "fetch(`/api/auth/session-destination");
forbidText('src/app/login/EmailOtpLoginClient.tsx', "router.refresh();");

// Buyer and seller registration must resume an existing account rather than
// attempting a duplicate sign-up or stopping at “already registered”.
requireText('src/app/buyer-registration/components/BuyerRegistrationFlowV2.tsx', 'useOnboardingDraft');
requireText('src/app/buyer-registration/components/BuyerRegistrationFlowV2.tsx', "saveOnboardingDraftLocally('buyer'");
requireText('src/app/buyer-registration/components/BuyerRegistrationFlowV2.tsx', "next: '/buyer-registration?resume=1'");
requireText('src/app/buyer-registration/components/BuyerRegistrationFlowV2.tsx', "const signup = user ?");
requireText('src/app/buyer-registration/components/BuyerRegistrationFlowV2.tsx', "password: '', confirmPassword: ''");
requireText('src/app/seller-registration/components/SellerRegistrationFlow.tsx', 'useOnboardingDraft');
requireText('src/app/seller-registration/components/SellerRegistrationFlow.tsx', "saveOnboardingDraftLocally('seller'");
requireText('src/app/seller-registration/components/SellerRegistrationFlow.tsx', "next: '/seller-registration?resume=1'");
requireText('src/app/seller-registration/components/SellerRegistrationFlow.tsx', "password: '', confirmPassword: '', bankAccountNumber: ''");
requireText('src/app/buyer-registration/components/BuyerRegistrationEntry.tsx', "window.localStorage.setItem('fabrictrad_buyer_type'");
requireText('src/lib/hooks/useOnboardingDraft.ts', "fetch('/api/account/onboarding-draft'");
requireText('src/app/api/account/onboarding-draft/route.ts', "onConflict: 'user_id,flow'");
requireText('supabase/migrations/20260803164000_resumable_onboarding_and_account_deletion.sql', 'onboarding_drafts_read_own');
requireText('supabase/migrations/20260803164000_resumable_onboarding_and_account_deletion.sql', 'onboarding_drafts_update_own');

// Account deletion requires server-side eligibility checks, multiple explicit
// acknowledgements, an exact confirmation phrase and a registered-email OTP.
requireText('src/components/account/DeleteAccountPanel.tsx', 'DELETE MY FABRICTRAD ACCOUNT');
requireText('src/components/account/DeleteAccountPanel.tsx', 'understandsRecordsRetained');
requireText('src/components/account/DeleteAccountPanel.tsx', 'confirmsNoOpenObligations');
requireText('src/app/api/account/delete/request/route.ts', 'accountDeletionBlockers');
requireText('src/app/api/account/delete/request/route.ts', 'shouldCreateUser: false');
requireText('src/app/api/account/delete/confirm/route.ts', 'verifyOtp');
requireText('src/app/api/account/delete/confirm/route.ts', 'verified.user?.id !== user.id');
requireText('src/app/api/account/delete/confirm/route.ts', "admin.rpc('anonymize_account_for_deletion'");
requireText('src/app/api/account/delete/confirm/route.ts', 'deleteUser(user.id, true)');
forbidText('src/app/api/account/delete/confirm/route.ts', "supabase.rpc('anonymize_current_account_for_deletion'");
requireText('src/lib/accountDeletion.ts', 'CATALOG_ORDERS_OPEN');
requireText('src/lib/accountDeletion.ts', 'BULK_ORDERS_OPEN');
requireText('src/lib/accountDeletion.ts', 'DISPUTES_OPEN');
requireText('src/lib/accountDeletion.ts', 'REFUNDS_PENDING');
requireText('src/lib/accountDeletion.ts', 'SELLER_SETTLEMENT_PENDING');
requireText('src/lib/accountDeletion.ts', "status === 'cancelled'");
requireText('src/app/account/page.tsx', '<DeleteAccountPanel');
requireText(deletionSecurityMigration, 'FROM PUBLIC, anon, authenticated, service_role');
requireText(deletionSecurityMigration, 'TO service_role');

if (failures.length) {
  console.error(`Account lifecycle verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Account lifecycle verification passed (${requiredFiles.length} required files checked).`);
