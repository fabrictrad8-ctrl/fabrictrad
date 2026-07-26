'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { variantKey } from '@/lib/whatsappCatalog';

type ParentProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  variant_count: number;
  available_quantity: number;
  image_url: string | null;
  source: string;
  status: string;
};

type Variant = {
  id: string;
  product_id: string;
  variant_code: string;
  color_name: string;
  color_hex: string | null;
  design_name: string;
  description: string | null;
  price_per_unit: number;
  unit: string;
  available_quantity: number;
  reserved_quantity: number;
  moq: number;
  image_url: string | null;
  status: 'draft' | 'active' | 'archived';
  approval_status: string;
};

type VariantForm = {
  colorName: string;
  colorHex: string;
  designName: string;
  description: string;
  price: number;
  stock: number;
  moq: number;
  imageUrl: string;
  status: 'draft' | 'active';
};

const blankForm: VariantForm = {
  colorName: '',
  colorHex: '',
  designName: 'Standard',
  description: '',
  price: 0,
  stock: 0,
  moq: 1,
  imageUrl: '',
  status: 'active',
};

export default function SellerVariantCatalog() {
  const { user, isDemoAccount } = useAuth();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [products, setProducts] = useState<ParentProduct[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VariantForm>(blankForm);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  );
  const selectedVariants = useMemo(
    () => variants.filter((variant) => variant.product_id === selectedProductId),
    [selectedProductId, variants]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    if (isDemoAccount || !user?.id) {
      setProducts([]);
      setVariants([]);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: seller, error: sellerError } = await supabase
        .from('seller_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (sellerError) throw sellerError;
      if (!seller?.id) throw new Error('Complete your seller profile first.');
      setSellerId(seller.id);

      const [{ data: productRows, error: productError }, { data: variantRows, error: variantError }] =
        await Promise.all([
          supabase
            .from('seller_products')
            .select('id,name,sku,category,unit,variant_count,available_quantity,image_url,source,status')
            .eq('seller_id', seller.id)
            .neq('status', 'archived')
            .order('updated_at', { ascending: false }),
          supabase
            .from('seller_product_variants')
            .select('*')
            .eq('seller_id', seller.id)
            .neq('status', 'archived')
            .order('color_name', { ascending: true }),
        ]);
      if (productError) throw productError;
      if (variantError) throw variantError;
      const nextProducts = (productRows || []) as ParentProduct[];
      setProducts(nextProducts);
      setVariants((variantRows || []) as Variant[]);
      setSelectedProductId((current) => current || nextProducts[0]?.id || '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load variant catalogue.');
    } finally {
      setLoading(false);
    }
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openAdd = () => {
    if (!selectedProduct) {
      toast.error('Add a parent fabric in Inventory first.');
      return;
    }
    setEditingId(null);
    setForm({ ...blankForm, price: 0, moq: 1 });
    setModalOpen(true);
  };

  const openEdit = (variant: Variant) => {
    setEditingId(variant.id);
    setForm({
      colorName: variant.color_name,
      colorHex: variant.color_hex || '',
      designName: variant.design_name,
      description: variant.description || '',
      price: Number(variant.price_per_unit),
      stock: Number(variant.available_quantity),
      moq: Number(variant.moq),
      imageUrl: variant.image_url || '',
      status: variant.status === 'draft' ? 'draft' : 'active',
    });
    setModalOpen(true);
  };

  const saveVariant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sellerId || !selectedProduct) return;
    if (!form.colorName.trim()) return toast.error('Colour name is required.');
    if (form.price <= 0) return toast.error('Rate must be greater than zero.');
    if (form.stock < 0) return toast.error('Stock cannot be negative.');
    if (form.moq <= 0) return toast.error('MOQ must be greater than zero.');
    if (form.colorHex && !/^#[0-9a-f]{6}$/i.test(form.colorHex)) {
      return toast.error('Colour hex must look like #2457D6.');
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const key = variantKey(form.colorName, form.designName);
      const payload = {
        product_id: selectedProduct.id,
        seller_id: sellerId,
        variant_key: key,
        variant_code: editingId
          ? selectedVariants.find((variant) => variant.id === editingId)?.variant_code
          : `${selectedProduct.sku}-${Date.now().toString().slice(-6)}`.toUpperCase(),
        color_name: form.colorName.trim(),
        color_hex: form.colorHex.trim() || null,
        design_name: form.designName.trim() || 'Standard',
        description: form.description.trim() || null,
        price_per_unit: form.price,
        unit: selectedProduct.unit,
        available_quantity: form.stock,
        moq: form.moq,
        image_url: form.imageUrl.trim() || null,
        image_urls: form.imageUrl.trim() ? [form.imageUrl.trim()] : [],
        source: 'manual',
        approval_status: 'approved',
        status: form.status,
      };

      const result = editingId
        ? await supabase
            .from('seller_product_variants')
            .update(payload)
            .eq('id', editingId)
            .eq('seller_id', sellerId)
        : await supabase.from('seller_product_variants').insert(payload);
      if (result.error) throw result.error;
      toast.success(editingId ? 'Variation updated.' : 'Variation added.');
      setModalOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save variation.');
    } finally {
      setSaving(false);
    }
  };

  const archiveVariant = async (variant: Variant) => {
    if (!sellerId || !window.confirm(`Archive ${variant.color_name} · ${variant.design_name}?`)) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('seller_product_variants')
      .update({ status: 'archived' })
      .eq('id', variant.id)
      .eq('seller_id', sellerId);
    if (error) return toast.error(error.message);
    toast.success('Variation archived.');
    await loadData();
  };

  if (loading) {
    return <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.16em] text-secondary">Parent-child inventory</p>
          <h1 className="mt-1 text-xl font-800 text-foreground">Colour & design variations</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Manage separate metres, rates, descriptions and photos under one parent fabric. Changes
            update buyer search and the product page automatically.
          </p>
        </div>
        <button type="button" onClick={openAdd} disabled={!selectedProduct || isDemoAccount} className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs disabled:opacity-50">
          <Icon name="PlusIcon" size={15} /> Add variation
        </button>
      </div>

      {isDemoAccount && (
        <div className="mb-5 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          Variant editing is disabled for the shared demo seller.
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-border bg-card p-4">
        <label className="text-xs font-800 text-muted-foreground">Parent fabric</label>
        <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="input-base mt-2 w-full rounded-xl px-4 py-3 text-sm">
          {!products.length && <option value="">No parent fabrics available</option>}
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} · {product.sku} · {product.variant_count || 0} variations
            </option>
          ))}
        </select>
      </div>

      {!selectedProduct ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Icon name="ArchiveBoxIcon" size={32} className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-800 text-foreground">Add a parent fabric first</p>
          <p className="mt-1 text-xs text-muted-foreground">Use Inventory or WhatsApp Upload to create the fabric listing.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Variations', selectedVariants.length],
              ['In stock', selectedVariants.filter((variant) => Number(variant.available_quantity) > 0).length],
              ['Total stock', selectedVariants.reduce((sum, variant) => sum + Number(variant.available_quantity), 0)],
              ['Live', selectedVariants.filter((variant) => variant.status === 'active').length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-2xl font-800 text-foreground">{Number(value).toLocaleString('en-IN')}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {selectedVariants.map((variant) => (
              <article key={variant.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative h-44 bg-muted">
                  {variant.image_url ? (
                    <AppImage src={variant.image_url} alt={`${variant.color_name} ${variant.design_name}`} fill sizes="360px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="h-20 w-20 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: variant.color_hex || '#d1d5db' }} />
                    </div>
                  )}
                  <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-800 ${variant.status === 'active' ? 'bg-success text-white' : 'bg-warning text-white'}`}>
                    {variant.status === 'active' ? 'Live' : 'Draft'}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: variant.color_hex || '#d1d5db' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-800 text-foreground">{variant.color_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{variant.design_name}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">Stock</p><p className="font-800 text-foreground">{Number(variant.available_quantity)} {variant.unit}</p></div>
                    <div className="rounded-lg bg-muted p-2"><p className="text-muted-foreground">Rate</p><p className="font-800 text-primary">₹{Number(variant.price_per_unit).toLocaleString('en-IN')}/{variant.unit}</p></div>
                  </div>
                  {variant.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{variant.description}</p>}
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => openEdit(variant)} className="btn-secondary flex-1 rounded-lg px-3 py-2 text-xs">Edit</button>
                    <button type="button" onClick={() => void archiveVariant(variant)} className="rounded-lg border border-error/20 px-3 py-2 text-xs font-800 text-error hover:bg-error/5">Archive</button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!selectedVariants.length && (
            <div className="rounded-2xl border border-dashed border-border bg-card py-14 text-center">
              <Icon name="SwatchIcon" size={30} className="mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm font-800 text-foreground">No variations for this fabric</p>
              <button type="button" onClick={openAdd} className="btn-primary mt-4 rounded-xl px-4 py-2 text-xs">Add the first colour</button>
            </div>
          )}
        </>
      )}

      {modalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={saveVariant} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div><p className="text-xs text-muted-foreground">{selectedProduct.name}</p><h2 className="text-lg font-800 text-foreground">{editingId ? 'Edit variation' : 'Add variation'}</h2></div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 hover:bg-muted"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-700 text-foreground">Colour name<input value={form.colorName} onChange={(event) => setForm((current) => ({ ...current, colorName: event.target.value }))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Royal Blue" /></label>
              <label className="text-xs font-700 text-foreground">Colour hex<input value={form.colorHex} onChange={(event) => setForm((current) => ({ ...current, colorHex: event.target.value }))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" placeholder="#2457D6" /></label>
              <label className="text-xs font-700 text-foreground">Design / pattern<input value={form.designName} onChange={(event) => setForm((current) => ({ ...current, designName: event.target.value }))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" /></label>
              <label className="text-xs font-700 text-foreground">Photo URL<input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" placeholder="https://…" /></label>
              <label className="text-xs font-700 text-foreground">Rate per {selectedProduct.unit}<input type="number" min="0.01" step="0.01" value={form.price || ''} onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) }))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" /></label>
              <label className="text-xs font-700 text-foreground">Available {selectedProduct.unit}<input type="number" min="0" step="0.01" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: Number(event.target.value) }))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" /></label>
              <label className="text-xs font-700 text-foreground">MOQ<input type="number" min="0.01" step="0.01" value={form.moq} onChange={(event) => setForm((current) => ({ ...current, moq: Number(event.target.value) }))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" /></label>
              <label className="text-xs font-700 text-foreground">Visibility<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'draft' | 'active' }))} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm"><option value="active">Live</option><option value="draft">Draft</option></select></label>
            </div>
            <label className="mt-4 block text-xs font-700 text-foreground">Variation details<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" placeholder="Shade, weave, finish, motif or other customer-facing details" /></label>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">Cancel</button><button type="submit" disabled={saving} className="btn-primary rounded-xl px-5 py-2.5 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save variation'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
