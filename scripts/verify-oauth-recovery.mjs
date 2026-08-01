import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const provisioning = read('src/lib/accountProvisioning.ts');
const callback = read('src/app/auth/callback/route.ts');
const endpoint = read('src/app/api/auth/provision-account/route.ts');
const migration = read('supabase/migrations/20260731090000_oauth_account_recovery.sql');
const recoveryUi = read('src/app/auth/setup/AccountSetupClient.tsx');
const adminOtpRequest = read('src/app/api/auth/admin-otp/request/route.ts');
const phoneVerification = read('src/app/auth/phone/PhoneCollectionPage.tsx');
const sellerReadiness = read('src/app/seller-dashboard/components/SellerProfileReadiness.tsx');
const sellerStatusEndpoint = read('src/app/api/seller/verification-status/route.ts');
const sellerRepairMigration = read(
  'supabase/migrations/20260801233500_repair_legacy_seller_verification_and_phone_sync.sql'
);
const sellerApprovalMigration = read(
  'supabase/migrations/20260801234000_enforce_seller_verification_before_approval.sql'
);

assert(
  provisioning.includes("client.rpc('ensure_current_account_profile'"),
  'OAuth provisioning must call the authenticated recovery RPC.'
);
assert(!provisioning.includes('preferred_language:'), 'Do not write non-existent preferred_language column.');
assert(!provisioning.includes('preferred_theme:'), 'Do not write non-existent preferred_theme column.');
assert(callback.includes('ensureAuthenticatedAccountProvisioned'), 'OAuth callback must use authenticated provisioning.');
assert(callback.includes('/auth/setup'), 'OAuth callback must preserve the session through a recovery screen.');
assert(!callback.includes('account_setup_failed'), 'OAuth setup failures must not bounce users back to login.');
assert((callback.match(/auth\.signOut\(\)/g) || []).length <= 1, 'Only explicitly inactive accounts may be signed out.');
assert(endpoint.includes('profile_setup_failed'), 'Provisioning endpoint needs a stable recovery error code.');
assert(migration.includes('security definer'), 'Recovery function must be SECURITY DEFINER.');
assert(migration.includes("set search_path = ''"), 'Recovery function must pin an empty search path.');
assert(migration.includes('revoke all on function'), 'Recovery function must revoke default execution.');
assert(migration.includes('grant execute') && migration.includes('to authenticated'), 'Only authenticated users may call recovery.');
assert(recoveryUi.includes('Session preserved'), 'Recovery UI must explain that the authenticated session is preserved.');
assert(recoveryUi.includes('aria-live'), 'Recovery status must be announced accessibly.');

assert(
  adminOtpRequest.includes('shouldCreateUser: false'),
  'Admin email-code login must never create an unintended account.'
);
assert(
  adminOtpRequest.includes('configuredAdminEmail()'),
  'Admin email-code login must remain restricted to the configured administrator.'
);
assert(
  !adminOtpRequest.includes('ensureConfiguredAdminAccount'),
  'Sending an admin email code must not depend on the service-role provisioning path.'
);
assert(
  !adminOtpRequest.includes('createAdminClient'),
  'The public admin email-code endpoint must not require or instantiate a service-role client.'
);

assert(
  phoneVerification.includes("supabase.auth.updateUser({") && phoneVerification.includes("type: 'phone_change'"),
  'Phone verification must use Supabase phone-change OTP rather than marking a stored number verified.'
);
assert(
  phoneVerification.includes('phone_verified: true') && phoneVerification.includes('phone_confirmed_at'),
  'The user profile may be marked phone-verified only after Supabase confirms the auth phone.'
);
assert(
  !phoneVerification.includes('Phone number verification (OTP) will be added soon'),
  'The seller flow must not ship the old non-verifying phone placeholder.'
);
assert(
  phoneVerification.includes('That same account can buy and sell'),
  'Phone verification must preserve the unified buyer and seller account model.'
);
assert(
  sellerStatusEndpoint.includes("rpc('ensure_current_seller_verification_state')"),
  'Seller readiness must come from the protected server-authoritative verification function.'
);
assert(
  sellerReadiness.includes('Profile completeness and business verification are separate'),
  'Seller readiness must clearly separate saved profile fields from actual verification.'
);
assert(
  sellerReadiness.includes('requiredDocumentsApproved') && sellerReadiness.includes('bankVerified'),
  'Seller readiness must report document and settlement-bank review instead of only basic fields.'
);
assert(
  sellerRepairMigration.includes('sync_confirmed_auth_phone_to_profile') &&
    sellerRepairMigration.includes('ensure_current_seller_verification_state'),
  'The database must repair legacy sellers and synchronise confirmed auth phone state.'
);
assert(
  sellerRepairMigration.includes('grant execute') && sellerRepairMigration.includes('to authenticated'),
  'Only authenticated accounts may request their seller verification summary.'
);
assert(
  sellerApprovalMigration.includes('enforce_seller_verification_before_approval') &&
    sellerApprovalMigration.includes('GST certificate, PAN card and cancelled cheque'),
  'Seller approval must be blocked in PostgreSQL until phone, GST, documents and bank checks pass.'
);

console.log('OAuth, admin login and seller verification regression checks passed.');
