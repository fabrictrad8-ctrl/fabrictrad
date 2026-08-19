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
const preflight = 'src/app/api/auth/registration-preflight/route.ts';
const supabaseClient = 'src/lib/supabase/client.tsx';
const migration = 'supabase/migrations/20260820043500_account_auth_policy_performance.sql';

[register, entry, quick, preflight, supabaseClient, migration].forEach(read);

// The registration landing page must link directly to the intended buyer type
// instead of forcing everyone through another chooser screen.
requireText(register, '/buyer-registration?type=end_user');
requireText(register, '/buyer-registration?type=retail_store');
requireText(register, 'Fastest · no documents');

// Personal buying is deliberately a separate, lightweight path.
requireText(entry, "import PersonalBuyerQuickSignup from './PersonalBuyerQuickSignup'");
requireText(entry, "buyerType === 'end_user'");
requireText(quick, 'Create account & start shopping');
requireText(quick, 'Add a delivery address when you actually place an order.');
requireText(quick, '/api/auth/registration-preflight');
requireText(quick, "buyerType: 'end_user'");
forbidText(quick, 'confirmPassword');
forbidText(quick, 'PAN number');
forbidText(quick, 'GSTIN');

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

console.info('Fast personal signup, reliable identity preflight and auth bootstrap safeguards passed.');
