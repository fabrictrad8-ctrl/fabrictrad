'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { BESPOKE_STAGES, BESPOKE_STAGE_LABELS, type BespokeStage } from '@/lib/bespokeWorkflow';

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description?: string | null;
  price_per_unit?: number | string | null;
  unit?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  fabric_name?: string | null;
  quality?: string | null;
  product_type?: string | null;
  work_type?: string | null;
  origin_city?: string | null;
  origin_state?: string | null;
};

type Store = {
  id: string;
  store_name: string;
  store_handle: string;
  is_primary: boolean;
};

type Appointment = {
  id: string;
  appointment_type: string;
  requested_at: string;
  status: string;
};

type BespokeOrder = {
  id: string;
  stage: BespokeStage;
  product_id?: string | null;
  buyer_store_id?: string | null;
  reference_image_path?: string | null;
  fabric_selection?: Record<string, unknown> | null;
  customization?: Record<string, unknown> | null;
  measurement?: Record<string, unknown> | null;
  quotation?: Record<string, unknown> | null;
  quoted_amount?: number | null;
  advance_amount?: number | null;
  paid_amount?: number | null;
  balance_amount?: number | null;
  payment_choice?: 'advance' | 'full' | null;
  payment_status?: string;
  stitching_status?: string;
  embroidery_status?: string;
  human_action_required?: boolean;
  human_action_reason?: string | null;
  delivery_mode?: 'delivery' | 'pickup' | null;
  delivery_details?: Record<string, unknown> | null;
  review_rating?: number | null;
  review_text?: string | null;
  created_at?: string;
  updated_at?: string;
};

type RazorpayInstance = { open: () => void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}


const asText = (value: unknown) => (typeof value === 'string' ? value : '');
const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const loadRazorpay = async () => {
  if (window.Razorpay) return true;
  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-fabrictrad-razorpay="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.fabrictradRazorpay = '1';
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
};

function Timeline({ stage }: { stage: BespokeStage }) {
  const currentIndex = BESPOKE_STAGES.indexOf(stage);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-center gap-1.5">
        {BESPOKE_STAGES.map((item, index) => (
          <div
            key={item}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-700 ${
              item === stage
                ? 'border-primary/40 bg-primary/10 text-primary'
                : index < currentIndex
                  ? 'border-success/25 bg-success/10 text-success'
                  : 'border-border bg-card text-muted-foreground'
            }`}
          >
            <span>{index < currentIndex ? '✓' : index + 1}</span>
            {BESPOKE_STAGE_LABELS[item]}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomOrderClient() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [order, setOrder] = useState<BespokeOrder | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [query, setQuery] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fabric, setFabric] = useState('');
  const [customization, setCustomization] = useState('');
  const [measurementMode, setMeasurementMode] = useState<'physical' | 'saved'>('physical');
  const [measurements, setMeasurements] = useState('');
  const [appointmentAt, setAppointmentAt] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState<'store' | 'customer_address' | 'video_call'>('store');
  const [deliveryMode, setDeliveryMode] = useState<'delivery' | 'pickup'>('delivery');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const requestedOrderId = searchParams.get('order') || '';
  const requestedPay = searchParams.get('pay') === '1';
  const requestedChoice = searchParams.get('choice') === 'advance' ? 'advance' : 'full';

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === order?.product_id) || null,
    [order?.product_id, products]
  );

  const fetchProducts = useCallback(async (q = '') => {
    const response = await fetch(`/api/bespoke/catalogue${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Catalogue could not be loaded.');
    setProducts(payload.products || []);
  }, []);

  const fetchStores = useCallback(async () => {
    const response = await fetch('/api/buyer/stores', { cache: 'no-store', credentials: 'same-origin' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const nextStores = (payload.stores || []) as Store[];
    setStores(nextStores);
    setSelectedStoreId((current) => current || nextStores.find((item) => item.is_primary)?.id || nextStores[0]?.id || '');
  }, []);

  const fetchOrder = useCallback(async (id: string) => {
    if (!id) return;
    const response = await fetch(`/api/bespoke/orders/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Custom order could not be loaded.');
    setOrder(payload.order || null);
    setAppointments(payload.appointments || []);
    const next = payload.order as BespokeOrder | undefined;
    setFabric(asText(next?.fabric_selection?.description));
    setCustomization(asText(next?.customization?.description));
    setMeasurements(asText(next?.measurement?.description));
    if (next?.measurement?.mode === 'saved') setMeasurementMode('saved');
    if (next?.delivery_mode) setDeliveryMode(next.delivery_mode);
    if (next?.review_rating) setReviewRating(next.review_rating);
    if (next?.review_text) setReviewText(next.review_text);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?role=buyer&next=${encodeURIComponent('/custom-order')}`);
      return;
    }
    if (profile && (profile.can_buy === false || profile.is_active === false)) {
      router.replace('/marketplace');
      return;
    }
    Promise.all([fetchProducts(), fetchStores()]).catch((caught) => setError(caught instanceof Error ? caught.message : 'Setup failed.'));
  }, [fetchProducts, fetchStores, loading, profile, router, user]);

  useEffect(() => {
    if (!user || !requestedOrderId) return;
    fetchOrder(requestedOrderId).catch((caught) => setError(caught instanceof Error ? caught.message : 'Order could not be loaded.'));
  }, [fetchOrder, requestedOrderId, user]);

  const patchOrder = async (body: Record<string, unknown>) => {
    if (!order?.id) throw new Error('Start a custom order first.');
    const response = await fetch(`/api/bespoke/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Order could not be updated.');
    setOrder(payload.order || order);
    if (payload.appointment) setAppointments((current) => [payload.appointment, ...current]);
    return payload.order as BespokeOrder;
  };

  const run = async (task: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
      if (success) setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const startWithProduct = (productId: string) =>
    run(async () => {
      const response = await fetch('/api/bespoke/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ productId, storeId: selectedStoreId || undefined, source: 'website' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Custom order could not be started.');
      const created = payload.order as BespokeOrder;
      setOrder(created);
      router.replace(`/custom-order?order=${created.id}`);
    }, 'Custom order started. Add a reference image or continue without one.');

  const uploadReferenceImage = (file: File | null) =>
    run(async () => {
      if (!user || !order?.id) throw new Error('Start an order first.');
      if (!file) {
        await patchOrder({ action: 'reference_image', referenceImagePath: null, referenceImageMeta: { skipped: true } });
        return;
      }
      if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
        throw new Error('Reference image must be an image up to 10 MB.');
      }
      const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'jpg';
      const path = `${user.id}/web/${order.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('buyer-reference-images').upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      await patchOrder({
        action: 'reference_image',
        referenceImagePath: path,
        referenceImageMeta: { source: 'website', filename: file.name, mime_type: file.type, size: file.size },
      });
    }, file ? 'Reference image saved privately.' : 'Continuing without a reference image.');

  const pay = (choice: 'advance' | 'full') =>
    run(async () => {
      if (!order?.id) throw new Error('Custom order not found.');
      const scriptReady = await loadRazorpay();
      if (!scriptReady || !window.Razorpay) throw new Error('Secure Razorpay checkout could not load.');
      const response = await fetch('/api/bespoke/payment/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orderId: order.id, choice }),
      });
      const payment = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payment.error || 'Payment could not be started.');

      await new Promise<void>((resolve, reject) => {
        if (!window.Razorpay) return reject(new Error('Razorpay checkout is unavailable.'));
        const checkout = new window.Razorpay({
          key: payment.keyId,
          amount: payment.amount,
          currency: 'INR',
          name: 'FabricTrad',
          description: `Custom order ${order.id.slice(0, 8).toUpperCase()} · ${payment.purpose}`,
          order_id: payment.razorpayOrderId,
          prefill: { name: profile?.full_name || '', email: user?.email || '', contact: profile?.phone || '' },
          theme: {},
          handler: async (result: Record<string, string>) => {
            try {
              const verifyResponse = await fetch('/api/bespoke/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ orderId: order.id, ...result }),
              });
              const verify = await verifyResponse.json().catch(() => ({}));
              if (!verifyResponse.ok) throw new Error(verify.error || 'Payment verification failed.');
              setOrder(verify.order || order);
              resolve();
            } catch (caught) {
              reject(caught);
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment checkout was closed before completion.')) },
        });
        checkout.open();
      });
    }, 'Payment verified. Your custom order has moved to the next stage.');

  useEffect(() => {
    if (!order || !requestedPay || !['advance_or_full_payment', 'balance_payment'].includes(order.stage)) return;
    const timer = window.setTimeout(() => void pay(requestedChoice), 250);
    return () => window.clearTimeout(timer);
    // Only auto-open once for a freshly loaded payment deep-link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, requestedPay]);

  if (loading || (user && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  const currentStage = order?.stage || 'catalogue';
  const quote = Number(order?.quoted_amount || 0);
  const paid = Number(order?.paid_amount || 0);
  const balance = Math.max(0, quote - paid);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <header className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <AppLogo size={42} />
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.18em] text-primary">Custom commerce</p>
              <h1 className="mt-1 text-2xl font-900 tracking-tight text-foreground sm:text-3xl">FabricTrad Custom Order Studio</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Manage your custom order here, including appointments, design approval, payment, fitting and customer support. WhatsApp is reserved for seller product uploads.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/buyer-dashboard" className="btn-secondary px-4 py-2.5 text-sm">Buyer dashboard</Link>
          </div>
        </div>
        {order && <div className="mt-5"><Timeline stage={currentStage} /></div>}
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">{error}</div>}
      {notice && <div role="status" className="mb-5 rounded-xl border border-success/20 bg-success/10 p-3 text-sm text-success">{notice}</div>}

      {order && (
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Order</p><p className="mt-1 font-900 text-foreground">{order.id.slice(0, 8).toUpperCase()}</p></div>
          <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Current stage</p><p className="mt-1 font-800 text-foreground">{BESPOKE_STAGE_LABELS[currentStage]}</p></div>
          <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Quotation</p><p className="mt-1 font-900 text-foreground">{quote > 0 ? money(quote) : 'Pending'}</p></div>
          <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="mt-1 font-900 text-success">{money(paid)}</p></div>
          <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Balance</p><p className="mt-1 font-900 text-foreground">{money(balance)}</p></div>
        </section>
      )}

      {order?.human_action_required && (
        <section className="mb-6 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Human handoff required:</strong> {String(order.human_action_reason || 'customer service').replaceAll('_', ' ')}. All digital context remains attached to this order.
        </section>
      )}

      {!order && (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-800 uppercase tracking-widest text-primary">1 · Catalogue → Product</p>
              <h2 className="mt-1 text-xl font-900 text-foreground">Choose the base product or fabric</h2>
              <p className="mt-1 text-sm text-muted-foreground">Only active, approved FabricTrad catalogue items appear here.</p>
            </div>
            {stores.length > 0 && (
              <label className="text-xs font-700 text-muted-foreground">
                Store identity
                <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} className="input-base mt-1 block min-w-56 rounded-xl px-3 py-2 text-sm text-foreground">
                  {stores.map((store) => <option value={store.id} key={store.id}>{store.store_name} · @{store.store_handle}</option>)}
                </select>
              </label>
            )}
          </div>

          {stores.length === 0 && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              Retail buyers can claim a unique store name during onboarding. <Link className="font-800 text-primary underline" href="/buyer-registration?type=retail_store">Add a store name</Link>.
            </div>
          )}

          <form
            className="mt-5 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(() => fetchProducts(query), 'Catalogue filtered.');
            }}
          >
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base min-w-0 flex-1 rounded-xl px-4 py-3" placeholder="Search product, SKU, fabric or category" />
            <button disabled={busy} className="btn-secondary px-4 py-3">Search</button>
          </form>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const image = product.image_url || product.image_urls?.[0] || '';
              return (
                <article key={product.id} className="overflow-hidden rounded-2xl border border-border bg-background">
                  <div className="aspect-[4/3] bg-muted">
                    {image ? <img src={image} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>}
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-700 uppercase tracking-wide text-primary">{product.category} · {product.sku}</p>
                    <h3 className="mt-1 font-900 text-foreground">{product.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.fabric_name || product.description || product.quality || 'FabricTrad catalogue product'}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-900 text-foreground">{money(product.price_per_unit)}{product.unit ? `/${product.unit}` : ''}</span>
                      <button onClick={() => startWithProduct(product.id)} disabled={busy} className="btn-primary px-3 py-2 text-xs">Customize</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {order && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <p className="text-xs font-800 uppercase tracking-widest text-primary">Current action</p>
            <h2 className="mt-1 text-xl font-900 text-foreground">{BESPOKE_STAGE_LABELS[currentStage]}</h2>

            {currentStage === 'reference_image' && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-muted-foreground">Upload an inspiration/reference image. It stays in a private buyer bucket and is attached only to this order.</p>
                <input type="file" accept="image/*" disabled={busy} onChange={(event) => void uploadReferenceImage(event.target.files?.[0] || null)} className="block w-full rounded-xl border border-border p-3 text-sm" />
                <button disabled={busy} onClick={() => void uploadReferenceImage(null)} className="btn-secondary px-4 py-2.5 text-sm">Continue without image</button>
              </div>
            )}

            {currentStage === 'fabric' && (
              <div className="mt-5 space-y-3">
                <textarea value={fabric} onChange={(event) => setFabric(event.target.value)} rows={5} className="input-base w-full rounded-xl px-4 py-3 text-sm" placeholder="Fabric, colour, GSM/weight, finish, quantity or preferences" />
                <button disabled={busy || fabric.trim().length < 2} onClick={() => void run(async () => { await patchOrder({ action: 'fabric', fabricSelection: { description: fabric, source: 'website' } }); }, 'Fabric selection saved.')} className="btn-primary px-4 py-2.5 text-sm">Save fabric & continue</button>
              </div>
            )}

            {currentStage === 'customization' && (
              <div className="mt-5 space-y-3">
                <textarea value={customization} onChange={(event) => setCustomization(event.target.value)} rows={7} className="input-base w-full rounded-xl px-4 py-3 text-sm" placeholder="Style, fit, collar/neck, sleeves, pockets, lining, buttons, embroidery, initials, placement, special instructions…" />
                <button disabled={busy || customization.trim().length < 3} onClick={() => void run(async () => { await patchOrder({ action: 'customization', customization: { description: customization, source: 'website' } }); }, 'Customization brief saved.')} className="btn-primary px-4 py-2.5 text-sm">Save customization</button>
              </div>
            )}

            {currentStage === 'measurement' && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={() => setMeasurementMode('physical')} className={`rounded-2xl border p-4 text-left ${measurementMode === 'physical' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <strong className="block text-sm text-foreground">Physical measurement</strong><span className="mt-1 block text-xs text-muted-foreground">Human intervention only for taking the measurement.</span>
                  </button>
                  <button onClick={() => setMeasurementMode('saved')} className={`rounded-2xl border p-4 text-left ${measurementMode === 'saved' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <strong className="block text-sm text-foreground">Use saved measurements</strong><span className="mt-1 block text-xs text-muted-foreground">Enter existing measurements digitally.</span>
                  </button>
                </div>
                {measurementMode === 'saved' && <textarea value={measurements} onChange={(event) => setMeasurements(event.target.value)} rows={5} className="input-base w-full rounded-xl px-4 py-3 text-sm" placeholder="Chest, waist, hip, shoulder, sleeve, length, inseam, units…" />}
                <button disabled={busy || (measurementMode === 'saved' && measurements.trim().length < 3)} onClick={() => void run(async () => { await patchOrder({ action: 'measurement', measurement: measurementMode === 'physical' ? { mode: 'physical', source: 'website' } : { mode: 'saved', description: measurements, source: 'website' } }); }, 'Measurement method saved. Book the next appointment.')} className="btn-primary px-4 py-2.5 text-sm">Continue to appointment</button>
              </div>
            )}

            {currentStage === 'appointment' && (
              <div id="appointment" className="mt-5 space-y-4 scroll-mt-24">
                <p className="text-sm text-muted-foreground">Request the appointment digitally. Staff intervention starts only at the actual measurement/design approval/fitting.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-700 text-foreground">Date & time<input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label>
                  <label className="text-sm font-700 text-foreground">Location<select value={appointmentLocation} onChange={(event) => setAppointmentLocation(event.target.value as typeof appointmentLocation)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"><option value="store">FabricTrad/store</option><option value="customer_address">Customer address</option><option value="video_call">Video call</option></select></label>
                </div>
                <button disabled={busy || !appointmentAt} onClick={() => void run(async () => {
                  const date = new Date(appointmentAt);
                  await patchOrder({ action: 'appointment', appointmentType: order.human_action_reason === 'physical_measurement' ? 'physical_measurement' : 'design_approval', requestedAt: date.toISOString(), locationType: appointmentLocation, locationDetails: { source: 'website' } });
                }, 'Appointment requested. Your digital brief is attached automatically.')} className="btn-primary px-4 py-2.5 text-sm">Request appointment</button>
                {appointments.length > 0 && <div className="space-y-2">{appointments.map((item) => <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-3 text-xs"><strong>{item.appointment_type.replaceAll('_', ' ')}</strong> · {new Date(item.requested_at).toLocaleString('en-IN')} · {item.status}</div>)}</div>}
              </div>
            )}

            {currentStage === 'quotation' && (
              <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-5">
                {quote > 0 ? <><p className="text-sm text-muted-foreground">Approved quotation</p><p className="mt-1 text-3xl font-900 text-foreground">{money(quote)}</p>{Number(order.advance_amount || 0) > 0 && <p className="mt-2 text-sm text-muted-foreground">Advance option: {money(order.advance_amount)}</p>}</> : <p className="text-sm text-muted-foreground">Your digital brief is complete. Quotation will appear here after required measurement/design approval.</p>}
              </div>
            )}

            {currentStage === 'advance_or_full_payment' && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-muted-foreground">Quotation: <strong className="text-foreground">{money(quote)}</strong>. Payment is verified server-side against Razorpay before the order enters production.</p>
                <div className="flex flex-wrap gap-2">
                  {Number(order.advance_amount || 0) > 0 && <button disabled={busy} onClick={() => pay('advance')} className="btn-secondary px-4 py-2.5 text-sm">Pay advance · {money(order.advance_amount)}</button>}
                  <button disabled={busy} onClick={() => pay('full')} className="btn-primary px-4 py-2.5 text-sm">Pay in full · {money(balance || quote)}</button>
                </div>
              </div>
            )}

            {currentStage === 'stitching' && <StatusCard title="Stitching" status={order.stitching_status || 'queued'} text="Status updates are digital; the stitching work itself is operational." />}
            {currentStage === 'embroidery' && <StatusCard title="Embroidery" status={order.embroidery_status || 'not_required'} text="Embroidery requirements and progress stay attached to this order." />}
            {currentStage === 'trial' && <StatusCard title="Trial / fitting" status="physical handoff" text="A human is required only for the physical fitting. Use the appointment link below to schedule it." action={<a href="#appointment" className="btn-primary inline-flex px-4 py-2.5 text-sm">Book fitting</a>} />}
            {currentStage === 'alteration' && <StatusCard title="Alteration" status="physical handoff" text="Alteration notes remain attached digitally; human intervention is limited to the alteration work/fitting." />}

            {currentStage === 'final_approval' && (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-muted-foreground">Approve the final piece digitally after the trial/alteration outcome is satisfactory.</p>
                <button disabled={busy} onClick={() => void run(async () => { await patchOrder({ action: 'final_approval' }); }, 'Final approval recorded.')} className="btn-primary px-4 py-2.5 text-sm">Approve final result</button>
              </div>
            )}

            {currentStage === 'balance_payment' && (
              <div className="mt-5 space-y-4"><p className="text-sm text-muted-foreground">Final approved. Balance due: <strong className="text-foreground">{money(balance)}</strong></p>{balance > 0 ? <button disabled={busy} onClick={() => pay('full')} className="btn-primary px-4 py-2.5 text-sm">Pay balance securely</button> : <p className="text-success">No balance due.</p>}</div>
            )}

            {currentStage === 'delivery_or_pickup' && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={() => setDeliveryMode('delivery')} className={`rounded-2xl border p-4 text-left ${deliveryMode === 'delivery' ? 'border-primary bg-primary/5' : 'border-border'}`}><strong className="text-sm">Delivery</strong><span className="mt-1 block text-xs text-muted-foreground">Use your FabricTrad delivery profile and automated shipment updates.</span></button>
                  <button onClick={() => setDeliveryMode('pickup')} className={`rounded-2xl border p-4 text-left ${deliveryMode === 'pickup' ? 'border-primary bg-primary/5' : 'border-border'}`}><strong className="text-sm">Pickup</strong><span className="mt-1 block text-xs text-muted-foreground">Receive confirmed pickup instructions.</span></button>
                </div>
                <button disabled={busy} onClick={() => void run(async () => { await patchOrder({ action: 'delivery', deliveryMode, deliveryDetails: { source: 'website', use_profile_address: deliveryMode === 'delivery' } }); }, `${deliveryMode === 'delivery' ? 'Delivery' : 'Pickup'} preference saved.`)} className="btn-primary px-4 py-2.5 text-sm">Confirm {deliveryMode}</button>
              </div>
            )}

            {currentStage === 'review' && (
              <div className="mt-5 space-y-4">
                <label className="block text-sm font-700">Rating<select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"><option value={5}>5 — Excellent</option><option value={4}>4 — Good</option><option value={3}>3 — Okay</option><option value={2}>2 — Poor</option><option value={1}>1 — Very poor</option></select></label>
                <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} rows={4} className="input-base w-full rounded-xl px-4 py-3 text-sm" placeholder="Optional comments" />
                <button disabled={busy} onClick={() => void run(async () => { await patchOrder({ action: 'review', reviewRating, reviewText }); }, 'Review saved. Thank you.')} className="btn-primary px-4 py-2.5 text-sm">Submit review</button>
              </div>
            )}

            {currentStage === 'follow_up' && <StatusCard title="After your order" status="available" text="You can start a new order or request help here anytime." />}
            {currentStage === 'completed' && <StatusCard title="Order complete" status="completed" text="This journey is complete. Start another custom order whenever you need." />}
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-800 uppercase tracking-widest text-primary">Selected product</p>
              {selectedProduct ? <><h3 className="mt-2 font-900 text-foreground">{selectedProduct.name}</h3><p className="mt-1 text-xs text-muted-foreground">SKU {selectedProduct.sku} · {selectedProduct.category}</p><p className="mt-3 text-sm font-800 text-foreground">{money(selectedProduct.price_per_unit)}{selectedProduct.unit ? `/${selectedProduct.unit}` : ''}</p></> : <p className="mt-2 text-sm text-muted-foreground">Product will appear after selection.</p>}
            </div>
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-800 uppercase tracking-widest text-primary">Your order stays here</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Return to this page for order progress, reference images and customization details. Buyer orders are managed on the website, not WhatsApp.</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-800 uppercase tracking-widest text-primary">Need a person?</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Use this only for customer-service intervention; your order data will be handed over automatically.</p>
              <button disabled={busy} onClick={() => void run(async () => { await patchOrder({ action: 'customer_service', reason: 'Customer requested help from the custom-order website.' }); }, 'Customer-service handoff requested.')} className="btn-secondary mt-4 w-full px-4 py-2.5 text-sm">Request human support</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function StatusCard({ title, status, text, action }: { title: string; status: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-900 text-foreground">{title}</h3><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-800 text-primary">{status.replaceAll('_', ' ')}</span></div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
