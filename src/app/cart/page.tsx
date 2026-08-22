'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatMoney, useBuyerBulkOrders } from '@/lib/hooks/useAccountOrders';

type CatalogOrder = {
  id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  seller_products?: { name?: string | null } | null;
};

const statusLabel = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export default function OrderHubPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { orders: bulkOrders, loading: bulkLoading, error: bulkError, refresh: refreshBulk } = useBuyerBulkOrders();
  const [catalogOrders, setCatalogOrders] = useState<CatalogOrder[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=%2Fcart');
  }, [authLoading, router, user]);

  const loadCatalog = useCallback(async () => {
    if (!user?.id) {
      setCatalogOrders([]);
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    setCatalogError('');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('catalog_order_requests')
      .select('id,status,payment_status,total_amount,created_at,seller_products(name)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setCatalogError(error.message);
      setCatalogOrders([]);
    } else {
      setCatalogOrders((data || []) as unknown as CatalogOrder[]);
    }
    setCatalogLoading(false);
  }, [user?.id]);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  const orders = useMemo(() => {
    const catalog = catalogOrders.map((order) => ({
      id: order.id,
      ref: `FT-CAT-${order.id.slice(0, 8).toUpperCase()}`,
      kind: 'Catalogue',
      product: order.seller_products?.name || 'Catalogue product',
      status: order.status || 'pending',
      paymentStatus: order.payment_status || 'unpaid',
      total: Number(order.total_amount || 0),
      createdAt: order.created_at,
    }));
    const bulk = bulkOrders.map((order) => ({
      id: order.id,
      ref: `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`,
      kind: 'Bulk',
      product: order.bulk_order_items?.[0]?.product_name || 'Bulk fabric order',
      status: String(order.status || 'draft'),
      paymentStatus: String(order.payment_status || 'unpaid'),
      total: Number(order.net_total || 0),
      createdAt: String(order.created_at || ''),
    }));
    return [...catalog, ...bulk]
      .filter((order) => order.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bulkOrders, catalogOrders]);

  const waitingForSeller = orders.filter((order) => ['pending', 'draft', 'quote_sent'].includes(order.status)).length;
  const paymentDue = orders.filter((order) => ['accepted', 'confirmed'].includes(order.status) && order.paymentStatus !== 'paid').length;
  const inProgress = orders.filter((order) => ['paid', 'fulfilled', 'shipped'].includes(order.status)).length;
  const loading = catalogLoading || bulkLoading;
  const error = catalogError || bulkError || '';

  const refresh = async () => {
    await Promise.all([loadCatalog(), refreshBulk()]);
  };

  if (authLoading || !user || !profile) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f1f1f1] dark:bg-background"><div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /></main>;
  }

  return (
    <main className="ft-storefront min-h-screen">
      <Header />
      <div className="pt-16">
        <section className="border-b border-border bg-card/80 backdrop-blur-xl">
          <div className="ft-storefront-content py-7 sm:py-9">
            <p className="ft-route-kicker">Order hub</p>
            <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-800 tracking-tight text-foreground sm:text-4xl">Purchase and payment workflow</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Choose an approved live product, submit the permitted quantity, wait for seller confirmation where required, pay the server-calculated amount through Razorpay, then follow fulfilment and tracking from your account.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/marketplace" className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">Browse approved products <Icon name="ArrowRightIcon" size={15} /></Link>
                <Link href="/buyer-dashboard?tab=orders" className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm"><Icon name="ShoppingBagIcon" size={16} /> Manage all orders</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="ft-storefront-content py-6 sm:py-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Awaiting seller', waitingForSeller, 'Submitted orders still awaiting seller action', 'ClockIcon', 'text-warning bg-warning/10'],
              ['Payment due', paymentDue, 'Accepted/confirmed orders ready for Razorpay', 'CreditCardIcon', 'text-primary bg-primary/10'],
              ['In progress', inProgress, 'Paid, fulfilled or shipped orders', 'TruckIcon', 'text-success bg-success/10'],
            ].map(([label, value, detail, icon, tone]) => <article key={String(label)} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon name={icon as 'ClockIcon'} size={19} /></span><p className="mt-4 text-2xl font-800 text-foreground">{loading ? '—' : value}</p><p className="mt-1 text-sm font-800 text-foreground">{label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></article>)}
          </div>

          {error && <div role="alert" className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error"><span>{error}</span><button type="button" onClick={() => void refresh()} className="font-800 underline">Retry</button></div>}

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-800 uppercase tracking-wider text-primary">Current orders</p><h2 className="mt-1 text-xl font-800 text-foreground">Catalogue + bulk activity</h2></div><button type="button" onClick={() => void refresh()} disabled={loading} className="ft-icon-button" aria-label="Refresh order hub"><Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} /></button></div>
              <div className="mt-5 divide-y divide-border">
                {!loading && orders.length === 0 && <div className="py-10 text-center"><Icon name="ShoppingBagIcon" size={32} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-800 text-foreground">No orders yet</p><p className="mt-1 text-xs text-muted-foreground">Submit a real order from an approved product page.</p></div>}
                {orders.slice(0, 8).map((order) => <Link key={`${order.kind}:${order.id}`} href="/buyer-dashboard?tab=orders" className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon name="ShoppingBagIcon" size={17} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="block truncate text-sm font-800 text-foreground">{order.ref}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 uppercase text-muted-foreground">{order.kind}</span></span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{order.product} · {statusLabel(order.status)} · {statusLabel(order.paymentStatus)}</span></span><span className="text-sm font-800 text-foreground">{formatMoney(order.total)}</span></Link>)}
              </div>
              {orders.length > 0 && <Link href="/buyer-dashboard?tab=orders" className="ft-secondary-action mt-5 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">Open full order workspace <Icon name="ArrowRightIcon" size={15} /></Link>}
            </article>

            <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <p className="text-xs font-800 uppercase tracking-wider text-secondary">What happens next</p>
              <h2 className="mt-1 text-xl font-800 text-foreground">From product to delivery</h2>
              <ol className="mt-5 space-y-4">
                {[
                  ['Choose live inventory', 'Open an approved seller product and choose a permitted quantity/variant for your buyer type.'],
                  ['Order is created', 'FabricTrad stores the order in Supabase and recalculates stock, buyer limits, price and GST on the server.'],
                  ['Seller confirms', 'Orders that require seller confirmation stay unpaid until the seller accepts them.'],
                  ['Pay securely', 'Razorpay checkout uses the amount reloaded from the saved order; the backend verifies the payment signature/capture.'],
                  ['Track delivery', 'Seller shipment records, AWB, courier tracking and disputes remain attached to your account.'],
                ].map(([title, detail], index) => <li key={title} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-800 text-primary">{index + 1}</span><span><span className="block text-sm font-800 text-foreground">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span></li>)}
              </ol>
              <div className="mt-6 rounded-xl border border-success/20 bg-success/10 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Live data only:</strong> this page now combines actual catalogue and bulk orders for the signed-in buyer rather than presenting a fake shopping cart.</div>
            </article>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
