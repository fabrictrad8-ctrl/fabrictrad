'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useBuyerBulkOrders } from '@/lib/hooks/useAccountOrders';

const statusLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export default function OrderHubPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const { orders, loading, error, refresh } = useBuyerBulkOrders();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?next=%2Fcart');
    }
  }, [authLoading, router, user]);

  const waitingForSeller = orders.filter((order) =>
    ['draft', 'quote_sent'].includes(order.status || 'draft')
  ).length;
  const paymentDue = orders.filter((order) => order.status === 'confirmed').length;
  const inProgress = orders.filter((order) =>
    ['paid', 'shipped'].includes(order.status || '')
  ).length;

  if (authLoading || !user || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f1f1f1] dark:bg-background">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
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
                <h1 className="text-3xl font-800 tracking-tight text-foreground sm:text-4xl">
                  Purchase and payment workflow
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  FabricTrad uses seller-confirmed ordering rather than a conventional anonymous cart. Choose a live product and quantity, wait for the seller to confirm stock, then pay and track the order from your account.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/marketplace" className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                  Browse approved products <Icon name="ArrowRightIcon" size={15} />
                </Link>
                <Link href="/buyer-dashboard?tab=orders" className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                  <Icon name="ShoppingBagIcon" size={16} /> Manage all orders
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="ft-storefront-content py-6 sm:py-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Awaiting seller', waitingForSeller, 'Seller is checking stock and quantity', 'ClockIcon', 'text-warning bg-warning/10'],
              ['Payment due', paymentDue, 'Confirmed orders ready for Razorpay', 'CreditCardIcon', 'text-primary bg-primary/10'],
              ['In progress', inProgress, 'Paid or shipped orders', 'TruckIcon', 'text-success bg-success/10'],
            ].map(([label, value, detail, icon, tone]) => (
              <article key={String(label)} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                  <Icon name={icon as 'ClockIcon'} size={19} />
                </span>
                <p className="mt-4 text-2xl font-800 text-foreground">{loading ? '—' : value}</p>
                <p className="mt-1 text-sm font-800 text-foreground">{label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
              </article>
            ))}
          </div>

          {error && (
            <div role="alert" className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
              <span>{error}</span>
              <button type="button" onClick={() => void refresh()} className="font-800 underline">Retry</button>
            </div>
          )}

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-800 uppercase tracking-wider text-primary">Current orders</p>
                  <h2 className="mt-1 text-xl font-800 text-foreground">Recent bulk order activity</h2>
                </div>
                <button type="button" onClick={() => void refresh()} disabled={loading} className="ft-icon-button" aria-label="Refresh order hub">
                  <Icon name="ArrowPathIcon" size={17} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="mt-5 divide-y divide-border">
                {!loading && orders.length === 0 && (
                  <div className="py-10 text-center">
                    <Icon name="ShoppingBagIcon" size={32} className="mx-auto text-muted-foreground" />
                    <p className="mt-3 text-sm font-800 text-foreground">No bulk orders yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Open an approved product to select a live variant and quantity.</p>
                  </div>
                )}
                {orders.slice(0, 6).map((order) => (
                  <Link key={order.id} href="/buyer-dashboard?tab=orders" className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Icon name="ShoppingBagIcon" size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-800 text-foreground">FT-BULK-{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="block truncate text-xs capitalize text-muted-foreground">{statusLabel(order.status || 'draft')}</span>
                    </span>
                    <span className="text-sm font-800 text-foreground">₹{Number(order.net_total || 0).toLocaleString('en-IN')}</span>
                  </Link>
                ))}
              </div>

              {orders.length > 0 && (
                <Link href="/buyer-dashboard?tab=orders" className="ft-secondary-action mt-5 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                  Open full order workspace <Icon name="ArrowRightIcon" size={15} />
                </Link>
              )}
            </article>

            <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <p className="text-xs font-800 uppercase tracking-wider text-secondary">What happens next</p>
              <h2 className="mt-1 text-xl font-800 text-foreground">From product to delivery</h2>
              <ol className="mt-5 space-y-4">
                {[
                  ['Choose live inventory', 'Select an approved product, colour/design variant, quantity and buyer type.'],
                  ['Seller confirms', 'The seller accepts, adjusts or rejects based on live colour-level stock and dispatch capacity.'],
                  ['Pay securely', 'A confirmed order opens Razorpay checkout. FabricTrad verifies the payment signature and records capture status.'],
                  ['Receive documents', 'Download the FabricTrad order summary/payment receipt. The seller supplies the final GST tax invoice separately.'],
                  ['Track and resolve', 'Shiprocket status, delivery progress, messages and disputes remain attached to the order.'],
                ].map(([title, detail], index) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-800 text-primary">{index + 1}</span>
                    <span>
                      <span className="block text-sm font-800 text-foreground">{title}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-6 rounded-xl border border-warning/20 bg-warning/10 p-4 text-xs leading-5 text-muted-foreground">
                <strong className="text-foreground">No fake quotation cart:</strong> product names, prices, stock, tax and seller details are taken from approved live records. An order is not payable until the seller confirms it.
              </div>
            </article>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
