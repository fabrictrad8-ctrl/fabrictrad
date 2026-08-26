# FabricTrad Shopify/Oxygen migration

## Target

Move the production storefront away from the Cloudflare Worker and onto Shopify's Hydrogen/Oxygen stack without removing FabricTrad marketplace functionality.

Verified store target:
- Shopify shop: `3v0ipk-yh.myshopify.com`
- Primary domain configured in Shopify: `https://fabrictrad.com`
- Currency: INR
- Customer accounts: optional
- Live Shopify theme: `FabricTrad Commerce`

Shopify app installation audit (27 Aug 2026):
- Hydrogen: **not installed**
- Shiprocket: **not installed**
- Razorpay Secure: **not installed**

## Architecture

### Buyer storefront
- Hydrogen + React Router on Shopify Oxygen.
- Shopify Storefront API owns products, collections, variants, inventory visibility, cart and checkout.
- Shopify Customer Account API owns buyer sessions and account/order surfaces.
- Fast predictive search, category navigation, vendor discovery, product media, cart drawer and checkout handoff are first-class storefront flows.

### Payments
- Shopify Checkout is the order/payment boundary.
- Use Razorpay's supported Shopify payment app flow rather than FabricTrad creating Razorpay orders directly.
- Razorpay's Shopify integration uses Shopify/OAuth onboarding; the production store must be activated in live mode before cutover.

### Shipping
- Connect the Shopify store to Shiprocket through the Shiprocket Shopify integration.
- Shopify orders become the source of truth for order creation; Shiprocket syncs unfulfilled orders and fulfillment status.

### Buyer / seller / admin roles
- Buyer identity migrates to Shopify Customer Account API.
- Retail-store and seller attributes move to Shopify customer/company metafields and metaobjects.
- Seller catalog workflows use Shopify Admin API from server-only Oxygen routes; seller ownership is stored as app-owned metafields/metaobjects.
- Admin operations stay role-gated and server-side. No Admin API credential is exposed to browser code.
- A single account can retain both buy and sell capabilities through role/permission metadata.

### FabricTrad-specific features retained
- Retail and B2B purchasing, MOQ and single-piece B2C purchasing.
- Seller product/variant/color/media management.
- Seller approval and verification states.
- GSTIN/GTIN/PAN/Aadhaar policy rules.
- Order acceptance/rejection workflow and reasons.
- Buyer/seller/admin dashboards.
- AI catalog assistant and AI Drape experience.
- Returns, invoices, receipts, tracking, multilingual UX, search and filters.

These features are migrated route-by-route. The existing production app must remain available until the Shopify implementation passes parity tests.

## Safe cutover rule

Do **not** remove the current Cloudflare deployment or repoint production DNS until all of the following pass on an Oxygen preview:
1. Buyer sign-in/account and role routing.
2. Product/collection/search/cart/checkout.
3. Razorpay Shopify checkout in live configuration (verification without making an unintended real charge).
4. Shiprocket Shopify order sync and fulfillment status sync.
5. Seller onboarding, catalog, inventory, order and return flows.
6. Admin OTP/access controls and seller approval flows.
7. AI Drape and catalog assistant.
8. Invoice/receipt/order-history parity.
9. Mobile, tablet and desktop accessibility/performance checks.
10. A rollback path to the current production build.

## Shopify-side prerequisites that cannot be performed through the connected API

The connected Shopify API can manage store data but does not expose app installation or Hydrogen storefront provisioning. Three owner-level Shopify Admin actions are therefore required before the final cutover can be automated:

1. Install **Hydrogen**, then create a storefront and connect the GitHub repository. Shopify creates the Oxygen deployment workflow/token.
2. Install/activate the supported **Razorpay** Shopify payment app and complete its Shopify/Razorpay owner authorization. Keep it in test mode until the end-to-end checkout test passes, then switch it to live.
3. Install **Shiprocket: eCommerce Shipping**, connect the Shiprocket account, and enable Shopify order/status sync.

Until those storefront/app connections exist, this branch is deliberately non-destructive and does not disable Cloudflare production.
