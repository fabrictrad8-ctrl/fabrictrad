'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import ProductShareButton from '@/components/ProductShareButton';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { INDIAN_STATES_AND_UTS } from '@/lib/india';

type ProductStatus = 'draft' | 'active' | 'archived';

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
};

const categorySuggestions = [
  'Silk',
  'Cotton',
  'Net & Netting',
  'Georgette',
  'Polyester',
  'Handloom',
  'Velvet',
  'Organza',
  'Linen',
  'Denim',
  'Wool',
  'Sherwani',
  'Jodhpuri',
  'Indo-Western',
  'Saree',
  'Other',
];

const workSuggestions = [
  'Plain',
  'Embroidered',
  'Zari Work',
  'Block Print',
  'Digital Print',
  'Handloom',
  'Sequence',
  'Other',
];

const unitSuggestions = ['metre', 'meter', 'mtr', 'yard', 'kg', 'kilogram', 'farma', 'piece', 'pieces', 'roll'];

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
};

const demoInventory: InventoryProduct[] = [
  {
    id: 'demo-1',
    name: 'Pure Dyeable Soft Nett Fabric',
    sku: 'STM-NET-001',
    category: 'Net & Netting',
    description: 'Soft dyeable nett fabric.',
    price_per_unit: 840,
    unit: 'mtr',
    unit_label: 'metre',
    available_quantity: 2400,
    reserved_quantity: 500,
    min_stock: 200,
    moq: 50,
    gsm: 120,
    width_inches: 44,
    work_type: 'Embroidered',
    image_url: 'https://images.unsplash.com/photo-1727933882951-115ddb44388d?w=400&auto=format&fit=crop',
    dispatch_days: 3,
    origin_city: 'Surat',
    origin_state: 'Gujarat',
    status: 'active',
    approval_status: 'approved',
  },
  {
    id: 'demo-2',
    name: 'Organza Sequence Fabric',
    sku: 'STM-ORG-001',
    category: 'Organza',
    description: 'Sequence organza for occasionwear.',
    price_per_unit: 980,
    unit: 'mtr',
    unit_label: 'metre',
    available_quantity: 45,
    reserved_quantity: 20,
    min_stock: 100,
    moq: 20,
    gsm: null,
    width_inches: null,
    work_type: 'Sequence',
    image_url: null,
    dispatch_days: 4,
    origin_city: 'Surat',
    origin_state: 'Gujarat',
    status: 'active',
    approval_status: 'approved',
  },
];

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
  return {
    name: product.name || '',
    sku: product.sku || '',
    category: product.category || '',
    description: product.description || '',
    pricePerUnit: Number(product.price_per_unit || 0),
    unitLabel: unitDisplay(product),
    availableQuantity: Number(product.available_quantity || 0),
    minStock: Number(product.min_stock || 0),
    moq: Number(product.moq || 1),
    gsm: product.gsm ?? null,
    widthInches: product.width_inches ?? null,
    workType: product.work_type || '',
    imageUrl: product.image_url || '',
    dispatchDays: Number(product.dispatch_days || 3),
    originCity: product.origin_city || '',
    originState: product.origin_state || '',
    status: product.status || 'draft',
  };
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: '{}',
      });
      if (repairResponse.ok) {
        const retry = await supabase
          .from('seller_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        seller = retry.data;
        sellerError = retry.error;
      }
    }

    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'We could not finish the seller profile. Sign out and sign in again.');
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
  }, [isDemoAccount, user?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('fabrictrad:seller-stock-alerts');
      if (saved) setAlerts(JSON.parse(saved));
    } catch {
      // Preferences are best effort.
    }
  }, []);

  const stockCounts = useMemo(
    () => ({
      inStock: products.filter(
        (product) => product.status !== 'archived' && product.available_quantity > product.min_stock
      ).length,
      low: products.filter(
        (product) => product.status !== 'archived' && product.available_quantity <= product.min_stock
      ).length,
      active: products.filter((product) => product.status === 'active').length,
      drafts: products.filter((product) => product.status === 'draft').length,
    }),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !normalized ||
        `${product.name} ${product.sku} ${product.category} ${product.work_type}`
          .toLowerCase()
          .includes(normalized);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'low-stock'
          ? product.status !== 'archived' && product.available_quantity <= product.min_stock
          : product.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [products, query, statusFilter]);

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedIds.includes(product.id));

  const openAdd = () => {
    window.location.assign('/seller-dashboard?tab=upload');
  };

  const openEdit = (product: InventoryProduct) => {
    setEditingId(product.id);
    setForm(formFromProduct(product));
    setModalOpen(true);
  };

  const validateForm = () => {
    if (!form.name.trim() || !form.sku.trim()) return 'Product name and SKU are required.';
    if (form.pricePerUnit <= 0) return 'Price must be greater than zero.';
    if (form.availableQuantity < 0 || form.minStock < 0) return 'Stock values cannot be negative.';
    if (form.moq < 1) return 'MOQ must be at least one.';
    if (!form.unitLabel.trim()) return 'Enter the stock measurement unit.';
    if (!optionalUrlValid(form.imageUrl)) return 'Image URL must begin with http:// or https://, or be left blank.';
    return null;
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateForm();
    if (validation) return toast.error(validation);
    if (!sellerId) return toast.error('Seller profile is not available.');

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category.trim() || 'Other',
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
    };

    try {
      if (isDemoAccount) {
        if (editingId) {
          setProducts((current) =>
            current.map((product) =>
              product.id === editingId
                ? ({
                    ...product,
                    ...payload,
                    reserved_quantity: product.reserved_quantity,
                    updated_at: new Date().toISOString(),
                  } as InventoryProduct)
                : product
            )
          );
        }
      } else {
        const supabase = createClient();
        const result = editingId
          ? await supabase
              .from('seller_products')
              .update(payload)
              .eq('id', editingId)
              .eq('seller_id', sellerId)
          : await supabase
              .from('seller_products')
              .insert({ seller_id: sellerId, reserved_quantity: 0, ...payload });
        if (result.error) throw result.error;
        await loadProducts();
      }
      toast.success(editingId ? 'Product updated.' : 'Product saved.');
      setModalOpen(false);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const updateProductStatus = async (ids: string[], status: ProductStatus) => {
    if (!ids.length || !sellerId) return;
    if (
      status === 'archived' &&
      !window.confirm(`Archive ${ids.length} selected product${ids.length === 1 ? '' : 's'}?`)
    )
      return;

    setBulkSaving(true);
    try {
      if (isDemoAccount) {
        setProducts((current) =>
          current.map((product) => (ids.includes(product.id) ? { ...product, status } : product))
        );
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
      const headers = parseCsvLine(lines[0]).map((header) =>
        header.toLowerCase().replace(/\s+/g, '_')
      );
      const missing = ['name', 'sku', 'price', 'available', 'moq'].filter(
        (key) => !headers.includes(key)
      );
      if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}.`);

      const records = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
        const unitLabel = row.unit || 'metre';
        const requestedStatus: ProductStatus =
          row.status === 'active' ? 'active' : row.status === 'archived' ? 'archived' : 'draft';
        return {
          seller_id: sellerId,
          name: row.name,
          sku: row.sku.toUpperCase(),
          category: row.category || 'Other',
          description: row.description || null,
          price_per_unit: Number(row.price),
          unit: unitCode(unitLabel),
          unit_label: unitLabel,
          available_quantity: Number(row.available),
          reserved_quantity: 0,
          min_stock: Number(row.min_stock || 0),
          moq: Number(row.moq),
          gsm: row.gsm ? Number(row.gsm) : null,
          width_inches: row.width ? Number(row.width) : null,
          work_type: row.work_type || 'Plain',
          image_url: row.image_url || null,
          dispatch_days: Number(row.dispatch_days || 3),
          origin_city: row.origin_city || profile?.city || null,
          origin_state: row.origin_state || profile?.state || null,
          status: requestedStatus,
        };
      });

      if (
        records.some(
          (record) =>
            !record.name ||
            !record.sku ||
            record.price_per_unit <= 0 ||
            record.available_quantity < 0 ||
            record.moq < 1
        )
      ) {
        throw new Error('One or more CSV rows contain invalid values.');
      }

      if (isDemoAccount) {
        setProducts((current) => [
          ...records.map(
            (record, index) =>
              ({
                id: `demo-csv-${Date.now()}-${index}`,
                approval_status: 'approved',
                ...record,
              } as InventoryProduct)
          ),
          ...current,
        ]);
      } else {
        const supabase = createClient();
        const { error: importError } = await supabase
          .from('seller_products')
          .upsert(records, { onConflict: 'seller_id,sku' });
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
      <datalist id="inventory-category-suggestions">
        {categorySuggestions.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="inventory-work-suggestions">
        {workSuggestions.map((item) => <option key={item} value={item} />)}
      </datalist>
      <datalist id="inventory-unit-suggestions">
        {unitSuggestions.map((item) => <option key={item} value={item} />)}
      </datalist>

      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="ft-route-kicker">Products</p>
          <h1 className="mt-1 text-2xl font-800 tracking-tight text-foreground">Inventory & listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, share, publish, archive, import and update the stock buyers see.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={importCsv}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="ft-secondary-action flex items-center gap-2 px-3 py-2 text-xs"
          >
            <Icon name="ArrowUpTrayIcon" size={14} /> Import CSV
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="ft-primary-action flex items-center gap-2 px-3 py-2 text-xs"
          >
            <Icon name="PlusIcon" size={14} /> Add product
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
        New products now use the full Add product flow. <strong className="text-foreground">GSM and external URLs are optional</strong>, and FabricTrad automatically creates a sharing URL for every approved live product.
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
          <button type="button" onClick={() => void loadProducts()} className="font-800 underline">
            Retry
          </button>
        </div>
      )}

      <div className="ft-toolbar mb-3">
        <div className="ft-search min-w-[240px] flex-[2_1_360px]">
          <Icon name="MagnifyingGlassIcon" size={17} className="ml-3 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, SKU, category or work type"
            className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mr-2 rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <Icon name="XMarkIcon" size={15} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="ft-filter-control min-w-[155px] px-3 text-sm"
        >
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
          <button
            type="button"
            disabled={bulkSaving}
            onClick={() => void updateProductStatus(selectedIds, 'active')}
            className="ft-primary-action px-3 py-2 text-xs"
          >
            Publish
          </button>
          <button
            type="button"
            disabled={bulkSaving}
            onClick={() => void updateProductStatus(selectedIds, 'draft')}
            className="ft-secondary-action px-3 py-2 text-xs"
          >
            Move to draft
          </button>
          <button
            type="button"
            disabled={bulkSaving}
            onClick={() => void updateProductStatus(selectedIds, 'archived')}
            className="ft-secondary-action px-3 py-2 text-xs text-error"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Clear selection"
          >
            <Icon name="XMarkIcon" size={16} />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) =>
                      setSelectedIds(event.target.checked ? filteredProducts.map((product) => product.id) : [])
                    }
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
              {loading && (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </td>
                </tr>
              )}
              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Icon name="ArchiveBoxIcon" size={32} className="mx-auto mb-2 text-primary" />
                    <p className="text-sm font-800">No matching products</p>
                    <p className="mt-1 text-xs text-muted-foreground">Change the search or filter, or add a new product.</p>
                    <button type="button" onClick={openAdd} className="ft-primary-action mt-4 px-4 py-2 text-xs">
                      Add product
                    </button>
                  </td>
                </tr>
              )}
              {!loading &&
                filteredProducts.map((product) => {
                  const low = product.available_quantity <= product.min_stock;
                  const selected = selectedIds.includes(product.id);
                  const shareable =
                    product.status === 'active' &&
                    (product.approval_status === 'approved' || product.approval_status === 'active');
                  const productUrl = `/product-detail?id=seller-${encodeURIComponent(product.id)}`;
                  const displayUnit = unitDisplay(product);

                  return (
                    <tr key={product.id} className={selected ? 'bg-primary/5' : ''}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? current.includes(product.id)
                                  ? current
                                  : [...current, product.id]
                                : current.filter((id) => id !== product.id)
                            )
                          }
                          aria-label={`Select ${product.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            {product.image_url ? (
                              <AppImage
                                src={product.image_url}
                                alt={product.name}
                                fill
                                sizes="44px"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-primary">
                                <Icon name="PhotoIcon" size={18} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-800 text-foreground">{product.name}</p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              {product.sku} · {product.category}
                            </p>
                            {low && (
                              <p className="mt-1 text-[11px] font-700 text-error">
                                Low stock · threshold {product.min_stock}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(product.available_quantity || 0).toLocaleString('en-IN')} {displayUnit}
                      </td>
                      <td className="px-4 py-3 text-right text-warning">
                        {Number(product.reserved_quantity || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-750">
                        ₹{Number(product.price_per_unit || 0).toLocaleString('en-IN')}/{displayUnit}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`ft-badge ${
                            product.status === 'active'
                              ? 'ft-badge--success'
                              : product.status === 'draft'
                                ? 'ft-badge--warning'
                                : ''
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          {shareable && (
                            <>
                              <ProductShareButton
                                productId={product.id}
                                productName={product.name}
                                compact
                              />
                              <a
                                href={productUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="ft-icon-button !min-h-9 !min-w-9"
                                aria-label={`Open ${product.name}`}
                                title="Open live product"
                              >
                                <Icon name="ArrowTopRightOnSquareIcon" size={15} />
                              </a>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="ft-icon-button !min-h-9 !min-w-9"
                            aria-label={`Edit ${product.name}`}
                            title="Edit product"
                          >
                            <Icon name="PencilSquareIcon" size={15} />
                          </button>
                          {product.status !== 'archived' && (
                            <button
                              type="button"
                              onClick={() => void updateProductStatus([product.id], 'archived')}
                              className="ft-icon-button !min-h-9 !min-w-9 hover:!text-error"
                              aria-label={`Archive ${product.name}`}
                              title="Archive product"
                            >
                              <Icon name="ArchiveBoxXMarkIcon" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 flex items-center gap-2 font-800">
          <Icon name="BellAlertIcon" size={16} className="text-primary" /> Low-stock notifications
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Choose how FabricTrad should alert you when available stock reaches its threshold.
        </p>
        <div className="flex flex-wrap gap-2">
          {([['inApp', 'In-app'], ['sms', 'SMS'], ['email', 'Email']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => updateAlert(key)}
              className={`rounded-lg border px-3 py-2 text-xs font-700 ${
                alerts[key]
                  ? 'border-primary/30 bg-primary/5 text-primary'
                  : 'border-border bg-muted text-muted-foreground'
              }`}
              aria-pressed={alerts[key]}
            >
              {alerts[key] ? '✓ ' : ''}
              {label}
            </button>
          ))}
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="ft-route-kicker">Product editor</p>
                <h2 className="mt-1 text-xl font-800">Update product</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  GSM, width and image URL are optional. Category, work type and unit accept your own text.
                </p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="ft-icon-button">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            <form onSubmit={saveProduct} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-700">
                  Product name *
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                  />
                </label>
                <label className="text-sm font-700">
                  SKU *
                  <input
                    required
                    value={form.sku}
                    onChange={(event) => setForm({ ...form, sku: event.target.value.toUpperCase() })}
                    className="input-base mt-1.5 w-full px-3 py-2.5 uppercase"
                  />
                </label>
                <label className="text-sm font-700">
                  Category
                  <input
                    list="inventory-category-suggestions"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                    placeholder="Type any category"
                  />
                </label>
                <label className="text-sm font-700">
                  Work type / finish
                  <input
                    list="inventory-work-suggestions"
                    value={form.workType}
                    onChange={(event) => setForm({ ...form, workType: event.target.value })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                    placeholder="Type any work or finish"
                  />
                </label>
                <label className="text-sm font-700">
                  Price *
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.pricePerUnit || ''}
                    onChange={(event) => setForm({ ...form, pricePerUnit: Number(event.target.value) })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                  />
                </label>
                <label className="text-sm font-700">
                  Measurement unit *
                  <input
                    required
                    list="inventory-unit-suggestions"
                    value={form.unitLabel}
                    onChange={(event) => setForm({ ...form, unitLabel: event.target.value })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                    placeholder="metre, kg, yard, farma, piece…"
                  />
                </label>
                <label className="text-sm font-700">
                  Available stock *
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.availableQuantity}
                    onChange={(event) => setForm({ ...form, availableQuantity: Number(event.target.value) })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                  />
                </label>
                <label className="text-sm font-700">
                  Minimum stock alert
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minStock}
                    onChange={(event) => setForm({ ...form, minStock: Number(event.target.value) })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                  />
                </label>
                <label className="text-sm font-700">
                  MOQ *
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.moq}
                    onChange={(event) => setForm({ ...form, moq: Number(event.target.value) })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                  />
                </label>
                <label className="text-sm font-700">
                  Dispatch days
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={form.dispatchDays}
                    onChange={(event) => setForm({ ...form, dispatchDays: Number(event.target.value) })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                  />
                </label>
                <label className="text-sm font-700">
                  GSM <span className="font-500 text-muted-foreground">(optional)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.gsm ?? ''}
                    onChange={(event) =>
                      setForm({ ...form, gsm: event.target.value ? Number(event.target.value) : null })
                    }
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                    placeholder="Leave blank if not known"
                  />
                </label>
                <label className="text-sm font-700">
                  Width (inches) <span className="font-500 text-muted-foreground">(optional)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.widthInches ?? ''}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        widthInches: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                    placeholder="Leave blank if not known"
                  />
                </label>
                <label className="text-sm font-700">
                  Origin city
                  <input
                    value={form.originCity}
                    onChange={(event) => setForm({ ...form, originCity: event.target.value })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                  />
                </label>
                <label className="text-sm font-700">
                  Origin state
                  <select
                    value={form.originState}
                    onChange={(event) => setForm({ ...form, originState: event.target.value })}
                    className="input-base mt-1.5 w-full px-3 py-2.5"
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES_AND_UTS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-700">
                Image URL <span className="font-500 text-muted-foreground">(optional)</span>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                  className="input-base mt-1.5 w-full px-3 py-2.5"
                  placeholder="Leave blank if you do not have an image URL"
                />
              </label>
              <p className="-mt-2 text-[11px] leading-5 text-muted-foreground">
                This is only a legacy image-link field. It is not the product sharing URL. FabricTrad creates the sharing URL automatically for approved live products.
              </p>

              <label className="block text-sm font-700">
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="input-base mt-1.5 w-full px-3 py-2.5"
                />
              </label>

              <label className="block text-sm font-700">
                Listing status
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as ProductStatus })}
                  className="input-base mt-1.5 w-full px-3 py-2.5"
                >
                  <option value="draft">Draft — private</option>
                  <option value="active">Active — visible after approval</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="ft-secondary-action px-5 py-2.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="ft-primary-action px-5 py-2.5 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
