'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { INDIAN_STATES_AND_UTS } from '@/lib/india';

type ProductStatus = 'draft' | 'active' | 'archived';
type InventoryProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  price_per_unit: number;
  unit: 'mtr' | 'kg' | 'piece' | 'roll';
  available_quantity: number;
  reserved_quantity: number;
  min_stock: number;
  moq: number;
  gsm: number | null;
  width_inches: number | null;
  work_type: string;
  image_url: string;
  dispatch_days: number;
  origin_city: string;
  origin_state: string;
  status: ProductStatus;
  updated_at?: string;
};
type ProductForm = Omit<InventoryProduct, 'id' | 'reserved_quantity' | 'updated_at'>;

const categories = ['Silk', 'Cotton', 'Net & Netting', 'Georgette', 'Polyester', 'Handloom', 'Velvet', 'Organza', 'Linen', 'Denim', 'Wool', 'Other'];
const workTypes = ['Plain', 'Embroidered', 'Zari Work', 'Block Print', 'Digital Print', 'Handloom', 'Sequence', 'Other'];
const blankProduct: ProductForm = {
  name: '', sku: '', category: 'Cotton', description: '', price_per_unit: 0, unit: 'mtr',
  available_quantity: 0, min_stock: 0, moq: 3, gsm: null, width_inches: null,
  work_type: 'Plain', image_url: '', dispatch_days: 3, origin_city: '', origin_state: '', status: 'draft',
};
const demoInventory: InventoryProduct[] = [
  { id: 'demo-1', name: 'Pure Dyeable Soft Nett Fabric', sku: 'STM-NET-001', category: 'Net & Netting', description: 'Soft dyeable nett fabric.', price_per_unit: 840, unit: 'mtr', available_quantity: 2400, reserved_quantity: 500, min_stock: 200, moq: 50, gsm: 120, width_inches: 44, work_type: 'Embroidered', image_url: 'https://images.unsplash.com/photo-1727933882951-115ddb44388d?w=400&auto=format&fit=crop', dispatch_days: 3, origin_city: 'Surat', origin_state: 'Gujarat', status: 'active' },
  { id: 'demo-2', name: 'Organza Sequence Fabric', sku: 'STM-ORG-001', category: 'Organza', description: 'Sequence organza for occasionwear.', price_per_unit: 980, unit: 'mtr', available_quantity: 45, reserved_quantity: 20, min_stock: 100, moq: 20, gsm: 60, width_inches: 44, work_type: 'Sequence', image_url: '', dispatch_days: 4, origin_city: 'Surat', origin_state: 'Gujarat', status: 'active' },
];

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += character;
  }
  values.push(value.trim());
  return values;
}

function formFromProduct(product: InventoryProduct): ProductForm {
  const { id: _id, reserved_quantity: _reserved, updated_at: _updated, ...form } = product;
  return form;
}

export default function SellerInventory() {
  const { user, profile, isDemoAccount } = useAuth();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [alerts, setAlerts] = useState({ inApp: true, sms: true, email: true });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus | 'low-stock'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isDemoAccount) {
      setProducts(demoInventory);
      setSellerId('demo-seller');
      setLoading(false);
      return;
    }
    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let { data: seller, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!seller?.id && !sellerError) {
      const repairResponse = await fetch('/api/auth/provision-account', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', body: '{}',
      });
      if (repairResponse.ok) {
        const retry = await supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();
        seller = retry.data;
        sellerError = retry.error;
      }
    }
    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'We could not finish the seller profile. Sign out and sign in again.');
      setLoading(false);
      return;
    }
    setSellerId(seller.id);
    const { data, error: productError } = await supabase
      .from('seller_products')
      .select('*')
      .eq('seller_id', seller.id)
      .order('updated_at', { ascending: false });
    if (productError) {
      setError(productError.message);
      setProducts([]);
    } else {
      setProducts((data || []) as InventoryProduct[]);
    }
    setSelectedIds([]);
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('fabrictrad:seller-stock-alerts');
      if (saved) setAlerts(JSON.parse(saved));
    } catch {}
  }, []);

  const stockCounts = useMemo(() => ({
    inStock: products.filter((product) => product.status !== 'archived' && product.available_quantity > product.min_stock).length,
    low: products.filter((product) => product.status !== 'archived' && product.available_quantity <= product.min_stock).length,
    active: products.filter((product) => product.status === 'active').length,
    drafts: products.filter((product) => product.status === 'draft').length,
  }), [products]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalized || `${product.name} ${product.sku} ${product.category} ${product.work_type}`.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'low-stock'
          ? product.status !== 'archived' && product.available_quantity <= product.min_stock
          : product.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [products, query, statusFilter]);

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...blankProduct, origin_city: profile?.city || '', origin_state: profile?.state || '', sku: `SKU-${Date.now().toString().slice(-6)}` });
    setModalOpen(true);
  };
  const openEdit = (product: InventoryProduct) => {
    setEditingId(product.id);
    setForm(formFromProduct(product));
    setModalOpen(true);
  };
  const validateForm = () => {
    if (!form.name.trim() || !form.sku.trim()) return 'Product name and SKU are required.';
    if (form.price_per_unit <= 0) return 'Price must be greater than zero.';
    if (form.available_quantity < 0 || form.min_stock < 0) return 'Stock values cannot be negative.';
    if (form.moq < 1) return 'MOQ must be at least one.';
    if (form.status === 'active' && !form.image_url.trim()) return 'Add a product image URL before publishing an active listing.';
    return null;
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateForm();
    if (validation) return toast.error(validation);
    if (!sellerId) return toast.error('Seller profile is not available.');
    setSaving(true);
    const payload = {
      ...form,
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      gsm: form.gsm || null,
      width_inches: form.width_inches || null,
      origin_city: form.origin_city.trim() || null,
      origin_state: form.origin_state || null,
    };
    try {
      if (isDemoAccount) {
        if (editingId) {
          setProducts((current) => current.map((product) => product.id === editingId
            ? { ...product, ...payload, reserved_quantity: product.reserved_quantity, updated_at: new Date().toISOString() } as InventoryProduct
            : product));
        } else {
          setProducts((current) => [{ id: `demo-${Date.now()}`, reserved_quantity: 0, ...payload } as InventoryProduct, ...current]);
        }
      } else {
        const supabase = createClient();
        const result = editingId
          ? await supabase.from('seller_products').update(payload).eq('id', editingId).eq('seller_id', sellerId)
          : await supabase.from('seller_products').insert({ seller_id: sellerId, reserved_quantity: 0, ...payload });
        if (result.error) throw result.error;
        await loadProducts();
      }
      toast.success(editingId ? 'Product updated.' : 'Product added to inventory.');
      setModalOpen(false);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const updateProductStatus = async (ids: string[], status: ProductStatus) => {
    if (!ids.length || !sellerId) return;
    if (status === 'active' && products.some((product) => ids.includes(product.id) && !product.image_url)) {
      toast.error('Every product must have an image before it can be published.');
      return;
    }
    if (status === 'archived' && !window.confirm(`Archive ${ids.length} selected product${ids.length === 1 ? '' : 's'}?`)) return;
    setBulkSaving(true);
    try {
      if (isDemoAccount) {
        setProducts((current) => current.map((product) => ids.includes(product.id) ? { ...product, status } : product));
      } else {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from('seller_products')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('seller_id', sellerId)
          .in('id', ids);
        if (updateError) throw updateError;
        await loadProducts();
      }
      setSelectedIds([]);
      toast.success(`${ids.length} product${ids.length === 1 ? '' : 's'} moved to ${status}.`);
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : 'Could not update selected products.');
    } finally {
      setBulkSaving(false);
    }
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !sellerId) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return toast.error('Choose a CSV file.');
    try {
      const lines = (await file.text()).split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) throw new Error('The CSV does not contain product rows.');
      const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/\s+/g, '_'));
      const missing = ['name', 'sku', 'price', 'available', 'moq'].filter((key) => !headers.includes(key));
      if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}.`);
      const records = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
        return {
          seller_id: sellerId, name: row.name, sku: row.sku.toUpperCase(), category: row.category || 'Other',
          description: row.description || null, price_per_unit: Number(row.price), unit: row.unit || 'mtr',
          available_quantity: Number(row.available), reserved_quantity: 0, min_stock: Number(row.min_stock || 0),
          moq: Number(row.moq), gsm: row.gsm ? Number(row.gsm) : null, width_inches: row.width ? Number(row.width) : null,
          work_type: row.work_type || 'Plain', image_url: row.image_url || null, dispatch_days: Number(row.dispatch_days || 3),
          origin_city: row.origin_city || profile?.city || null, origin_state: row.origin_state || profile?.state || null,
          status: row.status === 'active' && row.image_url ? 'active' : 'draft',
        };
      });
      if (records.some((record) => !record.name || !record.sku || record.price_per_unit <= 0 || record.available_quantity < 0 || record.moq < 1)) {
        throw new Error('One or more CSV rows contain invalid values.');
      }
      if (isDemoAccount) {
        setProducts((current) => [...records.map((record, index) => ({ id: `demo-csv-${Date.now()}-${index}`, ...record } as InventoryProduct)), ...current]);
      } else {
        const supabase = createClient();
        const { error: importError } = await supabase.from('seller_products').upsert(records, { onConflict: 'seller_id,sku' });
        if (importError) throw importError;
        await loadProducts();
      }
      toast.success(`${records.length} product${records.length === 1 ? '' : 's'} imported.`);
    } catch (importError) {
      toast.error(importError instanceof Error ? importError.message : 'CSV import failed.');
    }
  };

  const updateAlert = (key: keyof typeof alerts) => {
    const next = { ...alerts, [key]: !alerts[key] };
    setAlerts(next);
    window.localStorage.setItem('fabrictrad:seller-stock-alerts', JSON.stringify(next));
    toast.success('Stock notification preference updated.');
  };

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="ft-route-kicker">Products</p>
          <h1 className="mt-1 text-2xl font-800 tracking-tight text-foreground">Inventory & listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search, publish, archive, import and update the stock buyers see.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
          <button type="button" onClick={() => csvInputRef.current?.click()} className="ft-secondary-action flex items-center gap-2 px-3 py-2 text-xs">
            <Icon name="ArrowUpTrayIcon" size={14} /> Import CSV
          </button>
          <button type="button" onClick={openAdd} className="ft-primary-action flex items-center gap-2 px-3 py-2 text-xs">
            <Icon name="PlusIcon" size={14} /> Add product
          </button>
        </div>
      </div>

      <div className="ft-kpi-grid mb-5">
        {[
          ['Live listings', stockCounts.active, 'text-primary'],
          ['In stock', stockCounts.inStock, 'text-success'],
          ['Low stock', stockCounts.low, 'text-error'],
          ['Drafts', stockCounts.drafts, 'text-warning'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="ft-kpi">
            <p className="ft-kpi-label">{label}</p>
            <p className={`ft-kpi-value ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">
          <span>{error}</span>
          <button type="button" onClick={() => void loadProducts()} className="font-800 underline">Retry</button>
        </div>
      )}

      <div className="ft-toolbar mb-3">
        <div className="ft-search min-w-[240px] flex-[2_1_360px]">
          <Icon name="MagnifyingGlassIcon" size={17} className="ml-3 text-muted-foreground" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, SKU, category or work type" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
          {query && <button type="button" onClick={() => setQuery('')} className="mr-2 rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Clear search"><Icon name="XMarkIcon" size={15} /></button>}
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="ft-filter-control min-w-[155px] px-3 text-sm">
          <option value="all">All products</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="low-stock">Low stock</option>
          <option value="archived">Archived</option>
        </select>
        <span className="ft-orange-chip">{filteredProducts.length} shown</span>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <span className="mr-auto text-sm font-800 text-foreground">{selectedIds.length} selected</span>
          <button type="button" disabled={bulkSaving} onClick={() => void updateProductStatus(selectedIds, 'active')} className="ft-primary-action px-3 py-2 text-xs">Publish</button>
          <button type="button" disabled={bulkSaving} onClick={() => void updateProductStatus(selectedIds, 'draft')} className="ft-secondary-action px-3 py-2 text-xs">Move to draft</button>
          <button type="button" disabled={bulkSaving} onClick={() => void updateProductStatus(selectedIds, 'archived')} className="ft-secondary-action px-3 py-2 text-xs text-error">Archive</button>
          <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Clear selection"><Icon name="XMarkIcon" size={16} /></button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => setSelectedIds(event.target.checked ? filteredProducts.map((product) => product.id) : [])}
                    aria-label="Select all visible products"
                  />
                </th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Listing</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="py-14 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>}
              {!loading && filteredProducts.length === 0 && (
                <tr><td colSpan={7} className="py-14 text-center"><Icon name="ArchiveBoxIcon" size={32} className="mx-auto mb-2 text-primary" /><p className="text-sm font-800">No matching products</p><p className="mt-1 text-xs text-muted-foreground">Change the search or filter, or add a new product.</p><button type="button" onClick={openAdd} className="ft-primary-action mt-4 px-4 py-2 text-xs">Add product</button></td></tr>
              )}
              {!loading && filteredProducts.map((product) => {
                const low = product.available_quantity <= product.min_stock;
                const selected = selectedIds.includes(product.id);
                return (
                  <tr key={product.id} className={selected ? 'bg-primary/5' : ''}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} aria-label={`Select ${product.name}`} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                          {product.image_url ? <AppImage src={product.image_url} alt={product.name} fill sizes="44px" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-primary"><Icon name="PhotoIcon" size={18} /></div>}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-800 text-foreground">{product.name}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{product.sku} · {product.category}</p>
                          {low && <p className="mt-1 text-[11px] font-700 text-error">Low stock · threshold {product.min_stock}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{product.available_quantity.toLocaleString('en-IN')} {product.unit}</td>
                    <td className="px-4 py-3 text-right text-warning">{product.reserved_quantity.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-750">₹{product.price_per_unit.toLocaleString('en-IN')}/{product.unit}</td>
                    <td className="px-4 py-3 text-center"><span className={`ft-badge ${product.status === 'active' ? 'ft-badge--success' : product.status === 'draft' ? 'ft-badge--warning' : ''}`}>{product.status}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-center gap-1"><button type="button" onClick={() => openEdit(product)} className="ft-icon-button !min-h-9 !min-w-9" aria-label={`Edit ${product.name}`}><Icon name="PencilSquareIcon" size={15} /></button>{product.status !== 'archived' && <button type="button" onClick={() => void updateProductStatus([product.id], 'archived')} className="ft-icon-button !min-h-9 !min-w-9 hover:!text-error" aria-label={`Archive ${product.name}`}><Icon name="ArchiveBoxXMarkIcon" size={15} /></button>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 flex items-center gap-2 font-800"><Icon name="BellAlertIcon" size={16} className="text-primary" />Low-stock notifications</h3>
        <p className="mb-3 text-xs text-muted-foreground">Choose how FabricTrad should alert you when available stock reaches its threshold.</p>
        <div className="flex flex-wrap gap-2">
          {([['inApp', 'In-app'], ['sms', 'SMS'], ['email', 'Email']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => updateAlert(key)} className={`rounded-lg border px-3 py-2 text-xs font-700 ${alerts[key] ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-muted text-muted-foreground'}`} aria-pressed={alerts[key]}>
              {alerts[key] ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => !saving && setModalOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div><p className="ft-route-kicker">Product editor</p><h2 className="mt-1 text-xl font-800">{editingId ? 'Update product' : 'Add product'}</h2><p className="mt-1 text-xs text-muted-foreground">Draft listings remain private. Active listings require an image.</p></div>
              <button type="button" onClick={() => setModalOpen(false)} className="ft-icon-button"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <form onSubmit={saveProduct} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-700">Product name *<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">SKU *<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value.toUpperCase() })} className="input-base mt-1.5 w-full px-3 py-2.5 uppercase" /></label>
                <label className="text-sm font-700">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="text-sm font-700">Work type<select value={form.work_type} onChange={(event) => setForm({ ...form, work_type: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5">{workTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="text-sm font-700">Price *<input required type="number" min="0.01" step="0.01" value={form.price_per_unit || ''} onChange={(event) => setForm({ ...form, price_per_unit: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as ProductForm['unit'] })} className="input-base mt-1.5 w-full px-3 py-2.5"><option value="mtr">Metre</option><option value="kg">Kilogram</option><option value="piece">Piece</option><option value="roll">Roll</option></select></label>
                <label className="text-sm font-700">Available stock *<input required type="number" min="0" value={form.available_quantity} onChange={(event) => setForm({ ...form, available_quantity: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">Minimum stock alert<input type="number" min="0" value={form.min_stock} onChange={(event) => setForm({ ...form, min_stock: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">MOQ *<input required type="number" min="1" value={form.moq} onChange={(event) => setForm({ ...form, moq: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">Dispatch days<input type="number" min="1" max="30" value={form.dispatch_days} onChange={(event) => setForm({ ...form, dispatch_days: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">GSM<input type="number" value={form.gsm || ''} onChange={(event) => setForm({ ...form, gsm: event.target.value ? Number(event.target.value) : null })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">Width (inches)<input type="number" value={form.width_inches || ''} onChange={(event) => setForm({ ...form, width_inches: event.target.value ? Number(event.target.value) : null })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">Origin city<input value={form.origin_city} onChange={(event) => setForm({ ...form, origin_city: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="text-sm font-700">Origin state<select value={form.origin_state} onChange={(event) => setForm({ ...form, origin_state: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5"><option value="">Select state</option>{INDIAN_STATES_AND_UTS.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
              <label className="block text-sm font-700">Image URL<input type="url" value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
              <label className="block text-sm font-700">Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
              <label className="block text-sm font-700">Listing status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProductStatus })} className="input-base mt-1.5 w-full px-3 py-2.5"><option value="draft">Draft — private</option><option value="active">Active — visible to buyers</option><option value="archived">Archived</option></select></label>
              <div className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" onClick={() => setModalOpen(false)} className="ft-secondary-action px-5 py-2.5">Cancel</button><button type="submit" disabled={saving} className="ft-primary-action px-5 py-2.5 disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add product'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
