# FabricTrad authentication email

FabricTrad delegates authentication email delivery directly to Supabase Auth using Resend as the custom SMTP provider. This is simpler than relaying mail through the Cloudflare Worker and does not require `SMTP_PASS` or `SUPABASE_SECRET_KEY` in Cloudflare for administrator OTP delivery.

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

## Administrator OTP template

Open **Authentication → Email Templates → Magic Link** and replace the link-based body with a numeric-code template that contains `{{ .Token }}` and does not contain `{{ .ConfirmationURL }}`.

Suggested subject:

```text
Your FabricTrad administrator code
```

Suggested body:

```html
<h2>Your FabricTrad administrator code</h2>
<p>Enter this one-time code on the FabricTrad administrator login page:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px">{{ .Token }}</p>
<p>This code expires shortly and can be used only once.</p>
```

Supabase sends a numeric OTP when the Magic Link/OTP template contains `{{ .Token }}`. FabricTrad requests it with `signInWithOtp({ shouldCreateUser: false })` and validates it with `verifyOtp({ email, token, type: 'email' })`.

## Buyer and seller password recovery

The buyer/seller **Forgot password?** endpoint uses `resetPasswordForEmail` and Supabase's Recovery template. Keep the Recovery template as a password-reset message and ensure it points to the generated `{{ .ConfirmationURL }}`. It must not describe the link as a marketplace sign-in.

## Security boundary

- The administrator request endpoint accepts only the configured administrator email.
- `shouldCreateUser: false` prevents OTP requests from creating accounts.
- Supabase applies email send rate limits.
- `/admin-portal` independently requires an authenticated, active `super_admin` or `admin_staff` profile.
- Resend credentials remain only inside Supabase's encrypted SMTP settings.
- No Resend credential or Supabase privileged key is required in Cloudflare for these email flows.

## Production verification

1. Request an OTP from `/admin-login`.
2. Confirm the email body contains a numeric code and no sign-in link.
3. Enter the code and confirm `/admin-portal` opens.
4. Enter an incorrect code and confirm access is denied.
5. Test buyer/seller **Forgot password?** and confirm it opens the new-password page rather than logging the person into the marketplace.
6. Review Supabase Auth logs and Resend delivery logs when a message is delayed or rejected.
