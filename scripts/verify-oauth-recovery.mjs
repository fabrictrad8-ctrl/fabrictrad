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
const adminPasswordRecovery = read(
  'src/app/api/auth/admin-password-recovery/request/route.ts'
);
const authEmailServer = read('src/lib/server/authEmail.ts');
const authEmailMigration = read(
  'supabase/migrations/20260802014500_auth_email_delivery_rate_limits.sql'
);
const authEmailDocs = read('docs/AUTH_EMAIL_SERVER.md');
const environmentExample = read('.env.example');
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

assert(passwordResetRequest.includes('createAdminClient'), 'Forgot password must generate recovery links on the trusted server.');
assert(passwordResetRequest.includes('auth.admin.generateLink'), 'Forgot password must use Supabase Admin recovery-link generation.');
assert(passwordResetRequest.includes("type: 'recovery'"), 'Forgot password must generate a recovery-purpose token.');
assert(passwordResetRequest.includes('properties?.action_link'), 'Forgot password must deliver the generated recovery action link.');
assert(passwordResetRequest.includes('sendPasswordRecoveryEmail'), 'Forgot password must use the FabricTrad email server.');
assert(!passwordResetRequest.includes('resetPasswordForEmail'), 'Buyer and seller password recovery must not invoke the locked Supabase hosted email template.');
assert(!passwordResetRequest.includes('signInWithOtp'), 'Forgot password must never send a passwordless sign-in email.');
assert(passwordResetRequest.includes("method: 'password_recovery'"), 'Recovery endpoint must identify the correct email purpose.');
assert(passwordResetRequest.includes('/auth/reset-password'), 'Recovery email must return to the new-password screen.');
assert(passwordResetPage.includes('updatePassword(password)'), 'Recovery screen must save the new password through Supabase Auth.');
assert(passwordResetPage.includes("'/login?password_updated=1'"), 'Buyer and seller recovery must return to normal password login.');
assert(passwordResetPage.includes("'/admin-login?password_updated=1'"), 'Administrator recovery must return to administrator password login.');
assert(accountLogin.includes('Send password reset email'), 'Buyer and seller login must request a recovery email.');
assert(accountLogin.includes('It will not sign you into the marketplace'), 'Recovery UI must distinguish reset from passwordless login.');
assert(!accountLogin.includes('Verify code') && !accountLogin.includes('six-digit password reset code'), 'Password recovery must not claim a numeric code is sent.');
assert(middleware.includes("'/auth/reset-password'"), 'The public recovery page must load before browser auth tokens are persisted.');

assert(adminOtpRequest.includes('configuredAdminEmail()'), 'Optional administrator email OTP must remain restricted to the configured address.');
assert(adminOtpRequest.includes('createAdminClient'), 'Optional administrator OTP generation must stay on the trusted server.');
assert(adminOtpRequest.includes('auth.admin.generateLink'), 'Optional administrator access must generate the real Supabase token server-side.');
assert(adminOtpRequest.includes("type: 'magiclink'"), 'Optional administrator OTP must use the Supabase email-token purpose.');
assert(adminOtpRequest.includes('properties?.email_otp'), 'Optional administrator delivery must extract the generated six-digit email OTP.');
assert(adminOtpRequest.includes('sendAdminOtpEmail'), 'Optional administrator OTP must be sent through the FabricTrad email server.');
assert(adminOtpRequest.includes("method: 'email_otp'"), 'Optional administrator OTP endpoint must identify email OTP delivery.');
assert(!adminOtpRequest.includes('signInWithOtp'), 'Optional administrator OTP must bypass the locked Supabase hosted email template.');
assert(!adminOtpRequest.includes('phone:'), 'Administrator authentication must not use phone authentication.');

assert(adminPasswordRecovery.includes('resetPasswordForEmail(configuredAdminEmail()'), 'Administrator password recovery must use the fixed configured admin account.');
assert(adminPasswordRecovery.includes('/auth/reset-password?admin=1'), 'Administrator recovery must return to the shared new-password screen in admin mode.');
assert(adminPasswordRecovery.includes("method: 'supabase_password_recovery'"), 'Administrator recovery must identify its provider-free fallback method.');
assert(!adminPasswordRecovery.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Administrator recovery must not expose or require the service-role key.');

assert(authEmailServer.includes('RESEND_API_KEY'), 'Authentication email delivery must use a server-only Resend API key.');
assert(authEmailServer.includes('https://api.resend.com/emails'), 'Authentication email delivery must call the Resend email API.');
assert(authEmailServer.includes('FABRICTRAD_AUTH_EMAIL_FROM'), 'Authentication email delivery must require a verified sender address.');
assert(authEmailServer.includes('Idempotency-Key'), 'Authentication email delivery must protect provider retries from duplicates.');
assert(authEmailServer.includes("rpc('claim_auth_email_delivery'"), 'Authentication email delivery must enforce database rate limits.');
assert(authEmailServer.includes('sendAdminOtpEmail') && authEmailServer.includes('sendPasswordRecoveryEmail'), 'Both authentication message types must have branded email senders.');
assert(!authEmailServer.includes('NEXT_PUBLIC_RESEND'), 'The Resend API key must never be exposed to browser code.');

assert(authEmailMigration.includes('auth_email_delivery_state'), 'Database must persist authentication email delivery limits.');
assert(authEmailMigration.includes('claim_auth_email_delivery'), 'Database must expose an atomic delivery claim function.');
assert(authEmailMigration.includes("auth.role() <> 'service_role'"), 'Only the service role may claim an authentication email delivery.');
assert(authEmailMigration.includes("purpose in ('admin_otp', 'password_recovery')"), 'Only approved authentication email purposes may be rate-limited.');
assert(authEmailMigration.includes('enable row level security'), 'Authentication email delivery state must use RLS.');
assert(authEmailMigration.includes('grant execute') && authEmailMigration.includes('to service_role'), 'Only the service role may execute the delivery claim.');
assert(environmentExample.includes('RESEND_API_KEY='), 'Environment example must include the server-only Resend key.');
assert(environmentExample.includes('FABRICTRAD_AUTH_EMAIL_FROM='), 'Environment example must include the verified sender address.');
assert(authEmailDocs.includes('updates.fabrictrad.com') && authEmailDocs.includes('SPF') && authEmailDocs.includes('DKIM'), 'Deployment documentation must cover sender-domain verification.');

assert(adminLogin.includes('Sign in to Admin Portal'), 'Administrator UI must provide a clear password sign-in screen.');
assert(adminLogin.includes('current-password'), 'Administrator UI must use the browser password autofill contract.');
assert(adminLogin.includes('await signIn(normalizedEmail, password)'), 'Administrator UI must authenticate through Supabase password login.');
assert(adminLogin.includes('isAdminRole(role)'), 'Administrator UI must reject authenticated non-admin accounts.');
assert(adminLogin.includes('await signOut().catch'), 'Rejected non-admin sessions must be cleared immediately.');
assert(adminLogin.includes("window.location.replace('/admin-portal')"), 'Successful administrator authentication must reload into the admin portal.');
assert(adminLogin.includes('Forgot administrator password?'), 'Administrator UI must provide a recovery path when the current password is unknown.');
assert(adminLogin.includes('/api/auth/admin-password-recovery/request'), 'Administrator recovery must call the dedicated fixed-account endpoint.');
assert(!adminLogin.includes('Send administrator OTP') && !adminLogin.includes('Six-digit administrator code'), 'Unavailable email delivery must not block the primary administrator login.');
assert(adminPortal.includes("redirect('/admin-login')"), 'Unauthenticated administrator portal access must return to the administrator login page.');
assert(adminPortal.includes('profile?.is_active === true'), 'The server must require an active administrator profile.');
assert(adminPortal.includes("profile.role === 'super_admin'") && adminPortal.includes("profile.role === 'admin_staff'"), 'The server must require an administrator role.');
assert(!adminPortal.includes('authorisedByEmail'), 'A matching email address alone must never grant administrator access.');
assert(middleware.includes("pathname.startsWith('/admin-portal') ? '/admin-login' : '/login'"), 'Middleware must route unauthenticated administrator traffic to the administrator login page.');

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

assert(gstVerificationReference.includes('https://services.gst.gov.in/services/searchtp'), 'GST verification must point to the official Search Taxpayer portal.');
assert(gstVerificationReference.includes('captchaRequired: true'), 'The free official portal flow must disclose its captcha requirement.');
assert(gstVerificationRoute.includes('OFFICIAL_GST_PORTAL_REFERENCE'), 'GST API responses must include the official portal reference.');
assert(gstVerificationRoute.includes("verificationMode: 'official_manual'"), 'Invalid and manual GST results must not be represented as provider verified.');
assert(gstVerificationRoute.includes("'authorised_api' : 'official_manual'"), 'GST results must distinguish authorised API verification from manual review.');
assert(gstVerificationRoute.includes('GST verification provider URL must use HTTPS'), 'Production GST provider URLs must be HTTPS protected.');
assert(!gstVerificationRoute.includes("fetch('https://services.gst.gov.in"), 'FabricTrad must not scrape or bypass the official GST captcha.');
assert(sellerRegistration.includes('Open official GST Portal'), 'Seller onboarding must expose the free official GST reference.');
assert(sellerRegistration.includes('Select the business type before continuing.'), 'Seller onboarding must give a precise business-type error.');
assert(sellerRegistration.includes('readOnly aria-readonly="true"'), 'Seller PAN derived from GSTIN must not be accidentally edited.');
assert(buyerRegistration.includes('Open official GST Portal'), 'Business buyer onboarding must expose the free official GST reference.');
assert(buyerRegistration.includes('panFromGstin'), 'Registered business buyer PAN should be derived from the GSTIN when PAN verification is selected.');
assert(environmentExample.includes('GSTIN_VERIFICATION_API_URL='), 'Environment example must document the optional authorised GST provider.');
assert(gstVerificationDocs.includes('captcha-protected') && gstVerificationDocs.includes('payment-gateway'), 'GST documentation must distinguish the free manual portal from payment infrastructure.');
assert(gstVerificationDocs.includes('GST Suvidha Providers'), 'GST documentation must explain the authorised GSP option.');

console.log('OAuth, email, GST reference, password recovery, administrator password access and seller verification regression checks passed.');
