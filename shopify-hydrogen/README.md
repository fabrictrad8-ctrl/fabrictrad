# FabricTrad Hydrogen migration overlay

This directory contains the first Shopify-native storefront UI layer for FabricTrad.

It is intentionally an overlay rather than a hand-maintained copy of Shopify's Hydrogen skeleton. Create/connect the Hydrogen storefront from Shopify Admin so Shopify can scaffold/link the supported Hydrogen/Oxygen runtime, then apply these files to that storefront.

## Included now

- A premium FabricTrad home/marketplace landing experience.
- Shopify Storefront API product loading instead of hard-coded catalog data.
- Responsive search-first information architecture.
- Direct routes for products, collections, vendors, account and cart.
- UI tokens designed for mobile-first marketplace use.

## Next migration slices

1. Shopify product/collection/search pages and predictive search.
2. Cart and Shopify Checkout.
3. Customer Account API and buyer dashboard.
4. Seller role + catalog/inventory tools.
5. Admin verification/approval tools.
6. Razorpay Shopify payment app validation.
7. Shiprocket Shopify channel validation.
8. AI Drape/catalog assistant on Oxygen server routes.
9. Returns, invoices and tracking.
10. Production parity audit and domain cutover.

Do not put Admin API tokens, Razorpay secrets, Shiprocket credentials or OpenAI secrets in client-side code or commit them to GitHub.
