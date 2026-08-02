-- Remove the abandoned Cloudflare email-delivery bridge. Authentication email
-- delivery now uses the server-only Resend integration and claim_auth_email_delivery.
drop function if exists public.verify_and_claim_admin_otp_delivery(text, text, uuid, timestamptz);
drop function if exists public.sign_admin_otp_delivery(text);
drop function if exists public.claim_admin_otp_delivery(text);

drop table if exists public.admin_otp_delivery_nonces;
drop table if exists public.admin_otp_delivery_secrets;
drop table if exists public.admin_otp_delivery_state;
