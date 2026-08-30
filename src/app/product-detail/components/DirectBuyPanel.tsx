'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useProduct } from '@/lib/hooks/useProduct';
import { trackFunnelStep } from '@/lib/analytics';

type CheckoutOrder = {
  id: string;
  totalAmount: number;
  reservationExpiresAt?: string;
};

type RazorpayOrderPayload = {
  keyId?: string;
  razorpayOrderId?: string;
  amount?: number;
  currency?: string;
  orderType?: string;
  orderId?: string;
  error?: string;
};

type RazorpayVerifyPayload = {
  status?: string;
  error?: string;
};

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (payload: unknown) => void) => void;
    };
  }
}

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value || 0);

async function ensureRazorpayScript() {
  if (typeof window === 'undefined') return false;
  if (window.Razorpay) return true;
  const existing = document.querySelector<HTMLScriptElement>('script[data-fabrictrad-razorpay]');
  if (existing) {
    return new Promise<boolean>((resolve) => {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
    });
  }
  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.fabrictradRazorpay = 'true';
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function DirectBuyPanel() {
  const { product, loading } = useProduct();
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const selectedVariant = product.variants?.find((variant) => variant.id === product.selectedVariantId) || product.variants?.[0] || null;
  const available = Math.max(0, Number(selectedVariant?.available ?? product.available ?? 0));
  const minimum = Math.max(0.01, Number(selectedVariant?.moq ?? product.moq ?? 1));
  const unit = selectedVariant?.unit || product.unit || 'unit';
  const increment = unit === 'mtr' || unit === 'metre' || unit === 'kg' ? 0.5 : 1;
  const displayPrice = Number(selectedVariant?.price || product.price || 0);
  const [quantity, setQuantity] = useState(minimum);
  const [buying, setBuying] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState<CheckoutOrder | null>(null);
  const lowStockThreshold = Math.max(minimum * 3, 10);
  const lowStock = available > 0 && available <= lowStockThreshold;

  const clampQuantity = (value: number) => {
    if (!Number.isFinite(value)) return minimum;
    const bounded = Math.max(minimum, Math.min(available, value));
    const steps = Math.round((bounded - minimum) / increment);
    return Number(Math.min(available, minimum + steps * increment).toFixed(2));
  };

  const changeVariant = (variantId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('variant', variantId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    setCheckoutOrder(null);
  };

  const verifyPayment = async (success: RazorpaySuccess, orderId: string) => {
    const response = await fetch('/api/razorpay/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({
        orderId,
        orderType: 'catalog',
        razorpayOrderId: success.razorpay_order_id,
        razorpayPaymentId: success.razorpay_payment_id,
        razorpaySignature: success.razorpay_signature,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as RazorpayVerifyPayload;
    if (!response.ok) throw new Error(payload.error || 'Payment verification failed.');
    trackFunnelStep('checkout_complete', { order_id: orderId, product_id: product.id });
    toast.success(payload.status === 'captured' ? 'Payment captured. Your order is confirmed.' : 'Payment verified.');
    router.push(`/buyer-dashboard?tab=orders&order=${encodeURIComponent(orderId)}`);
  };

  const openPayment = async (order: CheckoutOrder) => {
    const scriptReady = await ensureRazorpayScript();
    if (!scriptReady || !window.Razorpay) throw new Error('Razorpay checkout could not be loaded. Please retry.');
    const response = await fetch('/api/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ orderId: order.id, orderType: 'catalog' }),
    });
    const payload = (await response.json().catch(() => ({}))) as RazorpayOrderPayload;
    if (!response.ok || !payload.keyId || !payload.razorpayOrderId || !payload.amount) {
      throw new Error(payload.error || 'Unable to prepare Razorpay checkout.');
    }
    trackFunnelStep('checkout_start', { order_id: order.id, product_id: product.id });
    const checkout = new window.Razorpay({
      key: payload.keyId,
      amount: payload.amount,
      currency: payload.currency || 'INR',
      name: 'FabricTrad',
      description: product.name,
      order_id: payload.razorpayOrderId,
      prefill: { email: user?.email || '' },
      notes: { fabrictrad_order_id: order.id, order_type: 'catalog' },
      theme: { color: '#d66500' },
      handler: (result: RazorpaySuccess) => void verifyPayment(result, order.id).catch((error) => toast.error(error.message)),
      modal: { ondismiss: () => toast('Stock remains reserved for 30 minutes. You can resume payment from your orders.') },
    });
    checkout.on('payment.failed', () => toast.error('Payment failed. Your stock reservation remains available briefly so you can retry.'));
    checkout.open();
  };

  const buyNow = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`${pathname}?${searchParams.toString()}`)}`);
      return;
    }
    if (profile?.can_buy === false || profile?.role === 'seller') {
      toast.error('This account is not enabled for buyer checkout.');
      return;
    }
    if (!product.rawProductId || !product.sellerId || product.source !== 'seller') {
      toast.error('This product is not available for direct checkout.');
      return;
    }
    if (available <= 0) return toast.error('This item is out of stock.');
    if (quantity > available) return toast.error(`Only ${available} ${unit} are currently available.`);
    if (quantity < minimum) return toast.error(`Minimum purchase is ${minimum} ${unit}.`);

    setBuying(true);
    try {
      const { data, error } = await supabase.rpc('buy_catalog_now', {
        p_product_id: product.rawProductId,
        p_variant_id: selectedVariant?.id || null,
        p_quantity: quantity,
        p_company_id: null,
        p_company_location_id: null,
        p_purchase_order_number: null,
        p_notes: `Direct Buy Now · ${product.name}`,
      });
      if (error) throw error;
      const row = data as Record<string, unknown> | null;
      const orderId = String(row?.id || '');
      const totalAmount = Number(row?.totalAmount || 0);
      if (!orderId || !(totalAmount > 0)) throw new Error('The server could not create a payable order.');
      const order = {
        id: orderId,
        totalAmount,
        reservationExpiresAt: row?.reservationExpiresAt ? String(row.reservationExpiresAt) : undefined,
      };
      setCheckoutOrder(order);
      await openPayment(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Buy now failed.';
      toast.error(/available stock|quantity/i.test(message) ? 'The requested quantity is no longer available. Refresh and choose a lower quantity.' : message);
    } finally {
      setBuying(false);
    }
  };

  if (loading) return <div className="h-[26rem] animate-pulse rounded-2xl border border-border bg-muted" />;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-direct-buy-now="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-850 uppercase text-success">Live stock</span>
            {lowStock && <span className="rounded-full bg-warning/10 px-2 py-1 text-[10px] font-850 uppercase text-warning">Low in stock</span>}
          </div>
          <h1 className="mt-2 text-xl font-850 leading-snug text-foreground">{product.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{product.seller} · {product.city}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-muted px-2 py-1 text-[10px] font-800 text-muted-foreground">No seller approval</span>
      </div>

      {!!product.variants?.length && (
        <div className="mt-5">
          <p className="text-xs font-850 uppercase tracking-wide text-muted-foreground">Colour / design</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button key={variant.id} type="button" onClick={() => changeVariant(variant.id)} disabled={variant.available <= 0} className={`rounded-xl border px-3 py-2 text-xs font-750 ${variant.id === selectedVariant?.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground'} disabled:cursor-not-allowed disabled:opacity-40`}>
                {variant.colorName} · {variant.designName}{variant.available <= 0 ? ' · Sold out' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs text-muted-foreground">Current unit price</p><p className="mt-1 text-2xl font-900 text-foreground">{money(displayPrice)}<span className="ml-1 text-sm font-700 text-muted-foreground">/{unit}</span></p></div>
          <div className="text-right"><p className={`text-sm font-850 ${lowStock ? 'text-warning' : available > 0 ? 'text-success' : 'text-error'}`}>{available <= 0 ? 'Out of stock' : lowStock ? `Only ${available.toLocaleString('en-IN')} ${unit} left` : `${available.toLocaleString('en-IN')} ${unit} in stock`}</p><p className="mt-1 text-[11px] text-muted-foreground">Server stock is rechecked at checkout</p></div>
        </div>
      </div>

      <div className="mt-5">
        <label className="text-sm font-800 text-foreground">Quantity ({unit})</label>
        <div className="mt-2 grid grid-cols-[48px_minmax(0,1fr)_48px] gap-2">
          <button type="button" onClick={() => setQuantity(clampQuantity(quantity - increment))} className="ft-icon-button" disabled={quantity <= minimum}><Icon name="MinusIcon" size={17} /></button>
          <input type="number" min={minimum} max={available || undefined} step={increment} value={quantity} onChange={(event) => setQuantity(clampQuantity(Number(event.target.value)))} className="input-base min-w-0 px-4 py-3 text-center font-850" />
          <button type="button" onClick={() => setQuantity(clampQuantity(quantity + increment))} className="ft-icon-button" disabled={quantity >= available}><Icon name="PlusIcon" size={17} /></button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Minimum {minimum} {unit}. The database locks the stock row before accepting this quantity, so simultaneous buyers cannot oversell the listing.</p>
      </div>

      <div className="mt-5 rounded-xl border border-success/20 bg-success/5 p-3 text-xs leading-5 text-muted-foreground">
        <span className="font-850 text-foreground">Direct checkout:</span> Buy now checks live inventory atomically, reserves the exact quantity for 30 minutes and opens Razorpay immediately. No seller acceptance step is required.
      </div>

      <button type="button" onClick={() => void buyNow()} disabled={buying || available <= 0 || quantity > available} className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#d66500] px-4 py-3 text-sm font-900 text-white shadow-sm transition hover:bg-[#bd5900] disabled:cursor-not-allowed disabled:opacity-50">
        <Icon name="BoltIcon" size={18} /> {buying ? 'Checking stock & opening payment…' : 'Buy now'}
      </button>

      {checkoutOrder && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          Order FT-CAT-{checkoutOrder.id.slice(0, 8).toUpperCase()} · {money(checkoutOrder.totalAmount)}. If Razorpay was closed, <button type="button" className="font-850 text-primary underline" onClick={() => void openPayment(checkoutOrder).catch((error) => toast.error(error.message))}>resume payment</button>.
        </div>
      )}
    </div>
  );
}
