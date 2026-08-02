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
const adminLogin = read('src/app/admin-login/AdminLoginClient.tsx');
const adminPortal = read('src/app/admin-portal/page.tsx');
const middleware = read('src/middleware.ts');
const phoneCollection = read('src/app/auth/phone/PhoneCollectionPage.tsx');
const sellerReadiness = read('src/app/seller-dashboard/components/SellerProfileReadiness.tsx');
const sellerStatusEndpoint = read('src/app/api/seller/verification-status/route.ts');
const contactPhoneMigration = read(
  'supabase/migrations/20260802010500_remove_phone_otp_and_use_contact_number.sql'
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

assert(adminOtpRequest.includes('shouldCreateUser: false'), 'Administrator email OTP must never create an account.');
assert(adminOtpRequest.includes('configuredAdminEmail()'), 'Administrator email OTP must remain restricted to the configured address.');
assert(adminOtpRequest.includes('signInWithOtp'), 'Administrator access must use native Supabase email OTP generation.');
assert(adminOtpRequest.includes("method: 'email_otp'"), 'Administrator OTP endpoint must identify email OTP delivery.');
assert(!adminOtpRequest.includes('createAdminClient'), 'Public administrator OTP requests must not instantiate a service-role client.');
assert(!adminOtpRequest.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Public administrator OTP requests must not expose the service-role key.');
assert(!adminOtpRequest.includes('phone:'), 'Administrator OTP generation must not use phone authentication.');

assert(adminLogin.includes('Send administrator OTP'), 'Administrator UI must request a one-time email code.');
assert(adminLogin.includes('Six-digit administrator code'), 'Administrator UI must provide a six-digit OTP input.');
assert(adminLogin.includes('verifyEmailOtp'), 'Administrator UI must verify the email OTP with Supabase Auth.');
assert(adminLogin.includes("window.location.replace('/admin-portal')"), 'Successful OTP verification must reload into the admin portal.');
assert(!adminLogin.includes('email-link') && !adminLogin.includes('Send secure admin sign-in link'), 'The obsolete magic-link UI must not return.');
assert(!adminLogin.includes('current-password') && !adminLogin.includes('Enter admin dashboard'), 'Administrator access must remain OTP-only.');
assert(adminLogin.includes('No password or mobile-number OTP is used'), 'Administrator UI must distinguish email OTP from mobile OTP.');
assert(adminPortal.includes("redirect('/admin-login')"), 'Unauthenticated administrator portal access must return to the administrator OTP page.');
assert(middleware.includes("pathname.startsWith('/admin-portal') ? '/admin-login' : '/login'"), 'Middleware must route unauthenticated administrator traffic to the OTP page.');

assert(phoneCollection.includes("rpc('set_current_account_phone'"), 'Phone collection must use the authenticated contact-number RPC.');
assert(!phoneCollection.includes('auth.updateUser') && !phoneCollection.includes("type: 'phone_change'"), 'Phone collection must not start an SMS verification flow.');
assert(!phoneCollection.includes('verifyOtp') && !phoneCollection.includes('Send verification code'), 'Phone collection must remain provider-free.');
assert(phoneCollection.includes('SMS verification is not required'), 'The contact-number flow must explain that SMS is not required.');
assert(sellerStatusEndpoint.includes("rpc('ensure_current_seller_verification_state')"), 'Seller readiness must come from the protected verification function.');
assert(sellerReadiness.includes('Contact number added'), 'Seller readiness must count a saved phone as complete.');
assert(!sellerReadiness.includes('OTP verification required'), 'Seller readiness must not retain the removed OTP blocker.');
assert(sellerReadiness.includes('requiredDocumentsApproved') && sellerReadiness.includes('bankVerified'), 'Seller readiness must still report business checks.');

assert(contactPhoneMigration.includes('set_current_account_phone'), 'Database must expose a protected contact-number RPC.');
assert(contactPhoneMigration.includes('grant execute') && contactPhoneMigration.includes('to authenticated'), 'Only authenticated accounts may save their contact phone.');
assert(contactPhoneMigration.includes('drop trigger if exists sync_confirmed_auth_phone_to_profile'), 'The obsolete Auth phone-sync trigger must be removed.');
assert(contactPhoneMigration.includes("v_next_action := 'add_phone'"), 'A missing phone must remain an explicit profile action.');
assert(contactPhoneMigration.includes('Seller mobile number must be added before approval'), 'Seller approval must require a contact number without claiming OTP verification.');
assert(!contactPhoneMigration.includes('must be OTP verified'), 'Post-migration seller rules must not require SMS OTP.');

console.log('OAuth, native administrator email OTP and provider-free seller phone regression checks passed.');
