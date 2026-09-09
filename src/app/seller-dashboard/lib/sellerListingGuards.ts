/**
 * Seller listing guards.
 *
 * Publishing a product live is gated in the database by
 * `require_verified_gstin_for_live_listing()` (see
 * supabase/migrations/20260826193000_india_hsn_gst_2025_rules.sql), which fires
 * on `seller_products`/`seller_product_variants` whenever `status = 'active'`:
 *
 *   1. the seller profile must have `gstin_status = 'active'` OR `gstin_verified`
 *   2. the listing must carry an HSN of 4, 6 or 8 digits
 *
 * Both failures arrive in the browser as raw Postgres exception text. These
 * helpers let the seller dashboard check the same two rules *before* writing,
 * and translate anything that still comes back into plain shop-floor English.
 *
 * Nothing here relaxes the gate — it only explains it earlier.
 */

import { describeHsn, normalizeHsn, resolveIndiaGstRate, validateHsn } from '@/lib/indiaTax';

export { describeHsn, normalizeHsn, validateHsn };

/**
 * Quick-pick HSN headings. Deliberately limited to the headings this codebase
 * already describes in `src/lib/indiaTax.ts` — no tariff codes are invented
 * here, and the seller can always type any other valid code by hand.
 */
export const HSN_QUICK_PICKS = ['5208', '5209', '5407', '6103', '6203', '6307'] as const;

export type LiveListingGate = {
  /** `gstin_status = 'active'` or `gstin_verified` on the seller profile. */
  gstinVerified: boolean;
  hsnCode?: string | null;
};

export type ListingBlocker = {
  key: 'gstin' | 'hsn';
  message: string;
  /** What the seller can do about it right now. */
  fix: string;
};

/**
 * The exact reasons the database would refuse `status = 'active'` today.
 * An empty array means the live gate would pass.
 */
export function liveListingBlockers({ gstinVerified, hsnCode }: LiveListingGate): ListingBlocker[] {
  const blockers: ListingBlocker[] = [];
  if (!gstinVerified) {
    blockers.push({
      key: 'gstin',
      message: 'Your GSTIN is not verified yet.',
      fix: 'Save the product as a draft now. It can be published the moment GST verification completes — nothing you enter is lost.',
    });
  }
  if (!validateHsn(hsnCode)) {
    blockers.push({
      key: 'hsn',
      message: 'This product has no valid HSN code.',
      fix: 'Enter the 4, 6 or 8 digit HSN for this fabric. HSN is what puts the correct GST rate on the buyer invoice.',
    });
  }
  return blockers;
}

/** GST rate the database will store for this HSN and price, computed by the same rules. */
export function previewGstRate(hsnCode: string | null | undefined, unitPrice: number, storedRate = 0) {
  return resolveIndiaGstRate({ hsnCode, unitPrice, storedRate });
}

const ERROR_RULES: Array<{ match: RegExp; message: string }> = [
  {
    match: /active verified gstin/i,
    message:
      'This product cannot go live yet because your GSTIN is not verified. Save it as a draft — it will publish as soon as GST verification is approved.',
  },
  {
    match: /4, ?6 or 8 digit hsn|hsn must contain 4, ?6 or 8 digits|hsn_code_format_check/i,
    message:
      'Add a valid HSN code (4, 6 or 8 digits) before publishing. HSN decides the GST rate printed on the buyer invoice.',
  },
  {
    match: /duplicate key value|seller_products_seller_id_sku_key|23505/i,
    message: 'That SKU is already used by another product in your store. Use a different SKU.',
  },
  {
    match: /cannot affect row a second time/i,
    message: 'The same SKU appears more than once in this file. Keep one row per SKU and import again.',
  },
  {
    match: /seller_products_unit_check/i,
    message: 'That measurement unit is not supported. Use metre, yard, kg, piece, roll or farma.',
  },
  {
    match: /seller_products_quantity_policy_check/i,
    message: 'Buyer minimum and maximum quantities are inconsistent. A maximum cannot be lower than its minimum.',
  },
  {
    match: /seller_products_sale_channel_check/i,
    message: 'Choose who can buy: business only, personal only, or both.',
  },
  {
    match: /seller_products_gst_rate_check/i,
    message: 'The GST rate must be between 0 and 100.',
  },
  {
    match: /invalid input syntax for type numeric|numeric field overflow/i,
    message: 'A price, stock or quantity value is not a valid number. Remove currency symbols and text from those columns.',
  },
  {
    match: /row-level security|permission denied/i,
    message: 'This product does not belong to your seller account, or your seller access is inactive. Sign in again and retry.',
  },
  {
    match: /violates check constraint|violates not-null constraint/i,
    message: 'Some product values were rejected. Check price, stock, unit and quantity fields, then save again.',
  },
];

/**
 * Turn a Supabase/Postgres failure into something a textile trader can act on.
 * Unknown errors are passed through unchanged rather than replaced with a
 * vague, made-up explanation.
 */
export function describeSellerProductError(error: unknown, fallback = 'Could not save this product.') {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';
  if (!raw.trim()) return fallback;
  const rule = ERROR_RULES.find((item) => item.match.test(raw));
  return rule ? rule.message : raw;
}

/**
 * Plain-language answer to "why is my product not live yet?", using only
 * columns that actually exist on `seller_products`.
 */
export function listingStateSummary(product: {
  status?: string | null;
  approval_status?: string | null;
  hsn_code?: string | null;
}) {
  const status = String(product.status || 'draft');
  const approval = String(product.approval_status || 'not_submitted');
  if (status === 'archived') {
    return { live: false, pillStatus: 'archived', reason: 'Archived. Buyers cannot see or order this.' };
  }
  if (status !== 'active') {
    return {
      live: false,
      pillStatus: 'draft',
      reason: validateHsn(product.hsn_code)
        ? 'Draft. Publish it to send it for approval.'
        : 'Draft. Add an HSN code, then publish it for approval.',
    };
  }
  if (approval === 'approved') {
    return { live: true, pillStatus: 'active', reason: 'Live. Buyers can find and order this.' };
  }
  if (approval === 'rejected') {
    return { live: false, pillStatus: 'rejected', reason: 'Rejected in review. Fix the listing details and publish again.' };
  }
  if (approval === 'not_submitted') {
    // Published but never entered the moderation queue — a real state in the
    // data, and one the seller would otherwise wait on forever.
    return {
      live: false,
      pillStatus: 'draft',
      reason: 'Marked active but never sent for review. Publish it again from Products to submit it.',
    };
  }
  return {
    live: false,
    pillStatus: 'pending',
    reason: 'Published and waiting for FabricTrad review. No action needed from you.',
  };
}

/** approval_status values that a fresh "publish" action should move into review. */
export const RESUBMITTABLE_APPROVAL_STATUSES = ['not_submitted', 'rejected'];
