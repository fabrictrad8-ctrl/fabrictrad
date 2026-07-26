'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useProduct } from '@/lib/hooks/useProduct';

export default function ProductInfo() {
  const { product, loading } = useProduct();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedVariant = product.variants?.find(
    (variant) => variant.id === product.selectedVariantId
  );
  const minimum = Math.max(1, Math.ceil(selectedVariant?.moq || product.moq || 1));
  const available = Math.max(0, selectedVariant?.available ?? product.available);
  const price = selectedVariant?.price || product.price;
  const unit = selectedVariant?.unit || product.unit;
  const [qty, setQty] = useState(minimum);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setQty(minimum);
  }, [minimum, product.selectedVariantId]);

  const estimatedTotal = useMemo(() => qty * price, [price, qty]);

  const selectVariant = (variantId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('variant', variantId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  if (loading) {
    return <div className="h-[32rem] animate-pulse rounded-2xl border border-border bg-muted" />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {product.source === 'seller' && <span className="tag-new">Live catalogue</span>}
            <span className="badge-gstin">GST Ready</span>
            {!!product.variantCount && (
              <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-800 text-secondary">
                {product.variantCount} variation{product.variantCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <h1 className="text-lg font-800 leading-snug text-foreground">{product.name}</h1>
          {product.sku && <p className="mt-1 text-xs text-muted-foreground">SKU {product.sku}</p>}
        </div>
        <button
          type="button"
          onClick={() => setSaved((current) => !current)}
          className={`shrink-0 rounded-xl border p-2 transition-all ${
            saved
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
          }`}
          aria-label={saved ? 'Remove from saved products' : 'Save product'}
        >
          <Icon name="HeartIcon" size={18} variant={saved ? 'solid' : 'outline'} />
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon name="ShieldCheckIcon" size={14} className="text-success" />
        <span>{product.seller}</span>
        <span>·</span>
        <span>{product.city}</span>
      </div>

      {!!product.variants?.length && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">
              Select colour / design
            </p>
            <span className="text-xs text-muted-foreground">
              {product.variants.filter((variant) => variant.available > 0).length} in stock
            </span>
          </div>
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {product.variants.map((variant) => {
              const active = variant.id === product.selectedVariantId;
              const unavailable = variant.available <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => selectVariant(variant.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                      : 'border-border hover:border-primary/50'
                  } ${unavailable ? 'opacity-55' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-black/10 shadow-sm"
                      style={{ backgroundColor: variant.colorHex || '#d1d5db' }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-800 text-foreground">{variant.colorName}</p>
                      <p className="truncate text-xs text-muted-foreground">{variant.designName}</p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-800 text-primary">
                          ₹{variant.price.toLocaleString('en-IN')}/{variant.unit}
                        </span>
                        <span className={unavailable ? 'text-error' : 'text-success'}>
                          {unavailable ? 'Out of stock' : `${variant.available.toLocaleString('en-IN')} ${variant.unit}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedVariant && (
        <div className="mb-4 rounded-xl border border-secondary/20 bg-secondary/5 p-3">
          <p className="text-sm font-800 text-foreground">
            {selectedVariant.colorName} · {selectedVariant.designName}
          </p>
          {selectedVariant.description && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {selectedVariant.description}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 flex items-end gap-2">
        <span className="text-3xl font-800 text-primary">₹{price.toLocaleString('en-IN')}</span>
        <span className="mb-1 text-sm text-muted-foreground">per {unit}</span>
        {product.priceMax && product.priceMax > product.price && !selectedVariant && (
          <span className="mb-1 text-xs text-muted-foreground">
            – ₹{product.priceMax.toLocaleString('en-IN')}
          </span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-muted p-3">
          <p className="text-muted-foreground">Available</p>
          <p className="mt-1 font-800 text-foreground">
            {available.toLocaleString('en-IN')} {unit}
          </p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-muted-foreground">Minimum order</p>
          <p className="mt-1 font-800 text-foreground">
            {minimum.toLocaleString('en-IN')} {unit}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-700 text-foreground">Quantity ({unit})</p>
          <span className="text-xs text-muted-foreground">Max {available.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQty((current) => Math.max(minimum, current - 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted hover:border-primary"
          >
            <Icon name="MinusIcon" size={16} />
          </button>
          <input
            type="number"
            value={qty}
            min={minimum}
            max={available || undefined}
            step={unit === 'mtr' || unit === 'kg' ? 0.5 : 1}
            onChange={(event) => {
              const next = Number(event.target.value);
              setQty(Math.max(minimum, available ? Math.min(available, next) : next));
            }}
            className="input-base flex-1 rounded-xl px-3 py-2 text-center text-sm font-700"
          />
          <button
            type="button"
            onClick={() => setQty((current) => (available ? Math.min(available, current + 1) : current + 1))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted hover:border-primary"
          >
            <Icon name="PlusIcon" size={16} />
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-muted p-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {qty} {unit} × ₹{price.toLocaleString('en-IN')}
          </span>
          <span className="font-700 text-foreground">₹{estimatedTotal.toLocaleString('en-IN')}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-muted-foreground">GST (5%)</span>
          <span className="font-700 text-foreground">
            ₹{Math.round(estimatedTotal * 0.05).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-800">
          <span>Estimated total</span>
          <span className="text-primary">
            ₹{Math.round(estimatedTotal * 1.05).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-3">
        <Icon name="TruckIcon" size={16} className="shrink-0 text-success" />
        <div>
          <p className="text-xs font-700 text-success">
            Dispatch in {product.dispatchDays} business day{product.dispatchDays === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-muted-foreground">Tracking included</p>
        </div>
      </div>

      {orderSubmitted ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 p-4">
          <Icon name="CheckCircleIcon" size={20} className="text-success" />
          <span className="text-sm font-700 text-success">Order request submitted.</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOrderSubmitted(true);
            window.setTimeout(() => setOrderSubmitted(false), 3000);
          }}
          disabled={available <= 0}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="ShoppingCartIcon" size={16} />
          {available > 0 ? 'Submit order request' : 'Selected variation is out of stock'}
        </button>
      )}
    </div>
  );
}
