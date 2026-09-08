'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { cartItemHref, useCart } from '@/lib/hooks/useCart';

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

export default function CartPage() {
  const { items, lineCount, estimatedTotal, remove, updateQuantity, clear } = useCart();

  return (
    <main className="ft-storefront min-h-screen">
      <Header />
      <div className="pt-16">
        <section className="ft-cart-page ft-storefront-content py-5 sm:py-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="ft-route-kicker">Buyer cart</p>
              <h1 className="mt-1 text-2xl font-850 tracking-tight text-foreground sm:text-3xl">
                Shopping Cart
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {lineCount === 0
                  ? 'Your cart is empty.'
                  : `${lineCount} product${lineCount === 1 ? '' : 's'} ready to review.`}
              </p>
            </div>
            {lineCount > 0 && (
              <button type="button" onClick={clear} className="text-xs font-800 text-primary hover:underline">
                Clear cart
              </button>
            )}
          </div>

          {lineCount === 0 ? (
            <div className="rounded-xl border border-border bg-card px-5 py-16 text-center shadow-sm">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon name="ShoppingCartIcon" size={27} />
              </span>
              <h2 className="mt-4 text-xl font-850 text-foreground">Your cart is waiting</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Browse verified textile listings and use Add to cart to keep products together before placing order requests.
              </p>
              <Link href="/marketplace" className="ft-amazon-primary mt-5 inline-flex min-h-10 items-center justify-center gap-2 px-5 text-sm font-800">
                Continue shopping <Icon name="ArrowRightIcon" size={15} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-label="Cart items">
                <div className="hidden border-b border-border px-5 py-3 text-right text-xs text-muted-foreground sm:block">
                  Price / quantity
                </div>
                <div className="divide-y divide-border">
                  {items.map((item) => {
                    const subtotal = item.price * item.quantity;
                    return (
                      <article key={item.key} className="grid gap-4 p-4 sm:grid-cols-[132px_minmax(0,1fr)_170px] sm:p-5">
                        <Link href={cartItemHref(item)} className="relative block aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                          <AppImage src={item.image} alt={item.name} fill sizes="132px" className="object-cover" />
                        </Link>

                        <div className="min-w-0">
                          <Link href={cartItemHref(item)} className="line-clamp-2 text-base font-800 leading-6 text-foreground hover:text-[#b12704]">
                            {item.name}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">Sold by {item.seller}</p>
                          {item.variantLabel && (
                            <p className="mt-2 text-xs text-foreground">
                              <span className="font-800">Variant:</span> {item.variantLabel}
                            </p>
                          )}
                          <p className="mt-1 text-xs font-750 text-success">
                            {item.available > 0 ? `${item.available.toLocaleString('en-IN')} ${item.unit} available` : 'Availability will be rechecked'}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Minimum {item.minimum} {item.unit}. Final buyer-specific price, MOQ and GST are revalidated before the order request is submitted.
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-xs font-700 text-foreground">
                              Qty
                              <input
                                type="number"
                                min={item.minimum}
                                max={item.available || undefined}
                                step={item.unit === 'mtr' || item.unit === 'kg' ? 0.5 : 1}
                                value={item.quantity}
                                onChange={(event) => updateQuantity(item.key, Number(event.target.value))}
                                className="w-24 rounded-lg border border-border bg-white px-2 py-1.5 text-center text-xs font-800 outline-none focus:border-primary"
                              />
                            </label>
                            <button type="button" onClick={() => remove(item.key)} className="text-xs font-800 text-primary hover:underline">
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col items-start sm:items-end">
                          <p className="text-base font-850 text-foreground">{money(subtotal)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{money(item.price)}/{item.unit}</p>
                          <Link href={cartItemHref(item)} className="ft-amazon-secondary mt-auto inline-flex min-h-9 items-center justify-center gap-1.5 px-3 text-xs font-800">
                            Review & order <Icon name="ChevronRightIcon" size={13} />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="sticky top-20 rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-xs leading-5 text-success">
                  <Icon name="ShieldCheckIcon" size={17} className="mt-0.5 shrink-0" />
                  <span>Stock and account-specific purchasing rules are checked again before any order is created.</span>
                </div>
                <div className="mt-5 flex items-baseline justify-between gap-3">
                  <span className="text-sm text-foreground">Estimated subtotal ({lineCount} item{lineCount === 1 ? '' : 's'}):</span>
                  <strong className="text-xl font-850 text-foreground">{money(estimatedTotal)}</strong>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  This is a shopping estimate. Contract pricing, GST, quantity limits and seller acceptance are confirmed on each product before payment.
                </p>
                <Link href={cartItemHref(items[0])} className="ft-amazon-primary mt-4 flex min-h-11 w-full items-center justify-center text-sm font-850">
                  Start order review
                </Link>
                <Link href="/marketplace" className="mt-3 flex min-h-10 w-full items-center justify-center text-xs font-800 text-primary hover:underline">
                  Continue shopping
                </Link>
                {lineCount > 1 && (
                  <div className="mt-4 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground">
                    FabricTrad orders can have different sellers, buyer rules and approval steps. Review each cart line before submission rather than silently combining incompatible seller orders.
                  </div>
                )}
              </aside>
            </div>
          )}
        </section>
      </div>
      <Footer />
    </main>
  );
}
