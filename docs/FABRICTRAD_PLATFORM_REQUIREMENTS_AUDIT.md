# FabricTrad platform requirements audit

Last reviewed: 2026-08-23

This document maps the intended FabricTrad business/commerce model to the implemented system. It is an engineering/product control document, not legal or tax advice.

## Product architecture decisions

| Requirement | Current position | Required operating decision |
|---|---|---|
| AI virtual drape | Implemented as interactive procedural 3D woman/man avatar plus OpenAI personal-photo image try-on using live seller textile media | Describe accurately. This is not yet 3D reconstruction of the buyer from one selfie. |
| Virtual try-on price ₹10/image | Not enforced as a paid-per-generation commerce flow | Add a dedicated paid AI-generation entitlement before describing every generation as ₹10. Existing `drape_usage` is quota/usage tracking, not a complete payment product. |
| Seller GST | Live listing gate requires verified GSTIN | Treat this as FabricTrad platform eligibility. Do not state that GST registration is universally compulsory for every online seller under every fact pattern. |
| No COD | Implemented marketplace payment/shipping flow is prepaid | Keep COD disabled. Courier creation must remain `Prepaid`. |
| 100% before dispatch | Implemented: shipment creation requires fully paid order | Deposits/balances can exist, but shipment remains locked until full payment is reconciled. |
| No return / damage exchange | Needs legally careful wording | Use `no change-of-mind return` where disclosed; retain exchange/refund/dispute remedies for damaged, incorrect, defective, deficient, spurious or materially not-as-described goods and any non-waivable legal remedy. Target damage evidence within 24 hours; request unboxing video without using it to erase statutory rights. |
| Buyer/Seller agreements | Added | Keep separate Buyer Agreement, Seller Agreement, Terms, Privacy, and Returns & Exchanges Policy linked in footer/onboarding. |
| Commission | Implemented in payment ledgers | Keep platform commission itemised. |
| Gateway fees | Implemented/recorded in payment ledgers | Prefer actual provider fee/tax after capture over estimate when available. |
| Statutory GST TCS / 194-O TDS | Ledger fields added, automated deduction not activated | CA/legal sign-off required before rate/exemption engine is activated. Keep statutory deductions separate from commission/gateway charges. |
| Seller settlement | Payment ledgers and Razorpay transfer fields exist; current live records show transfers not configured | Do not present settlement as automated until linked-account and statutory deduction workflow are configured. |
| Subscriptions | Not implemented | Define plans, prices, benefits, GST treatment, cancellation/renewal flow and invoices before coding billing. |
| Advertising / paid placement | Not implemented | Paid inventory must render as Sponsored/Promoted. |
| Best Seller tag | Should be organic | Do not sell the label. Calculate from actual marketplace performance and publish criteria internally. |
| Top 10 search paid placement | Do not disguise paid placement as organic | If sold, label Sponsored/Promoted and keep an independent organic ranking. |
| WhatsApp catalogue intake | Webhook, signed Meta verification, AI parsing, media storage and seller inbox are implemented | Complete production credential/config verification and automate draft-to-product/admin-review handoff only after exact seller association and validation succeeds. |
| Admin approval before live | Product approval/gating architecture exists | Preserve this human approval as an intentional exception to “autopilot”. |
| Inventory | Implemented internally | External ERP is separate. |
| Billing / tax invoice | Implemented internally | External accounting/ERP sync is separate. |
| ERP integration | No generic external ERP integration should be claimed | Select concrete target(s), e.g. Tally/Zoho Books/ERPNext/SAP, and implement their API contract. |
| Shiprocket | API routes exist | Production credentials/webhook must be configured before automatic courier booking is claimed live. |
| Local courier / transporter | Manual courier/AWB fallback exists | Add provider-specific API only where a chosen partner exposes one. |
| 5 km quick courier | No verified dedicated API integration | Select a partner/service area and price/routing rules before implementing. |
| MFA | No complete end-user TOTP/MFA workflow found | Add MFA for admin and strongly recommend/require it for sellers with payout/financial permissions. |
| Full autopilot | Automation-first, not zero-human | Human/admin exception paths remain necessary for KYC/GST review, listing approval, fraud, disputes, tax exceptions and account recovery. |

## Financial separation rule

Never combine these into one unexplained seller deduction:

1. product GST collected as part of the sale/invoice;
2. FabricTrad platform commission;
3. GST on FabricTrad commission/service fee;
4. payment-gateway processing fee and provider tax;
5. courier/platform logistics handling charge;
6. GST TCS under section 52, when applicable;
7. income-tax TDS under section 194-O, when applicable;
8. refunds/adjustments;
9. final seller payable/settlement.

The seller earnings UI and settlement export should show these separately once statutory deductions are activated.

## Ranking integrity rule

`Best Seller`, `Top Seller`, `Top 10`, ratings and verified-purchase review labels must never be hardcoded or sold as organic signals. Paid visibility is a different product and must be clearly labelled `Sponsored` or `Promoted`.

## AI/privacy rule

Personal-photo Virtual Drape requires affirmative consent before generation, minimum necessary data, a clear reset/delete path for the locally saved session, and accurate disclosure that the selected image is sent to the configured AI provider. The generated preview must be described as a visual estimate, not an exact physical fit guarantee.

## Launch blockers still requiring external configuration/product decisions

- Shiprocket production credentials and webhook token.
- Final CA-approved GST TCS / section 194-O TDS applicability, thresholds/exemptions and filing process.
- Seller payout/linked-account activation after the tax settlement model is signed off.
- Subscription plan definitions and pricing.
- Sponsored advertising inventory/pricing and ranking policy.
- ₹10/image Virtual Drape payment entitlement if that price is to be mandatory.
- Choice of external ERP/accounting integration target.
- Choice of local/5 km quick-delivery partner APIs.
- MFA rollout for admin/seller financial access.
