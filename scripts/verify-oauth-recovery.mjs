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
const passwordResetRequest = read('src/app/api/auth/email-otp/request/route.ts');
const passwordResetPage = read('src/app/auth/reset-password/page.tsx');
const accountLogin = read('src/app/login/EmailOtpLoginClient.tsx');
const adminOtpRequest = read('src/app/api/auth/admin-otp/request/route.ts');
const authEmailDocs = read('docs/AUTH_EMAIL_SERVER.md');
const environmentExample = read('.env.example');
const wrangler = read('wrangler.jsonc');
const adminLogin = read('src/app/admin-login/AdminLoginClient.tsx');
const adminPortal = read('src/app/admin-portal/page.tsx');
const middleware = read('src/middleware.ts');
const phoneCollection = read('src/app/auth/phone/PhoneCollectionPage.tsx');
const sellerReadiness = read('src/app/seller-dashboard/components/SellerProfileReadiness.tsx');
const sellerStatusEndpoint = read('src/app/api/seller/verification-status/route.ts');
const contactPhoneMigration = read(
  'supabase/migrations/20260802010500_remove_phone_otp_and_use_contact_number.sql'
);
const gstVerificationRoute = read('src/app/api/gstin/verify/route.ts');
const gstVerificationReference = read('src/lib/gstVerification.ts');
const sellerRegistration = read(
  'src/app/seller-registration/components/SellerRegistrationFlowV2.tsx'
);
const buyerRegistration = read(
  'src/app/buyer-registration/components/BuyerRegistrationFlowV2.tsx'
);
const gstVerificationDocs = read('docs/GSTIN_VERIFICATION.md');

// OAuth and account recovery.
assert(
  provisioning.includes("client.rpc('ensure_current_account_profile'"),
  'OAuth provisioning must call the authenticated recovery RPC.'
);
assert(callback.includes('ensureAuthenticatedAccountProvisioned'), 'OAuth callback must use authenticated provisioning.');
assert(callback.includes('/auth/setup'), 'OAuth callback must preserve the session through a recovery screen.');
assert(endpoint.includes('profile_setup_failed'), 'Provisioning endpoint needs a stable recovery error code.');
assert(migration.includes('security definer'), 'Recovery function must be SECURITY DEFINER.');
assert(migration.includes('grant execute') && migration.includes('to authenticated'), 'Only authenticated users may call recovery.');
assert(recoveryUi.includes('Session preserved') && recoveryUi.includes('aria-live'), 'Recovery UI must preserve and announce session status.');

// Buyer and seller password recovery must be a recovery flow, never passwordless login.
assert(passwordResetRequest.includes('resetPasswordForEmail'), 'Forgot password must use Supabase password recovery.');
assert(passwordResetRequest.includes('/auth/reset-password'), 'Recovery email must return to the new-password screen.');
assert(!passwordResetRequest.includes('signInWithOtp'), 'Forgot password must never send a passwordless sign-in email.');
assert(!passwordResetRequest.includes('auth.admin.generateLink'), 'Password recovery must not require a privileged Supabase key.');
assert(!passwordResetRequest.includes('SMTP_PASS'), 'Password recovery must not require a Cloudflare SMTP secret.');
assert(passwordResetRequest.includes("method: 'password_recovery'"), 'Recovery endpoint must identify the correct email purpose.');
assert(passwordResetPage.includes('updatePassword(password)'), 'Recovery screen must save the new password through Supabase Auth.');
assert(accountLogin.includes('Send password reset email'), 'Buyer and seller login must request a recovery email.');
assert(accountLogin.includes('It will not sign you into the marketplace'), 'Recovery UI must distinguish reset from login.');
assert(middleware.includes("'/auth/reset-password'"), 'The public recovery page must load before browser auth tokens are persisted.');

// Administrator OTP must use Supabase custom SMTP directly.
assert(adminOtpRequest.includes('configuredAdminEmail()'), 'Administrator OTP must remain restricted to the configured address.');
assert(adminOtpRequest.includes('signInWithOtp'), 'Administrator OTP must be requested through Supabase Auth.');
assert(adminOtpRequest.includes('shouldCreateUser: false'), 'Administrator OTP must never create a new user.');
assert(adminOtpRequest.includes("method: 'email_otp'"), 'Administrator endpoint must identify numeric email OTP delivery.');
assert(!adminOtpRequest.includes('auth.admin.generateLink'), 'Administrator OTP must not require a privileged Supabase key.');
assert(!adminOtpRequest.includes('sendAdminOtpEmail'), 'Administrator OTP delivery must be handled by Supabase custom SMTP.');
assert(!adminOtpRequest.includes('SMTP_PASS'), 'Administrator OTP must not depend on a Cloudflare SMTP secret.');
assert(!adminOtpRequest.includes('phone:'), 'Administrator authentication must not use phone authentication.');

assert(authEmailDocs.includes('Authentication → SMTP Settings'), 'Email documentation must point to Supabase SMTP settings.');
assert(authEmailDocs.includes('smtp.resend.com') && authEmailDocs.includes('Port: 465'), 'Email documentation must contain Resend SMTP details.');
assert(authEmailDocs.includes('{{ .Token }}'), 'Administrator template documentation must use the numeric OTP variable.');
assert(authEmailDocs.includes('does not require `SMTP_PASS` or `SUPABASE_SECRET_KEY` in Cloudflare'), 'Documentation must state that Cloudflare auth secrets are unnecessary.');
assert(environmentExample.includes('Authentication → SMTP Settings'), 'Environment example must direct operators to Supabase SMTP configuration.');
assert(!environmentExample.includes('SMTP_PASS='), 'Cloudflare environment must not request an authentication SMTP password.');
assert(!wrangler.includes('SMTP_HOST') && !wrangler.includes('SMTP_USER'), 'Wrangler must not contain unused authentication SMTP bindings.');

assert(adminLogin.includes('Sign in with email OTP'), 'Administrator UI must provide an email OTP sign-in screen.');
assert(adminLogin.includes('Send administrator OTP'), 'Administrator UI must request the code.');
assert(adminLogin.includes('Six-digit administrator code'), 'Administrator UI must provide an OTP input.');
assert(adminLogin.includes('verifyEmailOtp'), 'Administrator UI must validate the OTP with Supabase Auth.');
assert(adminLogin.includes("window.location.replace('/admin-portal')"), 'Successful OTP verification must open the admin portal.');
assert(adminPortal.includes("redirect('/admin-login')"), 'Unauthenticated administrator access must return to admin login.');
assert(adminPortal.includes('profile?.is_active === true'), 'The server must require an active administrator profile.');
assert(adminPortal.includes("profile.role === 'super_admin'") && adminPortal.includes("profile.role === 'admin_staff'"), 'The server must require an administrator role.');
assert(!adminPortal.includes('authorisedByEmail'), 'A matching email alone must never grant administrator access.');

// Contact phone remains provider-free.
assert(phoneCollection.includes("rpc('set_current_account_phone'"), 'Phone collection must use the protected contact-number RPC.');
assert(!phoneCollection.includes('verifyOtp') && !phoneCollection.includes('Send verification code'), 'Phone collection must not start SMS OTP.');
assert(phoneCollection.includes('SMS verification is not required'), 'Contact-number UI must explain that SMS is not required.');
assert(sellerStatusEndpoint.includes("rpc('ensure_current_seller_verification_state')"), 'Seller readiness must come from the protected function.');
assert(sellerReadiness.includes('Contact number added'), 'Seller readiness must count a saved phone as complete.');
assert(contactPhoneMigration.includes('set_current_account_phone'), 'Database must expose a protected contact-number RPC.');
assert(contactPhoneMigration.includes('grant execute') && contactPhoneMigration.includes('to authenticated'), 'Only authenticated accounts may save their contact phone.');

// GST reference and verification integrity.
assert(gstVerificationReference.includes('https://services.gst.gov.in/services/searchtp'), 'GST verification must point to the official portal.');
assert(gstVerificationReference.includes('captchaRequired: true'), 'The free official portal flow must disclose captcha.');
assert(gstVerificationRoute.includes('OFFICIAL_GST_PORTAL_REFERENCE'), 'GST API responses must include the official reference.');
assert(gstVerificationRoute.includes("verificationMode: 'official_manual'"), 'Manual GST results must not be represented as API verified.');
assert(!gstVerificationRoute.includes("fetch('https://services.gst.gov.in"), 'FabricTrad must not scrape the official GST captcha.');
assert(sellerRegistration.includes('Open official GST Portal'), 'Seller onboarding must expose the official GST reference.');
assert(buyerRegistration.includes('Open official GST Portal'), 'Business buyer onboarding must expose the official GST reference.');
assert(gstVerificationDocs.includes('GST Suvidha Providers'), 'GST documentation must explain the authorised GSP option.');

console.log('OAuth, Supabase-managed email, password recovery, administrator OTP, GST and seller verification checks passed.');
