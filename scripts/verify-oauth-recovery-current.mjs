import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, 'verify-oauth-recovery.mjs');
const patchedPath = join(here, '.verify-oauth-recovery-current.generated.mjs');

const replacements = [
  [
    "const passwordResetRequest = read('src/app/api/auth/email-otp/request/route.ts');",
    "const passwordResetRequest = read('src/app/api/auth/password-reset-otp/request/route.ts');",
  ],
  [
    "const passwordResetPage = read('src/app/auth/reset-password/page.tsx');",
    "const passwordResetPage = read('src/app/login/EmailOtpLoginClient.tsx');",
  ],
  [
    "assert(callback.includes('ensureAuthenticatedAccountProvisioned'), 'OAuth callback must use authenticated provisioning.');",
    [
      "assert(",
      "  callback.includes('provisionAuthenticatedAccountWithRecovery'),",
      "  'OAuth callback must use the recovery-safe authenticated provisioner.'",
      ");",
      "assert(",
      "  callback.includes('configuredAdminEmail') && callback.includes('admin_otp_required') && callback.includes('signOut'),",
      "  'OAuth callback must reject administrator sessions and require the dedicated OTP flow.'",
      ");",
    ].join('\n'),
  ],
  [
    "assert(passwordResetRequest.includes('resetPasswordForEmail'), 'Forgot password must use Supabase password recovery.');",
    "assert(passwordResetRequest.includes('signInWithOtp') && passwordResetRequest.includes('shouldCreateUser: false'), 'Forgot password must issue a Supabase email OTP without creating users.');",
  ],
  [
    "assert(passwordResetRequest.includes('/auth/reset-password'), 'Recovery email must return to the new-password screen.');",
    "assert(passwordResetRequest.includes(\"method: 'email_otp'\"), 'Password recovery must identify the numeric email OTP method.');",
  ],
  [
    "assert(!passwordResetRequest.includes('signInWithOtp'), 'Forgot password must never send a passwordless sign-in email.');",
    "assert(passwordResetRequest.includes('persistSession: false') && passwordResetRequest.includes('detectSessionInUrl: false'), 'Public OTP requests must not create a server-side persistent session.');",
  ],
  [
    "assert(passwordResetRequest.includes(\"method: 'password_recovery'\"), 'Recovery endpoint must identify the correct email purpose.');",
    "assert(passwordResetRequest.includes('configuredAdminEmail') && passwordResetRequest.includes('acceptedResponse'), 'Password recovery must keep administrator handling non-enumerating and isolated.');",
  ],
  [
    "assert(passwordResetPage.includes('updatePassword(password)'), 'Recovery screen must save the new password through Supabase Auth.');",
    "assert(passwordResetPage.includes('verifyEmailOtp(normalizedEmail, otp)') && passwordResetPage.includes('updatePassword(newPassword)'), 'Recovery screen must verify the email OTP before saving the new password.');",
  ],
  [
    "assert(accountLogin.includes('Send password reset email'), 'Account login must request a recovery email.');",
    "assert(accountLogin.includes(\"fetch('/api/auth/password-reset-otp/request'\") && accountLogin.includes(\"payload.method !== 'email_otp'\"), 'Account login must request and validate the numeric password-reset OTP flow.');",
  ],
];

let patched = readFileSync(sourcePath, 'utf8');
for (const [before, after] of replacements) {
  if (!patched.includes(before)) {
    throw new Error(`OAuth verification source changed; expected contract marker was not found: ${before}`);
  }
  patched = patched.replace(before, after);
}

writeFileSync(patchedPath, patched, 'utf8');

try {
  await import(`${pathToFileURL(patchedPath).href}?t=${Date.now()}`);
} finally {
  try {
    unlinkSync(patchedPath);
  } catch {
    // Best-effort cleanup only; the generated path is runtime-only.
  }
}
