# Seller readiness response contract

`GET /api/seller/verification-status` exposes the protected readiness RPC result in two compatible forms:

- `status`: the object consumed by `SellerProfileReadiness` on the seller dashboard.
- top-level readiness fields: retained for seller-registration/resume consumers that already read the flat response.

The seller dashboard must never infer GST/document/bank verification from an absent `status` object. A verified seller receives `verificationStatus: "verified"`, all required document approvals, GST verification and bank verification from the readiness RPC.
