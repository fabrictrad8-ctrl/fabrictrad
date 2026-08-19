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

const register = 'src/app/register/page.tsx';
const entry = 'src/app/buyer-registration/components/BuyerRegistrationEntry.tsx';
const quick = 'src/app/buyer-registration/components/PersonalBuyerQuickSignup.tsx';
const retail = 'src/app/buyer-registration/components/RetailBuyerAccountStart.tsx';
const seller = 'src/app/seller-registration/components/SellerRegistrationEntry.tsx';
const buyerFinalize = 'src/app/api/registration/buyer/finalize/route.ts';
const preflight = 'src/app/api/auth/registration-preflight/route.ts';
const supabaseClient = 'src/lib/supabase/client.tsx';
const migration = 'supabase/migrations/20260820043500_account_auth_policy_performance.sql';

[register, entry, quick, retail, seller, buyerFinalize, preflight, supabaseClient, migration].forEach(read);

// The registration landing page must link directly to the intended buyer type
// instead of forcing everyone through another chooser screen.
requireText(register, '/buyer-registration?type=end_user');
requireText(register, '/buyer-registration?type=retail_store');
requireText(register, 'Fastest · no documents');

// Personal buying is deliberately a separate, lightweight path.
requireText(entry, "import PersonalBuyerQuickSignup from './PersonalBuyerQuickSignup'");
requireText(entry, "import RetailBuyerAccountStart from './RetailBuyerAccountStart'");
requireText(entry, 'isAuthenticatedAccount');
requireText(quick, 'Create account & start shopping');
requireText(quick, 'Add a delivery address when you actually place an order.');
requireText(quick, '/api/auth/registration-preflight');
requireText(quick, "buyerType: 'end_user'");
forbidText(quick, 'confirmPassword');
forbidText(quick, 'PAN number');
forbidText(quick, 'GSTIN');

// Business users get a real login before KYC. Their verification may be more
// detailed, but account creation itself must stay short and recoverable.
requireText(retail, 'Create account & continue KYC');
requireText(retail, '/api/auth/registration-preflight');
requireText(retail, '/buyer-registration?type=retail_store&resume=1');
requireText(retail, '/login?next=%2Fbuyer-registration%3Ftype%3Dretail_store%26resume%3D1');
forbidText(retail, 'confirmPassword');
requireText(seller, 'Create account & continue verification');
requireText(seller, '/api/auth/registration-preflight');
requireText(seller, "requestedRole: 'seller'");
forbidText(seller, 'confirmPassword');
forbidText(seller, 'checkEmailUnique');
forbidText(seller, 'checkPhoneUnique');

// FabricTrad is one account with multiple commerce capabilities. A seller must
// be able to upgrade the buyer side of the same login to Retail Store instead
// of being rejected and pushed toward a duplicate account.
requireText(buyerFinalize, 'same authenticated account may upgrade its buyer');
forbidText(buyerFinalize, "user.user_metadata?.role === 'seller'");

// Anonymous registration must not pretend a protected client-side RPC worked.
// The server validates the request and performs the conflict lookup with the
// server-only Supabase client in one registration preflight.
requireText(preflight, 'createAdminClient');
requireText(preflight, "input_email: email, input_phone: phone");
requireText(preflight, 'emailUsed');
requireText(preflight, 'phoneUsed');

// Reuse one browser Supabase client and keep the hottest account RLS checks in
// init-plan form so route changes do not multiply auth work unnecessarily.
requireText(supabaseClient, '_browserClient');
requireText(supabaseClient, 'if (!_browserClient) _browserClient = buildClient()');
requireText(migration, 'id = (select auth.uid())');
requireText(migration, 'user_id = (select auth.uid())');

if (failures.length) {
  console.error(`Registration UX verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.info('Fast personal signup, account-first business signup, one-account upgrades, identity preflight and auth bootstrap safeguards passed.');
