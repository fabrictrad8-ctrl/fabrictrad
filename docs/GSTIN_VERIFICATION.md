# FabricTrad GSTIN verification

## What is free

The Government GST Portal provides **Search Taxpayer** without login for basic GSTIN details. A user enters the GSTIN and completes the portal captcha. The result can show the legal name, trade name, registration date, taxpayer type, principal place of business and GSTIN status.

Official reference: `https://services.gst.gov.in/services/searchtp`

The search itself is free. It is not a payment-gateway feature and FabricTrad must not claim that a checksum-valid GSTIN is officially Active.

## Why FabricTrad cannot silently automate the free portal

The public Search Taxpayer flow is captcha-protected. FabricTrad links users and reviewers to the official portal, but does not scrape, bypass or automate the captcha. When no authorised API is configured, a checksum-valid GSTIN is stored as `manual_review`, the seller may continue onboarding and upload the GST certificate, and live publishing remains locked until an authorised reviewer confirms Active status.

## Optional automatic verification

GSTN supports third-party applications through authorised GST Suvidha Providers (GSPs). Commercial terms, quotas and pricing are set by the chosen provider; do not describe a provider integration as free unless its written plan explicitly says so.

Configure the existing provider adapter with server-only values:

```text
GSTIN_VERIFICATION_API_URL=https://provider.example/verify/{gstin}
GSTIN_VERIFICATION_API_KEY=<server-only key>
GSTIN_VERIFICATION_API_METHOD=GET
GSTIN_VERIFICATION_API_KEY_HEADER=x-api-key
GSTIN_VERIFICATION_PROVIDER_NAME=<authorised provider name>
```

The URL must use HTTPS in production. Provider credentials must never use a `NEXT_PUBLIC_` prefix.

## Launch behaviour

- Invalid format or checksum: reject immediately.
- Authorised provider returns Active: save legal/trade details and mark verified.
- Provider returns inactive, suspended or cancelled: prevent seller onboarding from proceeding.
- Provider absent or unavailable: show the free official portal reference and save as manual review.
- Manual review: drafts are allowed; live listings and settlements remain locked.
- GST remains applicable. A verified GSTIN supports correct B2B invoice details; it does not make the transaction tax-free.
