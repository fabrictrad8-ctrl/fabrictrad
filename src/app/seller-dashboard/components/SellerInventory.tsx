'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import ProductShareButton from '@/components/ProductShareButton';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { INDIAN_STATES_AND_UTS } from '@/lib/india';

type ProductStatus = 'draft' | 'active' | 'archived';
type SaleChannel = 'b2b' | 'retail' | 'both';

type InventoryProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string | null;
  price_per_unit: number;
  unit: string;
  unit_label?: string | null;
  available_quantity: number;
  reserved_quantity: number;
  min_stock: number;
  moq: number;
  gsm: number | null;
  width_inches: number | null;
  work_type: string;
  image_url: string | null;
  dispatch_days: number;
  origin_city: string | null;
  origin_state: string | null;
  status: ProductStatus;
  approval_status?: string | null;
  sale_channel: SaleChannel;
  end_user_enabled: boolean;
  end_user_limit_mode: 'same_as_retail_store' | 'custom' | 'disabled';
  end_user_min_quantity: number | null;
  end_user_max_quantity: number | null;
  retail_store_min_quantity: number | null;
  retail_store_max_quantity: number | null;
  updated_at?: string;
};

type ProductForm = {
  name: string;
  sku: string;
  category: string;
  description: string;
  pricePerUnit: number;
  unitLabel: string;
  availableQuantity: number;
  minStock: number;
  moq: number;
  gsm: number | null;
  widthInches: number | null;
  workType: string;
  imageUrl: string;
  dispatchDays: number;
  originCity: string;
  originState: string;
  status: ProductStatus;
  saleChannel: SaleChannel;
  retailStoreMinQuantity: number;
  retailStoreMaxQuantity: number | null;
  endUserMinQuantity: number;
  endUserMaxQuantity: number | null;
};

const CATEGORY_OPTIONS = [
  'Cotton', 'Silk', 'Banarasi Silk', 'Raw Silk', 'Chanderi', 'Georgette', 'Chiffon',
  'Organza', 'Velvet', 'Linen', 'Denim', 'Wool', 'Satin', 'Crepe', 'Rayon', 'Viscose',
  'Polyester', 'Nylon', 'Net & Netting', 'Lace', 'Khadi', 'Handloom', 'Muslin', 'Twill',
  'Jacquard', 'Brocade', 'Modal', 'Lyocell', 'Jersey', 'Fleece', 'Canvas', 'Corduroy',
  'Poplin', 'Saree', 'Sherwani', 'Jodhpuri', 'Indo-Western', 'Lehenga', 'Kurta',
  'Shirting', 'Suiting', 'Menswear', 'Womenswear', 'Kidswear', 'Accessory', 'Other',
];

const WORK_OPTIONS = [
  'Plain', 'Embroidered', 'Zari Work', 'Block Print', 'Digital Print', 'Handloom',
  'Sequence', 'Printed', 'Woven', 'Dyed', 'Other',
];

const UNIT_OPTIONS = ['metre', 'meter', 'mtr', 'yard', 'kg', 'kilogram', 'farma', 'piece', 'pieces', 'roll'];

const blankProduct: ProductForm = {
  name: '',
  sku: '',
  category: 'Cotton',
  description: '',
  pricePerUnit: 0,
  unitLabel: 'metre',
  availableQuantity: 0,
  minStock: 0,
  moq: 1,
  gsm: null,
  widthInches: null,
  workType: 'Plain',
  imageUrl: '',
  dispatchDays: 3,
  originCity: '',
  originState: '',
  status: 'draft',
  saleChannel: 'both',
  retailStoreMinQuantity: 1,
  retailStoreMaxQuantity: null,
  endUserMinQuantity: 1,
  endUserMaxQuantity: null,
};

function unitCode(value: string) {
  const normalized = value.trim().toLowerCase();
  if (/^(m|mtr|metre|meter|metres|meters)$/.test(normalized)) return 'mtr';
  if (/^(kg|kgs|kilogram|kilograms|kilo|kilos)$/.test(normalized)) return 'kg';
  if (/^(yd|yard|yards)$/.test(normalized)) return 'yard';
  if (/^farma$/.test(normalized)) return 'farma';
  if (/^(piece|pieces|pc|pcs)$/.test(normalized)) return 'piece';
  if (/^(roll|rolls)$/.test(normalized)) return 'roll';
  return 'custom';
}

function unitDisplay(product: Pick<InventoryProduct, 'unit' | 'unit_label'>) {
  const exact = String(product.unit_label || '').trim();
  if (exact) return exact;
  if (product.unit === 'mtr') return 'metre';
  if (product.unit === 'piece') return 'piece';
  return product.unit || 'unit';
}

function optionalUrlValid(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function formFromProduct(product: InventoryProduct): ProductForm {
  const moq = Math.max(1, Number(product.moq || 1));
  return {
    name: product.name || '',
    sku: product.sku || '',
    category: product.category || 'Other',
    description: product.description || '',
    pricePerUnit: Number(product.price_per_unit || 0),
    unitLabel: unitDisplay(product),
    availableQuantity: Number(product.available_quantity || 0),
    minStock: Number(product.min_stock || 0),
    moq,
    gsm: product.gsm ?? null,
    widthInches: product.width_inches ?? null,
    workType: product.work_type || '',
    imageUrl: product.image_url || '',
    dispatchDays: Number(product.dispatch_days || 3),
    originCity: product.origin_city || '',
    originState: product.origin_state || '',
    status: product.status || 'draft',
    saleChannel: product.sale_channel || 'b2b',
    retailStoreMinQuantity: Number(product.retail_store_min_quantity ?? moq),
    retailStoreMaxQuantity: product.retail_store_max_quantity == null ? null : Number(product.retail_store_max_quantity),
    endUserMinQuantity: Number(product.end_user_min_quantity ?? 1),
    endUserMaxQuantity: product.end_user_max_quantity == null ? null : Number(product.end_user_max_quantity),
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

export default function SellerInventory() {
  const { user, profile } = useAuth();
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
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus | 'low-stock'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: '{}',
      });
      if (repairResponse.ok) {
        const retry = await supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();
        seller = retry.data;
        sellerError = retry.error;
      }
    }

    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'We could not finish the seller profile. Sign out and sign in again.');
      setProducts([]);
      setLoading(false);
      return;
    }

    setSellerId(String(seller.id));
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
  }, [user?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const stockCounts = useMemo(() => ({
    inStock: products.filter((product) => product.status !== 'archived' && Number(product.available_quantity) - Number(product.reserved_quantity || 0) > Number(product.min_stock || 0)).length,
    low: products.filter((product) => product.status !== 'archived' && Number(product.available_quantity) - Number(product.reserved_quantity || 0) <= Number(product.min_stock || 0)).length,
    active: products.filter((product) => product.status === 'active').length,
    drafts: products.filter((product) => product.status === 'draft').length,
  }), [products]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalized || `${product.name} ${product.sku} ${product.category} ${product.work_type}`.toLowerCase().includes(normalized);
      const available = Number(product.available_quantity || 0) - Number(product.reserved_quantity || 0);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'low-stock'
        ? product.status !== 'archived' && available <= Number(product.min_stock || 0)
        : product.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [products, query, statusFilter]);

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id));

  const openEdit = (product: InventoryProduct) => {
    setEditingId(product.id);
    setForm(formFromProduct(product));
    setModalOpen(true);
  };

  const validateForm = () => {
    if (!form.name.trim() || !form.sku.trim()) return 'Product name and SKU are required.';
    if (!form.category.trim()) return 'Choose or enter a category.';
    if (form.pricePerUnit <= 0) return 'Price must be greater than zero.';
    if (form.availableQuantity < 0 || form.minStock < 0) return 'Stock values cannot be negative.';
    if (form.moq < 1) return 'MOQ must be at least one.';
    if (!form.unitLabel.trim()) return 'Enter the stock measurement unit.';
    if (form.retailStoreMinQuantity < 0) return 'Business buyer minimum cannot be negative.';
    if (form.retailStoreMaxQuantity !== null && form.retailStoreMaxQuantity < form.retailStoreMinQuantity) return 'Business buyer maximum cannot be below the minimum.';
    if (form.saleChannel !== 'b2b' && form.endUserMinQuantity < 0) return 'Personal buyer minimum cannot be negative.';
    if (form.saleChannel !== 'b2b' && form.endUserMaxQuantity !== null && form.endUserMaxQuantity < form.endUserMinQuantity) return 'Personal buyer maximum cannot be below the minimum.';
    if (!optionalUrlValid(form.imageUrl)) return 'Image URL must begin with http:// or https://, or be left blank.';
    return null;
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateForm();
    if (validation) return toast.error(validation);
    if (!sellerId || !editingId) return toast.error('Seller product is not available.');

    const personalEnabled = form.saleChannel === 'retail' || form.saleChannel === 'both';
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('seller_products')
        .update({
          name: form.name.trim(),
          sku: form.sku.trim().toUpperCase(),
          category: form.category.trim(),
          description: form.description.trim() || null,
          price_per_unit: form.pricePerUnit,
          unit: unitCode(form.unitLabel),
          unit_label: form.unitLabel.trim(),
          available_quantity: form.availableQuantity,
          min_stock: form.minStock,
          moq: form.moq,
          gsm: form.gsm ?? null,
          width_inches: form.widthInches ?? null,
          work_type: form.workType.trim() || 'Plain',
          image_url: form.imageUrl.trim() || null,
          dispatch_days: form.dispatchDays,
          origin_city: form.originCity.trim() || null,
          origin_state: form.originState || null,
          status: form.status,
          sale_channel: form.saleChannel,
          retail_store_min_quantity: form.retailStoreMinQuantity || form.moq,
          retail_store_max_quantity: form.retailStoreMaxQuantity,
          end_user_enabled: personalEnabled,
          end_user_limit_mode: personalEnabled ? 'custom' : 'disabled',
          end_user_min_quantity: personalEnabled ? form.endUserMinQuantity : null,
          end_user_max_quantity: personalEnabled ? form.endUserMaxQuantity : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
        .eq('seller_id', sellerId);
      if (updateError) throw updateError;
      toast.success('Product and buyer-access settings updated.');
      setModalOpen(false);
      await loadProducts();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const updateProductStatus = async (ids: string[], status: ProductStatus) => {
    if (!ids.length || !sellerId) return;
    if (status === 'archived' && !window.confirm(`Archive ${ids.length} selected product${ids.length === 1 ? '' : 's'}?`)) return;
    setBulkSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('seller_products')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('seller_id', sellerId)
        .in('id', ids);
      if (updateError) throw updateError;
      toast.success(`${ids.length} product${ids.length === 1 ? '' : 's'} moved to ${status}.`);
      await loadProducts();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not update selected products.');
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
      if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}. Required: name, sku, price, available, moq`);

      const errors: string[] = [];
      const records = lines.slice(1).map((line, lineIndex) => {
        const values = parseCsvLine(line);
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
        const unitLabel = row.unit || 'metre';
        const saleChannel: SaleChannel = row.sale_channel === 'retail' || row.sale_channel === 'both' ? row.sale_channel : 'b2b';
        const moq = Math.max(1, Number(row.moq));
        const price = Number(row.price);
        const available = Number(row.available);
        const gsm = row.gsm ? Number(row.gsm) : null;

        if (!row.name?.trim()) errors.push(`Row ${lineIndex + 2}: name is required`);
        if (!row.sku?.trim()) errors.push(`Row ${lineIndex + 2}: sku is required`);
        if (isNaN(price) || price <= 0) errors.push(`Row ${lineIndex + 2}: price must be a positive number (got "${row.price}")`);
        if (isNaN(available) || available < 0) errors.push(`Row ${lineIndex + 2}: available must be 0 or more (got "${row.available}")`);
        if (isNaN(moq) || moq < 1) errors.push(`Row ${lineIndex + 2}: moq must be at least 1 (got "${row.moq}")`);
        if (gsm !== null && (isNaN(gsm) || gsm <= 0)) errors.push(`Row ${lineIndex + 2}: gsm must be a positive number if provided (got "${row.gsm}")`);

        const personalEnabled = saleChannel !== 'b2b';
        return {
          seller_id: sellerId,
          name: row.name?.trim(),
          sku: row.sku?.trim().toUpperCase(),
          category: row.category || 'Other',
          description: row.description || null,
          price_per_unit: price,
          unit: unitCode(unitLabel),
          unit_label: unitLabel,
          available_quantity: available,
          reserved_quantity: 0,
          min_stock: Number(row.min_stock || 0),
          moq,
          gsm,
          width_inches: row.width ? Number(row.width) : null,
          work_type: row.work_type || 'Plain',
          image_url: row.image_url || null,
          dispatch_days: Number(row.dispatch_days || 3),
          origin_city: row.origin_city || profile?.city || null,
          origin_state: row.origin_state || profile?.state || null,
          status: row.status === 'active' ? 'active' : row.status === 'archived' ? 'archived' : 'draft',
          sale_channel: saleChannel,
          retail_store_min_quantity: Number(row.retail_store_min_quantity || moq),
          retail_store_max_quantity: row.retail_store_max_quantity ? Number(row.retail_store_max_quantity) : null,
          end_user_enabled: personalEnabled,
          end_user_limit_mode: personalEnabled ? 'custom' : 'disabled',
          end_user_min_quantity: personalEnabled ? Number(row.end_user_min_quantity || 1) : null,
          end_user_max_quantity: personalEnabled && row.end_user_max_quantity ? Number(row.end_user_max_quantity) : null,
        };
      });

      if (errors.length > 0) {
        const summary = errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n…and ${errors.length - 5} more errors` : '');
        throw new Error(`CSV validation failed:\n${summary}`);
      }

      const supabase = createClient();
      const { error: importError } = await supabase.from('seller_products').upsert(records, { onConflict: 'seller_id,sku' });
      if (importError) throw importError;
      toast.success(`${records.length} product${records.length === 1 ? '' : 's'} imported successfully.`);
      await loadProducts();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'CSV import failed.');
    }
  };

  const downloadCsvTemplate = () => {
    const headers = 'name,sku,price,available,moq,gsm,category,description,unit,work_type,dispatch_days,origin_city,origin_state,sale_channel,image_url';
    const example = 'Premium Cotton Shirting,COTTON-001,450,500,50,120,Cotton,Fine combed cotton shirting fabric,metre,Plain,3,Surat,Gujarat,both,';
    const blob = new Blob([`${headers}\n${example}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fabrictrad-bulk-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <datalist id="inventory-work-suggestions">{WORK_OPTIONS.map((item) => <option key={item} value={item} />)}</datalist>
      <datalist id="inventory-unit-suggestions">{UNIT_OPTIONS.map((item) => <option key={item} value={item} />)}</datalist>

      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="ft-route-kicker">Products</p>
          <h1 className="mt-1 text-2xl font-800 tracking-tight text-foreground">Inventory & listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real seller products, stock and who is allowed to buy each listing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
          <button type="button" onClick={downloadCsvTemplate} className="ft-secondary-action flex items-center gap-2 px-3 py-2 text-xs">
            <Icon name="ArrowDownTrayIcon" size={14} /> CSV Template
          </button>
          <button type="button" onClick={() => csvInputRef.current?.click()} className="ft-secondary-action flex items-center gap-2 px-3 py-2 text-xs">
            <Icon name="ArrowUpTrayIcon" size={14} /> Import CSV
          </button>
          <Link href="/seller-product-rules" className="ft-secondary-action flex items-center gap-2 px-3 py-2 text-xs">
            <Icon name="AdjustmentsHorizontalIcon" size={14} /> Buyer rules & tax
          </Link>
          <Link href="/seller-dashboard?tab=upload" className="ft-primary-action flex items-center gap-2 px-3 py-2 text-xs">
            <Icon name="PlusIcon" size={14} /> Add product
          </Link>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
        <strong className="text-foreground">Personal purchases are controlled per product.</strong> Edit a product below and choose Business + personal, Business only, or Personal only. Detailed GTIN, HSN, GST and variation limits are under Buyer rules & tax.
      </div>

      <div className="ft-kpi-grid mb-5">
        {[
          ['Live listings', stockCounts.active, 'text-primary'],
          ['In stock', stockCounts.inStock, 'text-success'],
          ['Low stock', stockCounts.low, 'text-error'],
          ['Drafts', stockCounts.drafts, 'text-warning'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="ft-kpi"><p className="ft-kpi-label">{label}</p><p className={`ft-kpi-value ${color}`}>{value}</p></div>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">
          <span>{error}</span><button type="button" onClick={() => void loadProducts()} className="font-800 underline">Retry</button>
        </div>
      )}

      <div className="ft-toolbar mb-3">
        <div className="ft-search min-w-[240px] flex-[2_1_360px]">
          <Icon name="MagnifyingGlassIcon" size={17} className="ml-3 text-muted-foreground" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, SKU, category or work type" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="ft-filter-control min-w-[155px] px-3 text-sm">
          <option value="all">All products</option><option value="active">Active</option><option value="draft">Draft</option><option value="low-stock">Low stock</option><option value="archived">Archived</option>
        </select>
        <span className="ft-orange-chip">{filteredProducts.length} shown</span>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <span className="mr-auto text-sm font-800">{selectedIds.length} selected</span>
          <button disabled={bulkSaving} onClick={() => void updateProductStatus(selectedIds, 'active')} className="ft-primary-action px-3 py-2 text-xs">Publish</button>
          <button disabled={bulkSaving} onClick={() => void updateProductStatus(selectedIds, 'draft')} className="ft-secondary-action px-3 py-2 text-xs">Move to draft</button>
          <button disabled={bulkSaving} onClick={() => void updateProductStatus(selectedIds, 'archived')} className="ft-secondary-action px-3 py-2 text-xs text-error">Archive</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead><tr><th className="w-12 px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={(event) => setSelectedIds(event.target.checked ? filteredProducts.map((product) => product.id) : [])} aria-label="Select all visible products" /></th><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-left">Who can buy</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Reserved</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-center">Listing</th><th className="px-4 py-3 text-center">Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="py-14 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></td></tr>}
              {!loading && filteredProducts.length === 0 && <tr><td colSpan={8} className="py-14 text-center"><Icon name="ArchiveBoxIcon" size={32} className="mx-auto mb-2 text-primary" /><p className="text-sm font-800">No matching products</p><Link href="/seller-dashboard?tab=upload" className="ft-primary-action mt-4 inline-flex px-4 py-2 text-xs">Add product</Link></td></tr>}
              {!loading && filteredProducts.map((product) => {
                const displayUnit = unitDisplay(product);
                const available = Math.max(0, Number(product.available_quantity || 0) - Number(product.reserved_quantity || 0));
                const low = available <= Number(product.min_stock || 0);
                const selected = selectedIds.includes(product.id);
                const shareable = product.status === 'active' && product.approval_status === 'approved';
                const buyerLabel = product.sale_channel === 'both' ? 'Business + personal' : product.sale_channel === 'retail' ? 'Personal only' : 'Business only';
                return (
                  <tr key={product.id} className={selected ? 'bg-primary/5' : ''}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id))} aria-label={`Select ${product.name}`} /></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">{product.image_url ? <AppImage src={product.image_url} alt={product.name} fill sizes="44px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Icon name="PhotoIcon" size={18} /></div>}</div><div className="min-w-0"><p className="truncate text-xs font-800">{product.name}</p><p className="truncate font-mono text-[11px] text-muted-foreground">{product.sku} · {product.category}</p>{low && <p className="mt-1 text-[11px] font-700 text-error">Low stock · threshold {product.min_stock}</p>}</div></div></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-750 ${product.sale_channel === 'both' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{buyerLabel}</span></td>
                    <td className="px-4 py-3 text-right">{available.toLocaleString('en-IN')} {displayUnit}</td>
                    <td className="px-4 py-3 text-right text-warning">{Number(product.reserved_quantity || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-750">₹{Number(product.price_per_unit || 0).toLocaleString('en-IN')}/{displayUnit}</td>
                    <td className="px-4 py-3 text-center"><span className={`ft-badge ${product.status === 'active' ? 'ft-badge--success' : product.status === 'draft' ? 'ft-badge--warning' : ''}`}>{product.status}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-center gap-1">{shareable && <><ProductShareButton productId={product.id} productName={product.name} compact /><a href={`/product-detail?id=seller-${encodeURIComponent(product.id)}`} target="_blank" rel="noreferrer" className="ft-icon-button !min-h-9 !min-w-9" aria-label={`Open ${product.name}`}><Icon name="ArrowTopRightOnSquareIcon" size={15} /></a></>}<button type="button" onClick={() => openEdit(product)} className="ft-icon-button !min-h-9 !min-w-9" aria-label={`Edit ${product.name}`}><Icon name="PencilSquareIcon" size={15} /></button>{product.status !== 'archived' && <button type="button" onClick={() => void updateProductStatus([product.id], 'archived')} className="ft-icon-button !min-h-9 !min-w-9 hover:!text-error" aria-label={`Archive ${product.name}`}><Icon name="ArchiveBoxXMarkIcon" size={15} /></button>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => !saving && setModalOpen(false)}>
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3"><div><p className="ft-route-kicker">Product editor</p><h2 className="mt-1 text-xl font-800">Update product</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Category choices are visible here, and buyer access is editable on the same screen.</p></div><button type="button" onClick={() => setModalOpen(false)} className="ft-icon-button"><Icon name="XMarkIcon" size={18} /></button></div>

            <form onSubmit={saveProduct} className="space-y-5">
              <section className="rounded-2xl border border-border p-4">
                <h3 className="text-sm font-800">Product details</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-700">Product name *<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">SKU *<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value.toUpperCase() })} className="input-base mt-1.5 w-full px-3 py-2.5 uppercase" /></label>
                  <label className="text-sm font-700">Category *<select value={CATEGORY_OPTIONS.includes(form.category) ? form.category : '__custom'} onChange={(event) => setForm({ ...form, category: event.target.value === '__custom' ? '' : event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5">{CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}<option value="__custom">Custom category…</option></select>{!CATEGORY_OPTIONS.includes(form.category) && <input autoFocus value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="input-base mt-2 w-full px-3 py-2.5" placeholder="Type your category" />}</label>
                  <label className="text-sm font-700">Work type / finish<input list="inventory-work-suggestions" value={form.workType} onChange={(event) => setForm({ ...form, workType: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" placeholder="Plain, print, zari, embroidery…" /></label>
                  <label className="text-sm font-700">Price *<input required type="number" min="0.01" step="0.01" value={form.pricePerUnit || ''} onChange={(event) => setForm({ ...form, pricePerUnit: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">Measurement unit *<input required list="inventory-unit-suggestions" value={form.unitLabel} onChange={(event) => setForm({ ...form, unitLabel: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">Available stock *<input required type="number" min="0" step="0.01" value={form.availableQuantity} onChange={(event) => setForm({ ...form, availableQuantity: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">Minimum stock alert<input type="number" min="0" step="0.01" value={form.minStock} onChange={(event) => setForm({ ...form, minStock: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">MOQ *<input required type="number" min="1" step="1" value={form.moq} onChange={(event) => setForm({ ...form, moq: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">Dispatch days<input type="number" min="1" max="30" value={form.dispatchDays} onChange={(event) => setForm({ ...form, dispatchDays: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">GSM <span className="font-500 text-muted-foreground">(optional)</span><input type="number" min="0" step="1" value={form.gsm ?? ''} onChange={(event) => setForm({ ...form, gsm: event.target.value ? Number(event.target.value) : null })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">Width (inches) <span className="font-500 text-muted-foreground">(optional)</span><input type="number" min="0" step="0.1" value={form.widthInches ?? ''} onChange={(event) => setForm({ ...form, widthInches: event.target.value ? Number(event.target.value) : null })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">Origin city<input value={form.originCity} onChange={(event) => setForm({ ...form, originCity: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                  <label className="text-sm font-700">Origin state<select value={form.originState} onChange={(event) => setForm({ ...form, originState: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5"><option value="">Select state</option>{INDIAN_STATES_AND_UTS.map((item) => <option key={item}>{item}</option>)}</select></label>
                </div>
                <label className="mt-4 block text-sm font-700">Image URL <span className="font-500 text-muted-foreground">(optional legacy field)</span><input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
                <label className="mt-4 block text-sm font-700">Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label>
              </section>

              <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-800">Who can buy this product?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">This setting directly controls the message buyers see on the product page.</p></div><Link href="/seller-product-rules" className="text-xs font-800 text-primary hover:underline">Advanced rules, GTIN & tax →</Link></div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-700 sm:col-span-2">Sell to<select value={form.saleChannel} onChange={(event) => setForm({ ...form, saleChannel: event.target.value as SaleChannel })} className="input-base mt-1.5 w-full px-3 py-2.5"><option value="both">Business + personal buyers</option><option value="b2b">Business buyers only</option><option value="retail">Personal buyers only</option></select></label>
                  {form.saleChannel !== 'retail' && <><label className="text-sm font-700">Business minimum<input type="number" min="0" step="0.01" value={form.retailStoreMinQuantity} onChange={(event) => setForm({ ...form, retailStoreMinQuantity: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label><label className="text-sm font-700">Business maximum <span className="font-500 text-muted-foreground">(optional)</span><input type="number" min="0" step="0.01" value={form.retailStoreMaxQuantity ?? ''} onChange={(event) => setForm({ ...form, retailStoreMaxQuantity: event.target.value ? Number(event.target.value) : null })} className="input-base mt-1.5 w-full px-3 py-2.5" placeholder="No maximum" /></label></>}
                  {form.saleChannel !== 'b2b' && <><label className="text-sm font-700">Personal minimum<input type="number" min="0" step="0.01" value={form.endUserMinQuantity} onChange={(event) => setForm({ ...form, endUserMinQuantity: Number(event.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" /></label><label className="text-sm font-700">Personal maximum <span className="font-500 text-muted-foreground">(optional)</span><input type="number" min="0" step="0.01" value={form.endUserMaxQuantity ?? ''} onChange={(event) => setForm({ ...form, endUserMaxQuantity: event.target.value ? Number(event.target.value) : null })} className="input-base mt-1.5 w-full px-3 py-2.5" placeholder="No maximum" /></label></>}
                </div>
              </section>

              <label className="block text-sm font-700">Listing status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProductStatus })} className="input-base mt-1.5 w-full px-3 py-2.5"><option value="draft">Draft — private</option><option value="active">Active — visible after approval</option><option value="archived">Archived</option></select></label>

              <div className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" onClick={() => setModalOpen(false)} className="ft-secondary-action px-5 py-2.5">Cancel</button><button type="submit" disabled={saving} className="ft-primary-action px-5 py-2.5 disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
