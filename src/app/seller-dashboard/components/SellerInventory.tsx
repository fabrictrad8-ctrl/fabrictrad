'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { INDIAN_STATES_AND_UTS } from '@/lib/india';

type ProductStatus = 'draft' | 'active' | 'archived';
type InventoryProduct = { id: string; name: string; sku: string; category: string; description: string; price_per_unit: number; unit: 'mtr' | 'kg' | 'piece' | 'roll'; available_quantity: number; reserved_quantity: number; min_stock: number; moq: number; gsm: number | null; width_inches: number | null; work_type: string; image_url: string; dispatch_days: number; origin_city: string; origin_state: string; status: ProductStatus; updated_at?: string; };
type ProductForm = Omit<InventoryProduct, 'id' | 'reserved_quantity' | 'updated_at'>;

const categories = ['Silk', 'Cotton', 'Net & Netting', 'Georgette', 'Polyester', 'Handloom', 'Velvet', 'Organza', 'Linen', 'Denim', 'Wool', 'Other'];
const workTypes = ['Plain', 'Embroidered', 'Zari Work', 'Block Print', 'Digital Print', 'Handloom', 'Sequence', 'Other'];
const blankProduct: ProductForm = { name: '', sku: '', category: 'Cotton', description: '', price_per_unit: 0, unit: 'mtr', available_quantity: 0, min_stock: 0, moq: 3, gsm: null, width_inches: null, work_type: 'Plain', image_url: '', dispatch_days: 3, origin_city: '', origin_state: '', status: 'draft' };
const demoInventory: InventoryProduct[] = [
  { id: 'demo-1', name: 'Pure Dyeable Soft Nett Fabric', sku: 'STM-NET-001', category: 'Net & Netting', description: 'Soft dyeable nett fabric.', price_per_unit: 840, unit: 'mtr', available_quantity: 2400, reserved_quantity: 500, min_stock: 200, moq: 50, gsm: 120, width_inches: 44, work_type: 'Embroidered', image_url: 'https://images.unsplash.com/photo-1727933882951-115ddb44388d', dispatch_days: 3, origin_city: 'Surat', origin_state: 'Gujarat', status: 'active' },
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
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [alerts, setAlerts] = useState({ inApp: true, sms: true, email: true });

  const loadProducts = useCallback(async () => {
    setLoading(true); setError(null);
    if (isDemoAccount) { setProducts(demoInventory); setSellerId('demo-seller'); setLoading(false); return; }
    if (!user?.id) { setProducts([]); setLoading(false); return; }
    const supabase = createClient();
    const { data: seller, error: sellerError } = await supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();
    if (sellerError || !seller?.id) { setError(sellerError?.message || 'Complete seller registration before adding products.'); setLoading(false); return; }
    setSellerId(seller.id);
    const { data, error: productError } = await supabase.from('seller_products').select('*').eq('seller_id', seller.id).order('updated_at', { ascending: false });
    if (productError) { setError(productError.message); setProducts([]); } else setProducts((data || []) as InventoryProduct[]);
    setLoading(false);
  }, [isDemoAccount, user?.id]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { try { const saved = window.localStorage.getItem('fabrictrad:seller-stock-alerts'); if (saved) setAlerts(JSON.parse(saved)); } catch {} }, []);

  const stockCounts = useMemo(() => ({
    inStock: products.filter((product) => product.status !== 'archived' && product.available_quantity > product.min_stock).length,
    low: products.filter((product) => product.status !== 'archived' && product.available_quantity <= product.min_stock).length,
    active: products.filter((product) => product.status === 'active').length,
  }), [products]);

  const openAdd = () => { setEditingId(null); setForm({ ...blankProduct, origin_city: profile?.city || '', origin_state: profile?.state || '', sku: `SKU-${Date.now().toString().slice(-6)}` }); setModalOpen(true); };
  const openEdit = (product: InventoryProduct) => { setEditingId(product.id); setForm(formFromProduct(product)); setModalOpen(true); };
  const validateForm = () => {
    if (!form.name.trim() || !form.sku.trim()) return 'Product name and SKU are required.';
    if (form.price_per_unit <= 0) return 'Price must be greater than zero.';
    if (form.available_quantity < 0 || form.min_stock < 0) return 'Stock values cannot be negative.';
    if (form.moq < 1) return 'MOQ must be at least one.';
    if (form.status === 'active' && !form.image_url.trim()) return 'Add a product image URL before publishing an active listing.';
    return null;
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateForm();
    if (validation) return toast.error(validation);
    if (!sellerId) return toast.error('Seller profile is not available.');
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), sku: form.sku.trim().toUpperCase(), description: form.description.trim() || null, image_url: form.image_url.trim() || null, gsm: form.gsm || null, width_inches: form.width_inches || null, origin_city: form.origin_city.trim() || null, origin_state: form.origin_state || null };
    try {
      if (isDemoAccount) {
        if (editingId) setProducts((current) => current.map((product) => product.id === editingId ? { ...product, ...payload, reserved_quantity: product.reserved_quantity, updated_at: new Date().toISOString() } as InventoryProduct : product));
        else setProducts((current) => [{ id: `demo-${Date.now()}`, reserved_quantity: 0, ...payload } as InventoryProduct, ...current]);
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
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : 'Could not save product.'); }
    finally { setSaving(false); }
  };

  const archiveProduct = async (product: InventoryProduct) => {
    if (!window.confirm(`Archive ${product.name}? It will be removed from the marketplace.`)) return;
    try {
      if (isDemoAccount) setProducts((current) => current.map((item) => item.id === product.id ? { ...item, status: 'archived' } : item));
      else {
        const supabase = createClient();
        const { error: archiveError } = await supabase.from('seller_products').update({ status: 'archived' }).eq('id', product.id).eq('seller_id', sellerId);
        if (archiveError) throw archiveError;
        await loadProducts();
      }
      toast.success('Product archived.');
    } catch (archiveError) { toast.error(archiveError instanceof Error ? archiveError.message : 'Could not archive product.'); }
  };

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
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
        return { seller_id: sellerId, name: row.name, sku: row.sku.toUpperCase(), category: row.category || 'Other', description: row.description || null, price_per_unit: Number(row.price), unit: row.unit || 'mtr', available_quantity: Number(row.available), reserved_quantity: 0, min_stock: Number(row.min_stock || 0), moq: Number(row.moq), gsm: row.gsm ? Number(row.gsm) : null, width_inches: row.width ? Number(row.width) : null, work_type: row.work_type || 'Plain', image_url: row.image_url || null, dispatch_days: Number(row.dispatch_days || 3), origin_city: row.origin_city || profile?.city || null, origin_state: row.origin_state || profile?.state || null, status: row.status === 'active' && row.image_url ? 'active' : 'draft' };
      });
      if (records.some((record) => !record.name || !record.sku || record.price_per_unit <= 0 || record.available_quantity < 0 || record.moq < 1)) throw new Error('One or more CSV rows contain invalid values.');
      if (isDemoAccount) setProducts((current) => [...records.map((record, index) => ({ id: `demo-csv-${Date.now()}-${index}`, ...record } as InventoryProduct)), ...current]);
      else {
        const supabase = createClient();
        const { error: importError } = await supabase.from('seller_products').upsert(records, { onConflict: 'seller_id,sku' });
        if (importError) throw importError;
        await loadProducts();
      }
      toast.success(`${records.length} product${records.length === 1 ? '' : 's'} imported.`);
    } catch (importError) { toast.error(importError instanceof Error ? importError.message : 'CSV import failed.'); }
  };

  const updateAlert = (key: keyof typeof alerts) => {
    const next = { ...alerts, [key]: !alerts[key] };
    setAlerts(next); window.localStorage.setItem('fabrictrad:seller-stock-alerts', JSON.stringify(next));
    toast.success('Stock notification preference updated.');
  };

  return <div>
    <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-xl font-800 text-foreground">Inventory Management</h1><p className="mt-1 text-xs text-muted-foreground">Add, publish and update the stock buyers see in the marketplace.</p></div><div className="flex flex-wrap items-center gap-2"><input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" /><button type="button" onClick={() => csvInputRef.current?.click()} className="btn-secondary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs"><Icon name="ArrowUpTrayIcon" size={14} />CSV Import</button><button type="button" onClick={openAdd} className="btn-primary flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs"><Icon name="PlusIcon" size={14} />Add Product</button></div></div>
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['In Stock', stockCounts.inStock, 'text-success'], ['Low Stock', stockCounts.low, 'text-error'], ['Live Listings', stockCounts.active, 'text-secondary'], ['Total Products', products.length, 'text-foreground']].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4 text-center"><p className={`text-2xl font-800 ${color}`}>{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
    {error && <div className="mb-4 flex items-center justify-between rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error"><span>{error}</span><button type="button" onClick={() => void loadProducts()} className="font-800 underline">Retry</button></div>}
    <div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b border-border bg-muted"><th className="px-4 py-3 text-left text-xs">Product</th><th className="px-4 py-3 text-right text-xs">Available</th><th className="px-4 py-3 text-right text-xs">Reserved</th><th className="px-4 py-3 text-right text-xs">Min Stock</th><th className="px-4 py-3 text-right text-xs">Price</th><th className="px-4 py-3 text-center text-xs">Listing</th><th className="px-4 py-3 text-center text-xs">Actions</th></tr></thead><tbody className="divide-y divide-border">
      {loading && <tr><td colSpan={7} className="py-14 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-secondary border-t-transparent" /></td></tr>}
      {!loading && products.length === 0 && <tr><td colSpan={7} className="py-14 text-center"><Icon name="ArchiveBoxIcon" size={32} className="mx-auto mb-2 text-muted-foreground" /><p className="text-sm font-800">No products yet</p><button type="button" onClick={openAdd} className="btn-primary mt-4 rounded-xl px-4 py-2 text-xs">Add First Product</button></td></tr>}
      {!loading && products.map((product) => { const low = product.available_quantity <= product.min_stock; return <tr key={product.id} className="hover:bg-muted/30"><td className="px-4 py-3"><p className="text-xs font-700">{product.name}</p><p className="font-mono text-xs text-muted-foreground">{product.sku} · {product.category}</p>{low && <p className="mt-1 text-[11px] font-700 text-error">Low stock — threshold {product.min_stock}</p>}</td><td className="px-4 py-3 text-right">{product.available_quantity.toLocaleString('en-IN')} {product.unit}</td><td className="px-4 py-3 text-right text-warning">{product.reserved_quantity.toLocaleString('en-IN')}</td><td className="px-4 py-3 text-right">{product.min_stock.toLocaleString('en-IN')}</td><td className="px-4 py-3 text-right font-700">₹{product.price_per_unit.toLocaleString('en-IN')}/{product.unit}</td><td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-700 ${product.status === 'active' ? 'bg-success/10 text-success' : product.status === 'draft' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'}`}>{product.status}</span></td><td className="px-4 py-3"><div className="flex justify-center gap-1"><button type="button" onClick={() => openEdit(product)} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label={`Edit ${product.name}`}><Icon name="PencilSquareIcon" size={15} /></button>{product.status !== 'archived' && <button type="button" onClick={() => void archiveProduct(product)} className="rounded-lg p-2 text-muted-foreground hover:text-error" aria-label={`Archive ${product.name}`}><Icon name="ArchiveBoxXMarkIcon" size={15} /></button>}</div></td></tr>; })}
    </tbody></table></div></div>
    <div className="mt-5 rounded-2xl border border-border bg-card p-5"><h3 className="mb-2 flex items-center gap-2 font-800"><Icon name="BellAlertIcon" size={16} className="text-primary" />Low Stock Notifications</h3><div className="flex flex-wrap gap-3">{([['inApp','In-App Notification'],['sms','SMS Alert'],['email','Email Alert']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => updateAlert(key)} className={`rounded-xl border px-3 py-2 text-xs font-600 ${alerts[key] ? 'border-success/30 bg-success/5 text-success' : 'border-border bg-muted text-muted-foreground'}`} aria-pressed={alerts[key]}>{alerts[key] ? '✓ ' : ''}{label}</button>)}</div></div>
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => !saving && setModalOpen(false)}><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-5 sm:p-6" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-800">{editingId ? 'Update Product' : 'Add Product'}</h2><p className="text-xs text-muted-foreground">Draft listings remain private. Active listings need an image URL.</p></div><button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-2 hover:bg-muted"><Icon name="XMarkIcon" size={18} /></button></div><form onSubmit={saveProduct} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-700">Product Name *<input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700">SKU *<input required value={form.sku} onChange={(e)=>setForm({...form,sku:e.target.value.toUpperCase()})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 uppercase" /></label>
      <label className="text-sm font-700">Category<select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5">{categories.map((x)=><option key={x}>{x}</option>)}</select></label><label className="text-sm font-700">Work Type<select value={form.work_type} onChange={(e)=>setForm({...form,work_type:e.target.value})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5">{workTypes.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label className="text-sm font-700">Price *<input required type="number" min="0.01" step="0.01" value={form.price_per_unit || ''} onChange={(e)=>setForm({...form,price_per_unit:Number(e.target.value)})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700">Unit<select value={form.unit} onChange={(e)=>setForm({...form,unit:e.target.value as ProductForm['unit']})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"><option value="mtr">Metre</option><option value="kg">Kilogram</option><option value="piece">Piece</option><option value="roll">Roll</option></select></label>
      <label className="text-sm font-700">Available Stock *<input required type="number" min="0" value={form.available_quantity} onChange={(e)=>setForm({...form,available_quantity:Number(e.target.value)})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700">Minimum Stock Alert<input type="number" min="0" value={form.min_stock} onChange={(e)=>setForm({...form,min_stock:Number(e.target.value)})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label>
      <label className="text-sm font-700">MOQ *<input required type="number" min="1" value={form.moq} onChange={(e)=>setForm({...form,moq:Number(e.target.value)})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700">Dispatch Days<input type="number" min="1" max="30" value={form.dispatch_days} onChange={(e)=>setForm({...form,dispatch_days:Number(e.target.value)})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label>
      <label className="text-sm font-700">GSM<input type="number" value={form.gsm || ''} onChange={(e)=>setForm({...form,gsm:e.target.value?Number(e.target.value):null})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700">Width (inches)<input type="number" value={form.width_inches || ''} onChange={(e)=>setForm({...form,width_inches:e.target.value?Number(e.target.value):null})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label>
      <label className="text-sm font-700">Origin City<input value={form.origin_city} onChange={(e)=>setForm({...form,origin_city:e.target.value})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700">Origin State<select value={form.origin_state} onChange={(e)=>setForm({...form,origin_state:e.target.value})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"><option value="">Select state</option>{INDIAN_STATES_AND_UTS.map((x)=><option key={x}>{x}</option>)}</select></label>
    </div><label className="block text-sm font-700">Image URL<input type="url" value={form.image_url} onChange={(e)=>setForm({...form,image_url:e.target.value})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="block text-sm font-700">Description<textarea rows={3} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="block text-sm font-700">Listing Status<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as ProductStatus})} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"><option value="draft">Draft — private</option><option value="active">Active — visible to buyers</option><option value="archived">Archived</option></select></label><div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={()=>setModalOpen(false)} className="btn-secondary rounded-xl px-5 py-2.5">Cancel</button><button type="submit" disabled={saving} className="btn-primary rounded-xl px-5 py-2.5 disabled:opacity-50">{saving?'Saving…':editingId?'Save Changes':'Add Product'}</button></div></form></div></div>}
  </div>;
}
