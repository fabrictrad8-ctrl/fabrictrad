'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import SellerCapabilityGuard from '@/components/SellerCapabilityGuard';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { normalizeGtin, validateGtin } from '@/lib/commerceIdentifiers';

type LimitMode = 'same_as_retail_store' | 'custom' | 'disabled';
type SellerState = {
  gstin: string | null;
  gstinStatus: string;
  gstinVerified: boolean;
  verificationStatus: string;
  settlementEligible: boolean;
};
type Product = {
  id: string;
  name: string;
  sku: string;
  status: string;
  approval_status: string;
  sale_channel: string;
  unit: string;
  moq: number;
  available_quantity: number;
  gtin: string | null;
  gtin_status: string;
  hsn_code: string | null;
  brand_name: string | null;
  manufacturer_name: string | null;
  country_of_origin: string;
  gst_rate: number;
  price_includes_gst: boolean;
  retail_store_min_quantity: number | null;
  retail_store_max_quantity: number | null;
  end_user_enabled: boolean;
  end_user_limit_mode: LimitMode;
  end_user_min_quantity: number | null;
  end_user_max_quantity: number | null;
};
type Variant = {
  id: string;
  product_id: string;
  variant_code: string;
  color_name: string;
  design_name: string;
  status: string;
  unit: string;
  moq: number;
  available_quantity: number;
  gtin: string | null;
  gtin_status: string;
  gst_rate: number | null;
  price_includes_gst: boolean | null;
  retail_store_min_quantity: number | null;
  retail_store_max_quantity: number | null;
  end_user_enabled: boolean | null;
  end_user_limit_mode: LimitMode | null;
  end_user_min_quantity: number | null;
  end_user_max_quantity: number | null;
};
type FormState = {
  gtin: string;
  hsnCode: string;
  brandName: string;
  manufacturerName: string;
  countryOfOrigin: string;
  gstRate: string;
  priceIncludesGst: boolean;
  retailStoreMinQuantity: string;
  retailStoreMaxQuantity: string;
  endUserEnabled: boolean;
  endUserLimitMode: LimitMode;
  endUserMinQuantity: string;
  endUserMaxQuantity: string;
};

const emptyForm: FormState = {
  gtin: '',
  hsnCode: '',
  brandName: '',
  manufacturerName: '',
  countryOfOrigin: 'India',
  gstRate: '5',
  priceIncludesGst: false,
  retailStoreMinQuantity: '1',
  retailStoreMaxQuantity: '',
  endUserEnabled: false,
  endUserLimitMode: 'custom',
  endUserMinQuantity: '1',
  endUserMaxQuantity: '',
};

const textNumber = (value: number | null | undefined, fallback = '') =>
  value === null || value === undefined ? fallback : String(value);

export default function SellerProductRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seller, setSeller] = useState<SellerState | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  );
  const productVariants = useMemo(
    () => variants.filter((variant) => variant.product_id === selectedProductId),
    [selectedProductId, variants]
  );
  const selectedVariant = useMemo(
    () => productVariants.find((variant) => variant.id === selectedVariantId) || null,
    [productVariants, selectedVariantId]
  );

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/seller/product-rules', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        seller?: SellerState;
        products?: Product[];
        variants?: Variant[];
      };
      if (!response.ok) throw new Error(payload.error || 'Product rules could not be loaded.');
      const nextProducts = payload.products || [];
      setSeller(payload.seller || null);
      setProducts(nextProducts);
      setVariants(payload.variants || []);
      setSelectedProductId((current) =>
        current && nextProducts.some((product) => product.id === current)
          ? current
          : nextProducts[0]?.id || ''
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Product rules could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    const item = selectedVariant || selectedProduct;
    setForm({
      gtin: item.gtin || '',
      hsnCode: selectedVariant ? selectedProduct.hsn_code || '' : selectedProduct.hsn_code || '',
      brandName: selectedVariant ? selectedProduct.brand_name || '' : selectedProduct.brand_name || '',
      manufacturerName: selectedVariant
        ? selectedProduct.manufacturer_name || '' : selectedProduct.manufacturer_name ||'',
      countryOfOrigin: selectedProduct.country_of_origin || 'India',
      gstRate: textNumber(item.gst_rate, textNumber(selectedProduct.gst_rate, '5')),
      priceIncludesGst: item.price_includes_gst ?? selectedProduct.price_includes_gst,
      retailStoreMinQuantity: textNumber(
        item.retail_store_min_quantity,
        textNumber(selectedProduct.retail_store_min_quantity, textNumber(item.moq, '1'))
      ),
      retailStoreMaxQuantity: textNumber(
        item.retail_store_max_quantity,
        textNumber(selectedProduct.retail_store_max_quantity)
      ),
      endUserEnabled: item.end_user_enabled ?? selectedProduct.end_user_enabled,
      endUserLimitMode:
        item.end_user_limit_mode || selectedProduct.end_user_limit_mode || 'custom',
      endUserMinQuantity: textNumber(
        item.end_user_min_quantity,
        textNumber(selectedProduct.end_user_min_quantity, '1')
      ),
      endUserMaxQuantity: textNumber(
        item.end_user_max_quantity,
        textNumber(selectedProduct.end_user_max_quantity)
      ),
    });
  }, [selectedProduct, selectedVariant]);

  const save = async () => {
    if (!selectedProduct) return;
    const gtin = normalizeGtin(form.gtin);
    if (gtin && !validateGtin(gtin)) return toast.error('The GTIN check digit is invalid.');
    if (!form.retailStoreMinQuantity || Number(form.retailStoreMinQuantity) < 0) {
      return toast.error('Enter the Retail Store minimum quantity.');
    }
    if (
      form.endUserEnabled &&
      form.endUserLimitMode === 'custom' &&
      (!form.endUserMinQuantity || Number(form.endUserMinQuantity) < 0)
    ) {
      return toast.error('Enter the Buy for me minimum quantity.');
    }

    setSaving(true);
    try {
      const response = await fetch('/api/seller/product-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          variantId: selectedVariant?.id || null,
          gtin,
          hsnCode: form.hsnCode,
          brandName: form.brandName,
          manufacturerName: form.manufacturerName,
          countryOfOrigin: form.countryOfOrigin,
          gstRate: form.gstRate,
          priceIncludesGst: form.priceIncludesGst,
          retailStoreMinQuantity: form.retailStoreMinQuantity,
          retailStoreMaxQuantity: form.retailStoreMaxQuantity,
          endUserEnabled: form.endUserEnabled,
          endUserLimitMode: form.endUserEnabled ? form.endUserLimitMode : 'disabled',
          endUserMinQuantity: form.endUserMinQuantity,
          endUserMaxQuantity: form.endUserMaxQuantity,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        gtinNotice?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Rules could not be saved.');
      toast.success(selectedVariant ? 'Variation rules saved.' : 'Product buyer rules saved.');
      if (payload.gtinNotice) toast(payload.gtinNotice, { duration: 5000 });
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Rules could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SellerCapabilityGuard>
      <main className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <Link href="/seller-dashboard" className="flex min-h-11 items-center gap-3 rounded-xl pr-2">
              <AppLogo size={34} />
              <div>
                <p className="text-sm font-800 text-foreground">FabricTrad</p>
                <p className="text-xs text-muted-foreground">Buyer rules & identifiers</p>
              </div>
            </Link>
            <div className="ml-auto flex gap-2">
              <Link href="/seller-dashboard" className="btn-secondary inline-flex min-h-11 items-center gap-2 px-4 text-xs">
                <Icon name="ArrowLeftIcon" size={15} /> Dashboard
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Product governance</p>
              <h1 className="mt-1 text-2xl font-800 text-foreground sm:text-3xl">GTIN, tax and buyer quantity rules</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Set the quantities available to Retail Store buyers and Buy for me customers. These limits are enforced in the database at order creation, not only in the browser.
              </p>
            </div>
          </div>

          {seller && (
            <div className={`mb-6 rounded-2xl border p-4 ${seller.gstinVerified ? 'border-success/30 bg-success/10' : 'border-amber-300 bg-amber-50'}`}>
              <div className="flex items-start gap-3">
                <Icon name={seller.gstinVerified ? 'ShieldCheckIcon' : 'ClockIcon'} size={21} className={seller.gstinVerified ? 'text-success' : 'text-amber-700'} />
                <div>
                  <p className="text-sm font-800 text-foreground">GSTIN {seller.gstin || 'not provided'} · {seller.gstinStatus.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {seller.gstinVerified
                      ? 'Live product publishing is available. Settlement still follows bank and document review.'
                      : 'You may edit product drafts and buyer rules, but live publishing is locked until the GST registration is confirmed active.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-80 items-center justify-center rounded-2xl border border-border bg-card">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !products.length ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Icon name="TagIcon" size={34} className="mx-auto text-muted-foreground" />
              <h2 className="mt-4 text-lg font-800 text-foreground">No products yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Create a product draft in AI Catalog Studio, then return here to set its GTIN and buyer limits.</p>
              <Link href="/seller-dashboard?tab=catalog-assistant" className="btn-primary mt-5 inline-flex px-5 py-3 text-sm">Open Catalog Studio</Link>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="rounded-2xl border border-border bg-card p-3 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                <p className="px-3 pb-2 pt-1 text-xs font-800 uppercase tracking-wide text-muted-foreground">Products</p>
                <div className="space-y-1">
                  {products.map((product) => (
                    <button key={product.id} type="button" onClick={() => { setSelectedProductId(product.id); setSelectedVariantId(''); }} className={`w-full rounded-xl px-3 py-3 text-left ${selectedProductId === product.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                      <span className="block truncate text-sm font-800">{product.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{product.sku} · {product.status} · {product.unit}</span>
                    </button>
                  ))}
                </div>
              </aside>

              {selectedProduct && (
                <section className="space-y-5">
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><p className="text-xs font-800 uppercase tracking-wide text-primary">{selectedVariant ? 'Variation policy' : 'Product policy'}</p><h2 className="mt-1 text-xl font-800 text-foreground">{selectedProduct.name}</h2><p className="mt-1 text-xs text-muted-foreground">SKU {selectedProduct.sku} · {selectedProduct.sale_channel.replaceAll('_', ' ')}</p></div>
                      <span className={`rounded-full px-3 py-1 text-xs font-800 ${selectedProduct.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{selectedProduct.status}</span>
                    </div>
                    <div className="mt-5"><label className="text-sm font-700 text-foreground">Apply rules to<select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} className="input-base mt-1.5 w-full px-3 py-3 font-400"><option value="">Entire product / default rules</option>{productVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.color_name} · {variant.design_name} · {variant.variant_code}</option>)}</select></label></div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name="QrCodeIcon" size={20} /></div><div><h3 className="text-base font-800 text-foreground">Trade-item identity</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">GTIN identifies the packaged trade item or variation. HSN identifies its tax classification. They are different identifiers.</p></div></div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-700 text-foreground">GTIN-8 / 12 / 13 / 14<input value={form.gtin} onChange={(event) => setForm({ ...form, gtin: normalizeGtin(event.target.value) })} className="input-base mt-1.5 w-full px-4 py-3 font-mono font-400" inputMode="numeric" maxLength={14} placeholder="8901234567890" /><span className={`mt-1.5 block text-xs ${!form.gtin || validateGtin(form.gtin) ? 'text-muted-foreground' : 'text-error'}`}>{!form.gtin ? 'Optional for loose/unbarcoded fabric.' : validateGtin(form.gtin) ? `Valid GTIN-${form.gtin.length} check digit; GS1 ownership pending confirmation.` : 'Invalid check digit.'}</span></label>
                      {!selectedVariant && <label className="text-sm font-700 text-foreground">HSN code<input value={form.hsnCode} onChange={(event) => setForm({ ...form, hsnCode: event.target.value.replace(/\D/g, '').slice(0, 12) })} className="input-base mt-1.5 w-full px-4 py-3 font-mono font-400" inputMode="numeric" placeholder="Product-specific HSN" /><span className="mt-1.5 block text-xs text-muted-foreground">Use the correct classification for the actual textile/product.</span></label>}
                    </div>
                    {!selectedVariant && <div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm font-700 text-foreground">Brand<input value={form.brandName} onChange={(event) => setForm({ ...form, brandName: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Manufacturer<input value={form.manufacturerName} onChange={(event) => setForm({ ...form, manufacturerName: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Country of origin<input value={form.countryOfOrigin} onChange={(event) => setForm({ ...form, countryOfOrigin: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label></div>}
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary"><Icon name="ReceiptPercentIcon" size={20} /></div><div><h3 className="text-base font-800 text-foreground">Tax display</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">The platform recalculates GST on the server. Entering a buyer GSTIN never changes the rate to zero.</p></div></div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">GST rate (%)<input type="number" min="0" max="100" step="0.01" value={form.gstRate} onChange={(event) => setForm({ ...form, gstRate: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="flex min-h-12 items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" checked={form.priceIncludesGst} onChange={(event) => setForm({ ...form, priceIncludesGst: event.target.checked })} className="h-4 w-4" /><span><span className="block text-sm font-800 text-foreground">Displayed price includes GST</span><span className="block text-xs text-muted-foreground">Tax is extracted from the total instead of added on top.</span></span></label></div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success"><Icon name="AdjustmentsHorizontalIcon" size={20} /></div><div><h3 className="text-base font-800 text-foreground">Buyer quantity policy</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Retail Store buyers use the business range. Personal buyers can use the same range, a smaller custom range, or be disabled.</p></div></div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Retail Store minimum ({selectedVariant?.unit || selectedProduct.unit})<input type="number" min="0" step="0.01" value={form.retailStoreMinQuantity} onChange={(event) => setForm({ ...form, retailStoreMinQuantity: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Retail Store maximum<input type="number" min="0" step="0.01" value={form.retailStoreMaxQuantity} onChange={(event) => setForm({ ...form, retailStoreMaxQuantity: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" placeholder="No maximum" /></label></div>
                    <label className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" checked={form.endUserEnabled} onChange={(event) => setForm({ ...form, endUserEnabled: event.target.checked, endUserLimitMode: event.target.checked && form.endUserLimitMode === 'disabled' ? 'custom' : form.endUserLimitMode })} className="h-4 w-4" /><span><span className="block text-sm font-800 text-foreground">Allow Buy for me customers</span><span className="block text-xs text-muted-foreground">Personal buyers see this listing only when enabled.</span></span></label>
                    {form.endUserEnabled && <div className="mt-4 space-y-4"><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setForm({ ...form, endUserLimitMode: 'same_as_retail_store' })} className={`rounded-xl border p-4 text-left ${form.endUserLimitMode === 'same_as_retail_store' ? 'border-primary bg-primary/5' : 'border-border'}`}><p className="text-sm font-800 text-foreground">Same as Retail Store</p><p className="mt-1 text-xs text-muted-foreground">Use the business minimum and maximum unchanged.</p></button><button type="button" onClick={() => setForm({ ...form, endUserLimitMode: 'custom' })} className={`rounded-xl border p-4 text-left ${form.endUserLimitMode === 'custom' ? 'border-primary bg-primary/5' : 'border-border'}`}><p className="text-sm font-800 text-foreground">Smaller custom range</p><p className="mt-1 text-xs text-muted-foreground">Set personal quantities independently.</p></button></div>{form.endUserLimitMode === 'custom' && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-700 text-foreground">Buy for me minimum<input type="number" min="0" step="0.01" value={form.endUserMinQuantity} onChange={(event) => setForm({ ...form, endUserMinQuantity: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" /></label><label className="text-sm font-700 text-foreground">Buy for me maximum<input type="number" min="0" step="0.01" value={form.endUserMaxQuantity} onChange={(event) => setForm({ ...form, endUserMaxQuantity: event.target.value })} className="input-base mt-1.5 w-full px-4 py-3 font-400" placeholder="No maximum" /></label></div>}</div>}
                  </div>

                  <div className="sticky bottom-3 flex justify-end rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-xl"><button type="button" onClick={save} disabled={saving} className="btn-primary min-h-11 px-6 text-sm disabled:opacity-50">{saving ? 'Saving rules…' : 'Save product rules'}</button></div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </SellerCapabilityGuard>
  );
}
