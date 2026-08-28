import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, 'verify-oauth-recovery.mjs');
const patchedPath = join(here, '.verify-oauth-recovery-current.generated.mjs');

const staleAssertion = "assert(callback.includes('ensureAuthenticatedAccountProvisioned'), 'OAuth callback must use authenticated provisioning.');";
const currentAssertion = [
  "assert(",
  "  callback.includes('provisionAuthenticatedAccountWithRecovery'),",
  "  'OAuth callback must use the recovery-safe authenticated provisioner.'",
  ");",
  "assert(",
  "  callback.includes('configuredAdminEmail') && callback.includes('admin_otp_required') && callback.includes('signOut'),",
  "  'OAuth callback must reject administrator sessions and require the dedicated OTP flow.'",
  ");",
].join('\n');

const source = readFileSync(sourcePath, 'utf8');
if (!source.includes(staleAssertion)) {
  throw new Error('OAuth verification source changed; update the compatibility verifier instead of silently skipping the contract.');
}

const patched = source.replace(staleAssertion, currentAssertion);
writeFileSync(patchedPath, patched, 'utf8');

try {
  await import(`${pathToFileURL(patchedPath).href}?t=${Date.now()}`);
} finally {
  try {
    unlinkSync(patchedPath);
  } catch {
    // Best-effort cleanup only; the generated path is git-ignored by virtue of being runtime-only.
  }
}
