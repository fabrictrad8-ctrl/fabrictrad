'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { pillClassForStatus } from '@/lib/statusPill';
import {
  ATTENTION_PILL_STATUS,
  ATTENTION_SEVERITY_LABEL,
  attentionSignature,
  blockingAttentionItems,
  buildSellerAttentionItems,
  isShipmentOverdue,
  type AttentionItem,
  type AttentionPayout,
  type AttentionProduct,
  type AttentionVerification,
  type SellerAttentionTab,
} from '@/app/seller-dashboard/lib/sellerAttention';
import '@/styles/seller-attention.css';

/**
 * One consolidated "needs your attention" surface for sellers.
 *
 * Rendered above every seller dashboard tab, next to (not instead of)
 * SellerProfileReadiness, which keeps showing the detailed verification
 * checklist. This component answers a different question: *what is broken
 * right now, and where do I tap to fix it*.
 *
 * Everything it shows is derived in sellerAttention.ts from real rows and real
 * API responses. A source that fails to load contributes nothing — there is no
 * placeholder count anywhere in this file. When nothing is wrong, the component
 * renders null.
 *
 * Prominence, deliberately two-tier:
 *   - Blocking items (cannot be paid, cannot sell at all, and fixable by the
 *     seller today) open a sheet once per browser session. These are rare and
 *     one-time for a healthy store, so the interruption is proportionate.
 *   - Everything else is an inline banner. A seller with one low-stock item
 *     never gets a sheet.
 *
 * Dismissal is per browser session (sessionStorage) and is recorded against a
 * signature of the exact problem list, so closing it silences only what was
 * actually seen: a new blocker reopens the sheet immediately, and the next
 * visit shows everything again while the problem persists. There is no
 * permanent "never show again".
 */

type Props = {
  onNavigate: (tab: SellerAttentionTab) => void;
};

type LoadState = {
  gstinVerified: boolean | null;
  verification: AttentionVerification | null;
  payout: AttentionPayout | null;
  products: AttentionProduct[] | null;
  orders: { paidAwaitingDispatch: number } | null;
  shipments: { overdue: number } | null;
};

const EMPTY_STATE: LoadState = {
  gstinVerified: null,
  verification: null,
  payout: null,
  products: null,
  orders: null,
  shipments: null,
};

const SHEET_KEY = 'ft-seller-attention-sheet';
const BANNER_KEY = 'ft-seller-attention-banner';
/** Do not re-query on every window focus; a seller switches apps constantly. */
const REFRESH_AFTER_MS = 60_000;
/** Rows shown in the banner before "show more" — keeps a phone screen usable. */
const BANNER_PREVIEW_COUNT = 3;

function readSession(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    // Private browsing / blocked storage: the surface simply is not dismissible
    // this session, which fails in the safe direction.
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore — see readSession */
  }
}

export default function SellerAttentionCenter({ onNavigate }: Props) {
  const { user, profile, isDemoAccount } = useAuth();
  const [state, setState] = useState<LoadState>(EMPTY_STATE);
  const [resolved, setResolved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetDismissed, setSheetDismissed] = useState('');
  const [bannerCollapsed, setBannerCollapsed] = useState('');
  const [expanded, setExpanded] = useState(false);
  const loadedAtRef = useRef(0);
  // Guards against a slow response from a previous account or a previous
  // refresh overwriting newer state after a session switch.
  const requestRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const canSell = profile?.can_sell ?? profile?.role === 'seller';
  const enabled = Boolean(user?.id) && canSell && !isDemoAccount;

  const load = useCallback(async () => {
    if (!user?.id) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    setRefreshing(true);
    const next: LoadState = { ...EMPTY_STATE };

    // Verification and payout are independent HTTP calls; either can fail
    // without taking the other down.
    const [verificationResult, payoutResult] = await Promise.allSettled([
      fetch('/api/seller/verification-status', { cache: 'no-store', credentials: 'same-origin' }),
      fetch('/api/seller/payout-account', { cache: 'no-store', credentials: 'same-origin' }),
    ]);

    if (verificationResult.status === 'fulfilled' && verificationResult.value.ok) {
      const body = (await verificationResult.value.json().catch(() => null)) as
        | { status?: AttentionVerification; missingDocuments?: string[] }
        | null;
      if (body?.status) {
        next.verification = { ...body.status, missingDocuments: body.missingDocuments || [] };
      }
    }

    if (payoutResult.status === 'fulfilled' && payoutResult.value.ok) {
      const body = (await payoutResult.value.json().catch(() => null)) as
        | { ready?: boolean; account?: { connected?: boolean; requirements?: unknown[] } | null }
        | null;
      if (body && typeof body.ready === 'boolean') {
        next.payout = {
          ready: body.ready,
          connected: Boolean(body.account?.connected),
          requirementsCount: Array.isArray(body.account?.requirements)
            ? body.account.requirements.length
            : 0,
        };
      }
    }

    const supabase = createClient();
    const { data: seller } = await supabase
      .from('seller_profiles')
      .select('id,gstin_status,gstin_verified,razorpay_linked_account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (seller?.id) {
      // Same rule as require_verified_gstin_for_live_listing().
      next.gstinVerified = seller.gstin_status === 'active' || seller.gstin_verified === true;

      // Fallback for the one case the column answers on its own.
      // seller_payout_accounts is service-role only, so /api/seller/payout-account
      // is normally the only way to read payout state — and that route currently
      // gates on user_profiles.role = 'seller', which the database no longer sets
      // for sellers (see sync_verified_seller_account_status). When that call
      // fails, a NULL razorpay_linked_account_id still proves no Razorpay Route
      // account was ever completed, because the route writes this column only
      // after a successful setup. A non-NULL value proves nothing about
      // activation, so nothing is claimed in that case.
      if (!next.payout && seller.razorpay_linked_account_id == null) {
        next.payout = { ready: false, connected: false, requirementsCount: 0 };
      }

      const [productResult, catalogResult, bulkResult, shipmentResult] = await Promise.all([
        supabase
          .from('seller_products')
          .select('status,approval_status,available_quantity,reserved_quantity,min_stock,hsn_code')
          .eq('seller_id', seller.id)
          .neq('status', 'archived')
          .limit(1000),
        supabase
          .from('catalog_order_requests')
          .select('id')
          .eq('seller_id', seller.id)
          .eq('status', 'paid')
          .eq('payment_status', 'paid')
          .limit(500),
        supabase
          .from('bulk_orders')
          .select('id')
          .eq('seller_id', seller.id)
          .eq('status', 'paid')
          .eq('payment_status', 'paid')
          .limit(500),
        supabase
          .from('seller_shipments')
          .select('status,estimated_delivery,catalog_order_id,bulk_order_id')
          .eq('seller_id', seller.id)
          .limit(2000),
      ]);

      if (!productResult.error) {
        next.products = (productResult.data || []) as AttentionProduct[];
      }

      const shipments = shipmentResult.error
        ? null
        : ((shipmentResult.data || []) as Array<{
            status: string | null;
            estimated_delivery: string | null;
            catalog_order_id: string | null;
            bulk_order_id: string | null;
          }>);

      if (shipments) {
        next.shipments = { overdue: shipments.filter((row) => isShipmentOverdue(row)).length };
      }

      // "Awaiting dispatch" means paid with no shipment record yet. Without the
      // shipment list that cannot be answered honestly, so it is left out.
      if (shipments && !catalogResult.error && !bulkResult.error) {
        const shippedCatalog = new Set(
          shipments.map((row) => row.catalog_order_id).filter(Boolean) as string[]
        );
        const shippedBulk = new Set(
          shipments.map((row) => row.bulk_order_id).filter(Boolean) as string[]
        );
        const pendingCatalog = (catalogResult.data || []).filter((row) => !shippedCatalog.has(row.id));
        const pendingBulk = (bulkResult.data || []).filter((row) => !shippedBulk.has(row.id));
        next.orders = { paidAwaitingDispatch: pendingCatalog.length + pendingBulk.length };
      }
    }

    if (requestId !== requestRef.current) return;
    loadedAtRef.current = Date.now();
    setState(next);
    setResolved(true);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    // Never keep a previous account's state on the screen after a session swap.
    requestRef.current += 1;
    setState(EMPTY_STATE);
    setResolved(false);
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  // A seller usually fixes things in another tab or app and comes back. Refresh
  // when the workspace regains focus, but not more than once a minute.
  useEffect(() => {
    if (!enabled) return;
    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - loadedAtRef.current < REFRESH_AFTER_MS) return;
      void load();
    };
    window.addEventListener('focus', maybeRefresh);
    document.addEventListener('visibilitychange', maybeRefresh);
    return () => {
      window.removeEventListener('focus', maybeRefresh);
      document.removeEventListener('visibilitychange', maybeRefresh);
    };
  }, [enabled, load]);

  useEffect(() => {
    if (!user?.id) return;
    setSheetDismissed(readSession(`${SHEET_KEY}:${user.id}`) || '');
    setBannerCollapsed(readSession(`${BANNER_KEY}:${user.id}`) || '');
  }, [user?.id]);

  const items = useMemo(
    () => (resolved ? buildSellerAttentionItems(state) : []),
    [resolved, state]
  );
  const blocking = useMemo(() => blockingAttentionItems(items), [items]);
  const signature = useMemo(() => attentionSignature(items), [items]);
  const blockingSignature = useMemo(() => attentionSignature(blocking), [blocking]);

  const sheetOpen = blocking.length > 0 && sheetDismissed !== blockingSignature;
  const collapsed = items.length > 0 && bannerCollapsed === signature;

  useEffect(() => {
    if (!sheetOpen) return;
    sheetRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSheetDismissed(blockingSignature);
      if (user?.id) writeSession(`${SHEET_KEY}:${user.id}`, blockingSignature);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [blockingSignature, sheetOpen, user?.id]);

  const closeSheet = () => {
    setSheetDismissed(blockingSignature);
    if (user?.id) writeSession(`${SHEET_KEY}:${user.id}`, blockingSignature);
  };

  const setCollapsed = (value: boolean) => {
    const stored = value ? signature : '';
    setBannerCollapsed(stored);
    if (user?.id) writeSession(`${BANNER_KEY}:${user.id}`, stored);
  };

  const go = (item: AttentionItem) => {
    closeSheet();
    if (item.tab) onNavigate(item.tab);
  };

  // Nothing wrong, still loading, or not a live seller account: render nothing.
  // No "all good" card on every page load.
  if (!enabled || !resolved || items.length === 0) return null;

  const topTone = items[0].severity;
  const blockingCount = blocking.length;
  // A phone screen must not open onto ten stacked rows. The most consequential
  // few are always visible; the rest are one tap away and never hidden from the
  // count in the header.
  const visibleItems = expanded ? items : items.slice(0, BANNER_PREVIEW_COUNT);

  const actionButton = (item: AttentionItem, primary: boolean) => {
    const className = `${primary ? 'ft-primary-action' : 'ft-secondary-action'} ft-attention-action inline-flex items-center justify-center gap-2 px-3 py-2 text-xs`;
    if (item.href) {
      return (
        <Link href={item.href} onClick={closeSheet} className={className}>
          {item.actionLabel}
          <Icon name="ArrowRightIcon" size={14} />
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => go(item)} className={className}>
        {item.actionLabel}
        <Icon name="ArrowRightIcon" size={14} />
      </button>
    );
  };

  const row = (item: AttentionItem, primary: boolean) => (
    <div key={item.key} className="ft-attention-row" data-tone={item.severity}>
      <span className="ft-attention-mark">
        <Icon name={item.icon} size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-800 leading-5 text-foreground">{item.title}</p>
          <span className={pillClassForStatus(ATTENTION_PILL_STATUS[item.severity])}>
            {ATTENTION_SEVERITY_LABEL[item.severity]}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
      </div>
      {actionButton(item, primary)}
    </div>
  );

  return (
    <>
      {/* While the sheet is up it already states the blocking items, and it sits
          over the page behind a backdrop. Rendering the banner underneath at the
          same time repeated every one of them verbatim. The banner takes over
          once the sheet has been acknowledged. */}
      <section
        className="ft-attention-banner mb-5"
        data-tone={topTone}
        aria-label="Things that need your attention"
        hidden={sheetOpen}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <Icon
            name="BellAlertIcon"
            size={16}
            className={topTone === 'blocking' ? 'text-error' : topTone === 'urgent' ? 'text-warning' : 'text-muted-foreground'}
          />
          <p className="mr-auto text-sm font-850 text-foreground">
            {items.length} {items.length === 1 ? 'thing needs' : 'things need'} your attention
            {blockingCount > 0 && (
              <span className="font-700 text-error">
                {' '}
                · {blockingCount} blocking your store
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="ft-icon-button !min-h-9 !min-w-9 disabled:opacity-50"
            aria-label="Re-check what needs attention"
          >
            <Icon name="ArrowPathIcon" size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="min-h-9 rounded-lg px-2.5 text-xs font-800 text-primary"
            aria-expanded={!collapsed}
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>

        {collapsed ? (
          <p className="px-4 py-2.5 text-xs leading-5 text-muted-foreground">
            Hidden for now. These come back the next time you open your dashboard, and stay until they
            are actually fixed.
          </p>
        ) : (
          <div>
            {visibleItems.map((item, index) => row(item, index === 0))}
            {items.length > BANNER_PREVIEW_COUNT && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full border-t border-border px-4 py-2.5 text-left text-xs font-800 text-primary"
                aria-expanded={expanded}
              >
                {expanded
                  ? 'Show fewer'
                  : `Show ${items.length - BANNER_PREVIEW_COUNT} more ${items.length - BANNER_PREVIEW_COUNT === 1 ? 'item' : 'items'}`}
              </button>
            )}
          </div>
        )}
      </section>

      {sheetOpen && (
        <>
          <button
            type="button"
            className="ft-attention-backdrop"
            onClick={closeSheet}
            aria-label="Close blocking issues"
          />
          <div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ft-attention-sheet-title"
            className="ft-attention-sheet"
          >
            <div className="flex items-start gap-3 border-b border-border p-4">
              <span className="ft-attention-mark" data-tone="blocking">
                <Icon name="ShieldExclamationIcon" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="ft-attention-sheet-title" className="text-base font-850 text-foreground">
                  {blockingCount === 1 ? 'One thing is blocking your store' : `${blockingCount} things are blocking your store`}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Until these are done you cannot be paid or your products cannot go live. Each one
                  takes you straight to the screen that fixes it.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSheet}
                className="ft-icon-button !min-h-9 !min-w-9"
                aria-label="Close"
              >
                <Icon name="XMarkIcon" size={17} />
              </button>
            </div>

            <div>{blocking.map((item, index) => row(item, index === 0))}</div>

            <p className="border-t border-border px-4 py-3 text-[11px] leading-5 text-muted-foreground">
              Closing this hides it until your next visit. It cannot be turned off permanently while
              the problem is still there.
            </p>
          </div>
        </>
      )}
    </>
  );
}
