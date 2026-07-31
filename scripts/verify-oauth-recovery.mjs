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

console.log('OAuth account recovery regression checks passed.');
