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
const passwordResetRequest = read('src/app/api/auth/password-reset-otp/request/route.ts');
const accountLogin = read('src/app/login/EmailOtpLoginClient.tsx');
const accountHome = read('src/app/account/page.tsx');
const workspaceStatus = read('src/app/api/account/workspace-status/route.ts');
const commerceHeader = read('src/components/Header.tsx');
const headerReflow = read('src/styles/header-reflow.css');
const adminOtpRequest = read('src/app/api/auth/admin-otp/request/route.ts');
const authEmailDocs = read('docs/AUTH_EMAIL_SERVER.md');
const environmentExample = read('.env.example');
const wrangler = read('wrangler.jsonc');
const adminLogin = read('src/app/admin-login/AdminLoginClient.tsx');
const adminPortal = read('src/app/admin-portal/page.tsx');
const adminLayout = read('src/app/admin-portal/components/AdminPortalLayout.tsx');
const adminOverview = read('src/app/api/admin/overview/route.ts');
const adminSearch = read('src/app/api/admin/search/route.ts');
const adminCustomers = read('src/app/admin-portal/components/AdminCustomers.tsx');
const adminProductReview = read('src/app/api/admin/products/[id]/review/route.ts');
const adminListings = read('src/app/admin-portal/components/AdminListings.tsx');
const buyerLayout = read('src/app/buyer-dashboard/components/ModernBuyerDashboardLayout.tsx');
const sellerLayout = read('src/app/seller-dashboard/components/SellerDashboardLayout.tsx');
const buyerOrders = read('src/app/buyer-dashboard/components/BuyerOrders.tsx');
const buyerCatalogOrders = read('src/app/buyer-dashboard/components/BuyerCatalogOrders.tsx');
const sellerCatalogOrders = read('src/app/seller-dashboard/components/SellerCatalogOrders.tsx');
const orderDocuments = read('src/lib/orderDocuments.ts');
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
assert(callback.includes('provisionAuthenticatedAccountWithRecovery'), 'OAuth callback must use authenticated provisioning with scoped recovery.');
assert(callback.includes('/auth/setup'), 'OAuth callback must preserve the session through a recovery screen.');
assert(endpoint.includes('profile_setup_failed'), 'Provisioning endpoint needs a stable recovery error code.');
assert(migration.includes('security definer'), 'Recovery function must be SECURITY DEFINER.');
assert(migration.includes('grant execute') && migration.includes('to authenticated'), 'Only authenticated users may call recovery.');
assert(recoveryUi.includes('Session preserved') && recoveryUi.includes('aria-live'), 'Recovery UI must preserve and announce session status.');

// Buyer and seller password recovery uses a non-enumerating Supabase email OTP,
// verifies that OTP on the client, and only then allows the signed-in recovery
// session to update the password. It must never create accounts or require an
// application-side SMTP/admin key.
assert(passwordResetRequest.includes('signInWithOtp'), 'Forgot password must request a Supabase email OTP.');
assert(passwordResetRequest.includes('shouldCreateUser: false'), 'Password recovery must never create a new account.');
assert(!passwordResetRequest.includes('auth.admin.generateLink'), 'Password recovery must not require a privileged Supabase key.');
assert(!passwordResetRequest.includes('SMTP_PASS'), 'Password recovery must not require a Cloudflare SMTP secret.');
assert(passwordResetRequest.includes("method: 'email_otp'"), 'Recovery endpoint must identify the email OTP purpose.');
assert(accountLogin.includes("fetch('/api/auth/password-reset-otp/request'"), 'Account login must request the password-reset OTP endpoint.');
assert(accountLogin.includes('verifyEmailOtp(normalizedEmail, otp)'), 'Recovery must verify the OTP against the requested email.');
assert(accountLogin.includes('updatePassword(newPassword)'), 'Recovery must update the password only after OTP verification.');
assert(accountLogin.includes('Send OTP to email'), 'Account login must expose the email OTP recovery action.');
assert(accountLogin.includes('One account for textile commerce'), 'Sign-in must present one unified buyer and seller account.');
assert(
  accountLogin.includes("role === 'admin_staff' || role === 'super_admin'") &&
    accountLogin.includes("? '/admin-portal'") &&
    accountLogin.includes("role === 'seller'") &&
    accountLogin.includes("? '/account'") &&
    accountLogin.includes(": '/marketplace'"),
  'Buyer accounts must open the marketplace while administrators retain the admin portal.'
);
assert(!accountLogin.includes("type LoginRole = 'buyer' | 'seller'"), 'Login must not require the user to choose a duplicate buyer/seller identity.');
assert(middleware.includes("'/auth/reset-password'"), 'The public recovery page must load before browser auth tokens are persisted.');

// Unified account, role-specific verification and explicit workspace switching.
assert(accountHome.includes('One account · separate workspaces'), 'Account home must explain buyer and seller workspace separation.');
assert(accountHome.includes("profile?.can_buy ?? (profile?.role === 'buyer' || profile?.role === 'seller')"), 'Account home must resolve buyer capability safely.');
assert(accountHome.includes("window.location.replace('/login')"), 'Unified account home must provide reliable logout.');
assert(accountHome.includes("fetch('/api/account/workspace-status'"), 'Account home must load role-specific verification state.');
assert(
  accountHome.includes("href: workspaceStatusReady && !buyerVerified ? '/buyer-registration' : undefined") &&
    accountHome.includes("href: workspaceStatusReady && !sellerVerified ? '/seller-registration' : undefined"),
  'Completed buyer and seller verification rows must not route back into onboarding.'
);
assert(
  workspaceStatus.includes("buyer?.buyer_type === 'end_user'") &&
    workspaceStatus.includes('business_kyc_status') &&
    workspaceStatus.includes("seller?.verification_status === 'verified'"),
  'Workspace status must resolve buyer and seller verification independently.'
);
assert(
  commerceHeader.includes("type Workspace = 'public' | 'buyer' | 'seller' | 'account' | 'admin'") &&
    commerceHeader.includes("const buyerContext = activeWorkspace === 'buyer'") &&
    commerceHeader.includes("const sellerContext = activeWorkspace === 'seller'") &&
    commerceHeader.includes("buyerContext && canBuy") &&
    commerceHeader.includes("sellerContext && canSell"),
  'Commerce header actions must stay inside the active buyer or seller workspace.'
);
assert(
  headerReflow.includes('margin-left: 0 !important') &&
    headerReflow.includes('minmax(160px, max-content)'),
  'Commerce header must reserve brand space so Marketplace never overlaps the FabricTrad logo.'
);

// Catalogue order joins must identify the intended foreign key because an order can also
// reference a separate fulfillment variant after inventory reservation.
const orderVariantRelationship =
  'seller_product_variants!catalog_order_requests_variant_id_fkey(color_name,design_name)';
const orderProductRelationship = 'seller_products!catalog_order_requests_product_id_fkey';
assert(
  buyerCatalogOrders.includes(orderVariantRelationship) &&
    sellerCatalogOrders.includes(orderVariantRelationship),
  'Buyer and seller catalogue orders must disambiguate the requested variant relationship.'
);
assert(
  buyerCatalogOrders.includes(orderProductRelationship) &&
    sellerCatalogOrders.includes(orderProductRelationship),
  'Buyer and seller catalogue orders must use the explicit product relationship.'
);

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
assert(adminLogin.includes('Administrator email OTP'), 'Administrator UI must provide a numeric OTP input.');
assert(adminLogin.includes('MIN_EMAIL_OTP_LENGTH = 6'), 'Administrator UI must accept the minimum supported Supabase OTP length.');
assert(adminLogin.includes('MAX_EMAIL_OTP_LENGTH = 10'), 'Administrator UI must accept the maximum supported Supabase OTP length.');
assert(adminLogin.includes('EMAIL_OTP_PATTERN = /^\\d{6,10}$/'), 'Administrator UI must validate the full configurable OTP range.');
assert(adminLogin.includes('pattern="[0-9]{6,10}"'), 'Administrator OTP input must expose the correct browser validation pattern.');
assert(!adminLogin.includes('token.length !== 6'), 'Administrator OTP verification must not be hard-coded to six digits.');
assert(adminLogin.includes('verifyEmailOtp'), 'Administrator UI must validate the OTP with Supabase Auth.');
assert(adminLogin.includes("window.location.replace('/admin-portal')"), 'Successful OTP verification must open the admin portal.');
assert(adminPortal.includes("redirect('/admin-login')"), 'Unauthenticated administrator access must return to admin login.');
assert(adminPortal.includes('profile?.is_active === true'), 'The server must require an active administrator profile.');
assert(adminPortal.includes("profile.role === 'super_admin'") && adminPortal.includes("profile.role === 'admin_staff'"), 'The server must require an administrator role.');
assert(!adminPortal.includes('authorisedByEmail'), 'A matching email alone must never grant administrator access.');

// Shopify-style administration must be live and actionable, not placeholder UI.
assert(adminLayout.includes('AdminCommandSearch'), 'Administrator shell must include global command search.');
assert(adminLayout.includes('AdminCustomers'), 'Administrator shell must include customer management.');
assert(adminLayout.includes('ProfileMenu'), 'Administrator shell must expose the authenticated account menu.');
assert(adminLayout.includes("window.location.replace('/admin-login')"), 'Administrator shell must provide reliable logout.');
assert(adminOverview.includes("from('orders')") && adminOverview.includes("from('payments')"), 'Administrator home must use live order and payment data.');
assert(adminOverview.includes("from('seller_products')") && adminOverview.includes("from('seller_profiles')"), 'Administrator home must use live seller and product data.');
assert(adminSearch.includes("from('user_profiles')") && adminSearch.includes("from('seller_products')"), 'Global search must query real account and product records.');
assert(adminCustomers.includes("from('user_profiles')"), 'Customer management must use live profile records.');
assert(adminListings.includes("from('seller_products')"), 'Product review must use live seller products.');
assert(!adminListings.includes('const listings:'), 'Product review must not use an empty placeholder array.');
assert(adminProductReview.includes("payload.action === 'approve'"), 'Product review endpoint must implement approval.');
assert(adminProductReview.includes('seller.gstin_verified !== true'), 'Product approval must require seller GST verification.');

// Buyer and seller workspaces must provide persistent navigation and logout.
assert(buyerLayout.includes('ProfileMenu'), 'Buyer workspace must include the account menu.');
assert(buyerLayout.includes("window.location.replace('/login')"), 'Buyer workspace must provide reliable logout.');
assert(!buyerLayout.includes("canSell ? '/seller-dashboard' : '/seller-registration'"), 'Buyer workspace must not switch into seller operations while signed in.');
assert(!buyerLayout.includes('Open seller workspace') && !buyerLayout.includes('Activate selling'), 'Buyer navigation must remain buyer-specific.');
assert(sellerLayout.includes('ProfileMenu'), 'Seller workspace must include the account menu.');
assert(sellerLayout.includes("window.location.replace('/login')"), 'Seller workspace must provide reliable logout.');
assert(!sellerLayout.includes("href=\"/buyer-dashboard\""), 'Seller workspace must not switch into buyer tools while signed in.');
assert(!sellerLayout.includes('Buyer workspace') && !sellerLayout.includes('> Buy fabrics'), 'Seller navigation must remain seller-specific.');

// Printable commerce documents must not be misrepresented as tax invoices.
assert(buyerOrders.includes('openPrintableOrderDocument'), 'Buyer orders must open a branded printable document.');
assert(!buyerOrders.includes("type: 'text/plain;charset=utf-8'"), 'Buyer orders must not download a plain-text receipt.');
assert(buyerOrders.includes('seller-issued GST tax invoice') || buyerOrders.includes('GST tax invoice is issued by the seller'), 'Buyer orders must distinguish the seller tax invoice from platform documents.');
assert(orderDocuments.includes('Print / Save PDF'), 'Printable order documents must support browser PDF saving.');
assert(orderDocuments.includes('It is not the seller’s GST tax invoice'), 'Payment receipts must not be mislabelled as GST tax invoices.');
assert(orderDocuments.includes('This document is an order summary and is not a GST tax invoice'), 'Order summaries must include the legal document distinction.');

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

console.log('Unified account, workspace isolation, live admin operations, logout, printable commerce documents, email OTP, GST and seller verification checks passed.');