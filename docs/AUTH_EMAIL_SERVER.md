# FabricTrad authentication email server

FabricTrad sends administrator OTP and buyer/seller password-recovery messages through the Resend HTTPS API. Supabase Auth still generates and validates every one-time token; the application-owned email server replaces Supabase's hosted magic-link template.

## Required production configuration

1. Create a Resend account and add the sending subdomain `updates.fabrictrad.com`.
2. Add the SPF and DKIM DNS records shown by Resend, then wait until the domain is verified.
3. Create a sending-only Resend API key.
4. Add these Cloudflare Worker settings:

```text
RESEND_API_KEY=<secret>
FABRICTRAD_AUTH_EMAIL_FROM=FabricTrad <auth@updates.fabrictrad.com>
FABRICTRAD_AUTH_EMAIL_REPLY_TO=support@fabrictrad.com
```

`RESEND_API_KEY` must be stored as a secret and must never be committed or exposed as a `NEXT_PUBLIC_` variable.

## Message flows

- `/api/auth/admin-otp/request` uses the Supabase service-role client to generate a real six-digit `email_otp`, then sends the code through Resend. The code is still verified by Supabase Auth on the browser.
- `/api/auth/email-otp/request` generates a one-time Supabase recovery action link, then sends a branded password-reset message through Resend. The link opens `/auth/reset-password`; it does not open the marketplace.
- Unknown, inactive and administrator accounts do not receive buyer/seller recovery messages.

## Abuse controls

The database function `claim_auth_email_delivery` enforces a 60-second cooldown. Administrator OTP delivery is capped at 20 messages per UTC day; password recovery is capped at five messages per address per UTC day. The rate-limit table has RLS enabled and is inaccessible to anonymous and authenticated browser clients.

## Verification

After deployment:

1. Request an administrator code from `/admin-login` and confirm the message subject is `Your FabricTrad administrator code` and contains six digits rather than a sign-in link.
2. Use **Forgot password?** from buyer and seller login and confirm the message subject is `Reset your FabricTrad password`.
3. Confirm the recovery button opens `/auth/reset-password` and never opens the marketplace directly.
4. Check Resend delivery logs and Supabase Auth logs for failures without logging OTP values or recovery links.
