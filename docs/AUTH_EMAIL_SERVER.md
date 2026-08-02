# FabricTrad authentication SMTP server

FabricTrad sends administrator OTP and buyer/seller password-recovery messages through authenticated SMTP over implicit TLS. Supabase Auth still generates and validates every one-time token; FabricTrad only controls delivery so the administrator receives a six-digit code instead of a magic link.

The Worker contains a small SMTP client built on `node:tls`, so no browser-visible credential or third-party JavaScript SDK is used. Only ports 465 and 2465 are accepted.

## Recommended provider: Cloudflare Email Service

FabricTrad already runs on Cloudflare and uses Cloudflare DNS, so the recommended production SMTP endpoint is Cloudflare Email Service:

```text
SMTP_HOST=smtp.mx.cloudflare.net
SMTP_PORT=465
SMTP_USER=api_token
SMTP_PASS=<Cloudflare API token with Email Sending: Edit>
SMTP_EHLO_NAME=fabrictrad.com
FABRICTRAD_AUTH_EMAIL_FROM=FabricTrad <auth@fabrictrad.com>
FABRICTRAD_AUTH_EMAIL_REPLY_TO=fabrictrad8@gmail.com
```

Before the token can send mail, onboard `fabrictrad.com` or a dedicated subdomain such as `auth.fabrictrad.com` under **Cloudflare Dashboard → Compute → Email Service → Email Sending**. Cloudflare adds the required SPF, DKIM, bounce-domain and DMARC DNS records. The sender address must belong to the onboarded domain.

`SMTP_PASS` is a secret. Store it only in the Cloudflare Worker production secrets and never commit it or expose it as a `NEXT_PUBLIC_` value.

## Alternative provider: Resend SMTP

```text
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<Resend API key>
SMTP_EHLO_NAME=fabrictrad.com
FABRICTRAD_AUTH_EMAIL_FROM=FabricTrad <auth@updates.fabrictrad.com>
FABRICTRAD_AUTH_EMAIL_REPLY_TO=fabrictrad8@gmail.com
```

The sending domain must be verified in Resend first. For backwards compatibility, setting `RESEND_API_KEY` without the SMTP variables automatically selects `smtp.resend.com:465` with username `resend`; delivery still uses SMTP, not the Resend HTTP API.

## Message flows

- `/api/auth/admin-otp/request` verifies the configured active administrator profile, applies database rate limits, uses the Supabase service-role client to generate a real six-digit `email_otp`, and sends only that code through SMTP.
- The admin page verifies the submitted code using `supabase.auth.verifyOtp({ email, token, type: 'email' })` and then opens `/admin-portal`.
- `/admin-portal` performs the authoritative server-side check for an active `super_admin` or `admin_staff` profile before showing operational data.
- `/api/auth/email-otp/request` generates a Supabase recovery-purpose action link for buyer/seller password recovery and sends it through the same SMTP transport. It never sends a marketplace sign-in link.

## Abuse and security controls

- A 60-second resend cooldown is enforced in the database.
- Administrator OTP delivery is capped at 20 messages per UTC day.
- Password recovery is capped at five messages per address per UTC day.
- SMTP uses implicit TLS from connection start.
- Credentials are read only from server-side environment variables.
- Header values are rejected when they contain CR/LF characters.
- Email bodies use MIME base64 encoding and SMTP dot-stuffing.
- OTP values and SMTP passwords are never written to application logs.

## Production verification

1. Request a code from `/admin-login`.
2. Confirm the message subject is **Your FabricTrad administrator code** and the body contains six digits, not a link.
3. Enter the code and confirm it opens `/admin-portal` only for the configured active administrator.
4. Enter an incorrect code and confirm access is denied.
5. Request another code before 60 seconds and confirm the rate-limit message appears.
6. Check the SMTP provider delivery log and Supabase Auth log without recording the token value.
7. Test buyer/seller **Forgot password?** and confirm it opens only the new-password page.
