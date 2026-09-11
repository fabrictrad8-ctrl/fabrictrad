/**
 * Seller "needs your attention" model.
 *
 * One place that turns the seller's *real* stored state into a short, ordered
 * list of things that are actually wrong. Every item below is derived from a
 * column that exists or from a field an existing FabricTrad API already
 * returns — nothing here is estimated, sampled or invented, and a data source
 * that fails to load simply contributes no items rather than a guess.
 *
 * Sources, per item:
 *   payout_*            → GET /api/seller/payout-account  ({ ready, account })
 *   verification_*      → GET /api/seller/verification-status ({ status.nextAction,
 *                         status.requiredDocuments*, missingDocuments })
 *   product_*           → public.seller_products (status, approval_status,
 *                         hsn_code, available_quantity, reserved_quantity,
 *                         min_stock)
 *   orders_to_dispatch  → catalog_order_requests / bulk_orders paid rows with no
 *                         matching public.seller_shipments row
 *   shipments_overdue   → public.seller_shipments (estimated_delivery, status)
 *
 * Ordering follows real consequence: cannot get paid → cannot sell → losing
 * sales → housekeeping. `rank` is the sort key; `severity` decides how loudly
 * the item is presented.
 *
 *   blocking  the seller's business is stopped AND they can fix it right now
 *   urgent    money or sales are leaking today
 *   watch     housekeeping worth a glance
 *
 * A state that is genuinely "waiting on FabricTrad or Razorpay" (GST under
 * review, documents under review, a payout submitted with no outstanding
 * Razorpay requirement) is deliberately NOT an item. Nagging a seller about
 * something they cannot act on is how an attention surface gets ignored.
 */

import { validateHsn } from '@/app/seller-dashboard/lib/sellerListingGuards';

/** Seller dashboard tabs this surface can send someone to. */
export type SellerAttentionTab = 'orders' | 'inventory' | 'earnings' | 'fulfillment' | 'profile';

export type AttentionSeverity = 'blocking' | 'urgent' | 'watch';

export type AttentionItem = {
  key: string;
  severity: AttentionSeverity;
  /** Lower sorts first. See the consequence order in the file header. */
  rank: number;
  title: string;
  detail: string;
  actionLabel: string;
  /** Exactly one of `tab` (in-dashboard) or `href` (another route) is set. */
  tab?: SellerAttentionTab;
  href?: string;
  /**
   * data-focus-id of the control this action is really about. Landing on the
   * right tab is not the same as arriving at the thing the button named: the
   * payout action dropped people on Earnings & payouts with the connect button
   * still somewhere below the fold. With this set, the destination is scrolled
   * to and flashed. See src/lib/focusTarget.ts.
   */
  focus?: string;
  icon: string;
};

/** Only the `seller_products` columns this model reads. */
export type AttentionProduct = {
  status?: string | null;
  approval_status?: string | null;
  available_quantity?: number | null;
  reserved_quantity?: number | null;
  min_stock?: number | null;
  hsn_code?: string | null;
};

/** The subset of `/api/seller/verification-status` this model reads. */
export type AttentionVerification = {
  nextAction?: string | null;
  requiredDocumentsTotal?: number | null;
  requiredDocumentsUploaded?: number | null;
  bankDetailsPresent?: boolean | null;
  missingDocuments?: string[] | null;
};

/** The subset of `/api/seller/payout-account` this model reads. */
export type AttentionPayout = {
  ready: boolean;
  connected: boolean;
  requirementsCount: number;
};

export type AttentionInput = {
  /**
   * `gstin_status = 'active' OR gstin_verified` on seller_profiles — the exact
   * condition require_verified_gstin_for_live_listing() enforces. `null` means
   * the seller row could not be read, and every rule that depends on it is
   * skipped instead of assumed.
   */
  gstinVerified: boolean | null;
  verification: AttentionVerification | null;
  payout: AttentionPayout | null;
  products: AttentionProduct[] | null;
  orders: { paidAwaitingDispatch: number } | null;
  shipments: { overdue: number } | null;
};

const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

const DOCUMENT_LABELS: Record<string, string> = {
  gst_certificate: 'GST certificate',
  pan_card: 'PAN card',
  cancelled_cheque: 'cancelled cheque',
};

const documentLabel = (type: string) => DOCUMENT_LABELS[type] || type.replaceAll('_', ' ');

/**
 * What a buyer can order right now — `available_quantity` minus the
 * `reserved_quantity` held for orders awaiting a buyer company's approval.
 * Same rule SellerInventory and SellerOverview use.
 */
export function attentionSellableStock(product: AttentionProduct) {
  return Math.max(0, Number(product.available_quantity || 0) - Number(product.reserved_quantity || 0));
}

/** A listing buyers can actually find and order today. */
const isLive = (product: AttentionProduct) =>
  product.status === 'active' && product.approval_status === 'approved';

/**
 * `estimated_delivery` is a DATE. Compare on calendar days in the browser's
 * timezone so "today" is never counted as late.
 */
export function isShipmentOverdue(shipment: {
  status?: string | null;
  estimated_delivery?: string | null;
}, now = new Date()) {
  if (!shipment.estimated_delivery) return false;
  const status = String(shipment.status || '').toLowerCase();
  if (['delivered', 'failed', 'cancelled', 'rto_delivered'].includes(status)) return false;
  const due = new Date(`${String(shipment.estimated_delivery).slice(0, 10)}T23:59:59`);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

export function buildSellerAttentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { gstinVerified, verification, payout, products, orders, shipments } = input;
  const nextAction = String(verification?.nextAction || '');

  // ---------------------------------------------------------------- get paid
  // Razorpay Route activation gates settlement, and /api/seller/payout-account
  // POST refuses to even start until gstin_verified is true — so this is only
  // presented as a task once the seller can actually complete it.
  if (payout && !payout.ready) {
    if (!payout.connected && gstinVerified === true) {
      items.push({
        key: 'payout_not_connected',
        severity: 'blocking',
        rank: 1,
        title: 'No bank account connected — you cannot be paid',
        detail:
          'FabricTrad has no verified payout bank for your store, so buyer payments cannot be settled to you. Connect it once with Razorpay.',
        actionLabel: 'Connect payout bank',
        tab: 'earnings',
        focus: 'payout-connect',
        icon: 'BanknotesIcon',
      });
    } else if (payout.connected && payout.requirementsCount > 0) {
      items.push({
        key: 'payout_requirements',
        severity: 'blocking',
        rank: 2,
        title: `Razorpay needs ${payout.requirementsCount} more ${plural(payout.requirementsCount, 'detail')} before paying you`,
        detail:
          'Your payout bank was submitted but Razorpay has not activated it. The outstanding items are listed on the Earnings & payouts screen.',
        actionLabel: 'Open payout account',
        tab: 'earnings',
        focus: 'payout-connect',
        icon: 'BanknotesIcon',
      });
    }
    // payout.connected with no outstanding requirement = waiting on Razorpay.
    // Nothing for the seller to do, so nothing is shown.
  }

  // -------------------------------------------------------------- cannot sell
  // `nextAction` is computed server-side by
  // ensure_current_seller_verification_state(). Only the actionable branches
  // become items; gst_review / document_review / bank_review are FabricTrad's
  // queue, and SellerProfileReadiness already reports those.
  if (nextAction === 'contact_support') {
    items.push({
      key: 'verification_blocked',
      severity: 'blocking',
      rank: 10,
      title: 'Your seller account is on hold',
      detail:
        'Selling is paused on this account and it cannot be reopened from the dashboard. FabricTrad support has to review it with you.',
      actionLabel: 'Contact support',
      href: '/help',
      icon: 'ShieldExclamationIcon',
    });
  } else if (nextAction === 'add_phone') {
    items.push({
      key: 'verification_phone',
      severity: 'blocking',
      rank: 20,
      title: 'Add your mobile number',
      detail:
        'Your contact number is missing. Buyers, couriers and payout verification all need it before your store can operate.',
      actionLabel: 'Add mobile number',
      href: '/auth/phone?role=seller&returnTo=/seller-dashboard',
      icon: 'DevicePhoneMobileIcon',
    });
  } else if (nextAction === 'complete_profile') {
    items.push({
      key: 'verification_profile',
      severity: 'blocking',
      rank: 21,
      title: 'Business details are incomplete',
      detail:
        'Your GSTIN, business name or pickup address is still missing. Verification cannot start, and until it finishes no product can go live.',
      actionLabel: 'Finish business details',
      href: '/seller-registration?resume=1',
      icon: 'IdentificationIcon',
    });
  } else if (nextAction === 'complete_application') {
    const missing = (verification?.missingDocuments || []).filter(Boolean);
    const bankMissing = verification?.bankDetailsPresent === false;
    const parts: string[] = [];
    if (missing.length) {
      parts.push(`${missing.map(documentLabel).join(', ')} not uploaded`);
    }
    if (bankMissing) parts.push('settlement bank details not entered');
    items.push({
      key: 'verification_application',
      severity: 'blocking',
      rank: 22,
      title: 'Verification is unfinished — nothing can go live',
      detail: parts.length
        ? `${parts.join(' and ')}. Until verification is approved, every product stays a draft and buyers cannot order from you.`
        : 'Your verification application is not complete yet. Until it is approved, every product stays a draft and buyers cannot order from you.',
      actionLabel: 'Finish verification',
      href: '/seller-registration?resume=1',
      icon: 'DocumentCheckIcon',
    });
  }

  // ------------------------------------------------------------ losing sales
  if (orders && orders.paidAwaitingDispatch > 0) {
    const count = orders.paidAwaitingDispatch;
    items.push({
      key: 'orders_to_dispatch',
      severity: 'urgent',
      rank: 30,
      title: `${count} paid ${plural(count, 'order')} waiting to be dispatched`,
      detail:
        'The buyer has already paid and no shipment has been created yet. Late dispatch is the most common reason a paid order turns into a refund.',
      actionLabel: 'Open orders',
      tab: 'orders',
      icon: 'TruckIcon',
    });
  }

  if (products) {
    const unarchived = products.filter((product) => product.status !== 'archived');

    // Marked active but never entered moderation — the silent case where a
    // seller believes a product is published and it never reaches a buyer.
    const neverSubmitted = unarchived.filter(
      (product) => product.status === 'active' && String(product.approval_status || 'not_submitted') === 'not_submitted'
    ).length;
    if (neverSubmitted > 0) {
      items.push({
        key: 'products_never_submitted',
        severity: 'urgent',
        rank: 40,
        title: `${neverSubmitted} ${plural(neverSubmitted, 'product')} marked active but never sent for review`,
        detail:
          'These are not visible to buyers and never will be until they are published again from Products, which submits them for FabricTrad review.',
        actionLabel: 'Open products',
        tab: 'inventory',
        icon: 'ExclamationCircleIcon',
      });
    }

    const rejected = unarchived.filter((product) => product.approval_status === 'rejected').length;
    if (rejected > 0) {
      items.push({
        key: 'products_rejected',
        severity: 'urgent',
        rank: 41,
        title: `${rejected} ${plural(rejected, 'product was', 'products were')} rejected in review`,
        detail: 'Fix the listing details and publish again — a rejected listing stays invisible to buyers.',
        actionLabel: 'Open products',
        tab: 'inventory',
        icon: 'XCircleIcon',
      });
    }

    // The database refuses status = 'active' without a 4, 6 or 8 digit HSN.
    // This is the quiet blocker sellers hit most.
    const missingHsn = unarchived.filter((product) => !validateHsn(product.hsn_code)).length;
    if (missingHsn > 0) {
      items.push({
        key: 'products_missing_hsn',
        severity: 'urgent',
        rank: 42,
        title: `${missingHsn} ${plural(missingHsn, 'product has', 'products have')} no HSN code`,
        detail:
          'A product without a 4, 6 or 8 digit HSN can never be published — HSN is what puts the right GST rate on the buyer invoice.',
        actionLabel: 'Add HSN codes',
        tab: 'inventory',
        icon: 'DocumentTextIcon',
      });
    }

    const live = unarchived.filter(isLive);
    const outOfStock = live.filter((product) => attentionSellableStock(product) <= 0).length;
    if (outOfStock > 0) {
      items.push({
        key: 'products_out_of_stock',
        severity: 'urgent',
        rank: 50,
        title: `${outOfStock} live ${plural(outOfStock, 'product is', 'products are')} out of stock`,
        detail:
          'Buyers can see these listings but cannot order them. Update the stock quantity to start selling again.',
        actionLabel: 'Update stock',
        tab: 'inventory',
        icon: 'ArchiveBoxXMarkIcon',
      });
    }

    // Only worth raising once the seller could actually publish: with an
    // unverified GSTIN the database would refuse the change anyway.
    if (gstinVerified === true) {
      const publishableDrafts = unarchived.filter(
        (product) => product.status === 'draft' && validateHsn(product.hsn_code)
      ).length;
      if (publishableDrafts > 0) {
        items.push({
          key: 'products_draft_ready',
          severity: 'watch',
          rank: 60,
          title: `${publishableDrafts} finished ${plural(publishableDrafts, 'product is', 'products are')} still a draft`,
          detail:
            'These have everything they need to go live. Publishing sends them for FabricTrad review; until then no buyer can see them.',
          actionLabel: 'Publish drafts',
          tab: 'inventory',
          icon: 'ArchiveBoxIcon',
        });
      }
    }

    const lowStock = live.filter((product) => {
      const sellable = attentionSellableStock(product);
      return sellable > 0 && sellable <= Number(product.min_stock || 0);
    }).length;
    if (lowStock > 0) {
      items.push({
        key: 'products_low_stock',
        severity: 'watch',
        rank: 70,
        title: `${lowStock} live ${plural(lowStock, 'product is', 'products are')} at or below your low-stock level`,
        detail: 'Restock before they run out, or buyers will start seeing them as unavailable.',
        actionLabel: 'Review stock',
        tab: 'inventory',
        icon: 'ExclamationTriangleIcon',
      });
    }
  }

  // ------------------------------------------------------------- housekeeping
  if (shipments && shipments.overdue > 0) {
    const count = shipments.overdue;
    items.push({
      key: 'shipments_overdue',
      severity: 'watch',
      rank: 80,
      title: `${count} ${plural(count, 'shipment is', 'shipments are')} past the delivery date you promised`,
      detail:
        'The estimated delivery date has passed and the shipment is still not marked delivered. Check the courier status before the buyer raises a dispute.',
      actionLabel: 'Open shipments',
      tab: 'fulfillment',
      icon: 'ClockIcon',
    });
  }

  return items.sort((a, b) => a.rank - b.rank);
}

/**
 * Items severe enough to interrupt with a sheet rather than a banner: the
 * seller cannot get paid or cannot sell at all, and the fix is in their hands.
 */
export function blockingAttentionItems(items: AttentionItem[]) {
  return items.filter((item) => item.severity === 'blocking');
}

/**
 * Identity of the current problem set. Stored alongside a dismissal so a
 * dismissal only silences what the seller actually saw — a new blocker
 * reopens the surface even inside the same browser session.
 */
export function attentionSignature(items: AttentionItem[]) {
  return items.map((item) => item.key).join('|');
}

/** Severity → the shared status-pill vocabulary in src/lib/statusPill.ts. */
export const ATTENTION_PILL_STATUS: Record<AttentionSeverity, string> = {
  blocking: 'failed',
  urgent: 'pending',
  watch: 'draft',
};

export const ATTENTION_SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  blocking: 'Blocking',
  urgent: 'Act today',
  watch: 'Keep an eye',
};
