# FabricTrad authentication email

FabricTrad delegates authentication email delivery directly to Supabase Auth using Resend as the custom SMTP provider. This is simpler than relaying mail through the Cloudflare Worker and does not require `SMTP_PASS` or `SUPABASE_SECRET_KEY` in Cloudflare for email OTP delivery.

## Supabase custom SMTP

Open **Supabase Dashboard → Authentication → SMTP Settings**, enable custom SMTP and enter:

```text
Sender name: FabricTrad
Sender email: auth@fabrictrad.com
Host: smtp.resend.com
Port: 465
Username: resend
Password: the existing Resend API key
```

The `fabrictrad.com` domain must be verified in Resend. Port 465 uses implicit TLS.

## Shared numeric email OTP template

Administrator sign-in and buyer/seller password recovery both use Supabase email OTP. Open **Authentication → Email Templates → Magic Link** and use a numeric-code template that contains `{{ .Token }}` and does not contain `{{ .ConfirmationURL }}`.

Because this template is shared by both flows, keep the wording generic rather than administrator-specific.

Suggested subject:

```text
Your FabricTrad verification code
```

Suggested body:

```html
<h2>Your FabricTrad verification code</h2>
<p>Enter this one-time code on the FabricTrad screen where you requested it:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px">{{ .Token }}</p>
<p>This code expires shortly and can be used only once. If you did not request it, you can ignore this email.</p>
```

Supabase sends a numeric OTP when the Magic Link/OTP template contains `{{ .Token }}`. FabricTrad requests it with `signInWithOtp({ shouldCreateUser: false })` and validates it with `verifyOtp({ email, token, type: 'email' })`.

## Buyer and seller password recovery

The buyer/seller **Forgot password?** flow is now an explicit three-step recovery process:

1. The user enters the registered email and FabricTrad requests a Supabase email OTP with `shouldCreateUser: false`.
2. The user enters the numeric OTP. FabricTrad verifies it with Supabase before showing any password fields.
3. After verification creates the authenticated recovery session, the user enters **New password** and **Confirm new password**. FabricTrad calls Supabase `updateUser({ password })`, signs the recovery session out, and returns the user to sign-in.

The public request endpoint intentionally avoids revealing whether an email address is registered. Demo account passwords cannot be reset. Administrator access remains isolated on `/admin-login` and does not use a password.

The previous link-based `resetPasswordForEmail` endpoint remains available as a compatibility fallback for already-issued recovery links, but the account sign-in UI uses the OTP flow.

## Security boundary

- The administrator OTP request endpoint accepts only the configured administrator email.
- Buyer/seller password-reset OTP requests use `shouldCreateUser: false`, so recovery never creates a new account.
- The OTP must be verified before the new-password form is shown.
- The verified email must match the email being recovered.
- Supabase applies email send rate limits.
- `/admin-portal` independently requires an authenticated, active `super_admin` or `admin_staff` profile.
- Resend credentials remain only inside Supabase's encrypted SMTP settings.
- No Resend credential or Supabase privileged key is required in Cloudflare for these email flows.

## Production verification

1. Request an OTP from `/admin-login`.
2. Confirm the email body contains a numeric code and no sign-in link.
3. Enter the code and confirm `/admin-portal` opens.
4. Enter an incorrect administrator code and confirm access is denied.
5. From `/login`, select **Forgot password?**, enter a registered buyer/seller email, and confirm a numeric OTP email arrives.
6. Confirm an incorrect or expired recovery OTP cannot expose the new-password form.
7. Enter the correct recovery OTP, set and confirm a new password, and confirm the recovery session signs out.
8. Sign in with the newly set password and confirm the old password no longer works.
9. Review Supabase Auth logs and Resend delivery logs when a message is delayed or rejected.
