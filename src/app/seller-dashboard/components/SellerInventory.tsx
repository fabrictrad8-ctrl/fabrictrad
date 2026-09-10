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
import { pillClassForStatus, pillLabel } from '@/lib/statusPill';
import {
  HSN_QUICK_PICKS,
  describeHsn,
  describeSellerProductError,
  listingStateSummary,
  liveListingBlockers,
  normalizeHsn,
  previewGstRate,
  RESUBMITTABLE_APPROVAL_STATUSES,
  validateHsn,
} from '@/app/seller-dashboard/lib/sellerListingGuards';

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
  hsn_code: string | null;
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
  hsnCode: string;
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
  hsnCode: '',
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
    hsnCode: product.hsn_code || '',
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

type VariantRollup = {
  total: number;
  active: number;
  outOfStock: number;
  sellable: number;
};

/**
 * What a buyer can order right now.
 *
 * `available_quantity` is decremented at checkout by
 * `submit_catalog_order_request`. `reserved_quantity` holds stock for B2B
 * orders still awaiting the buyer company's approval, where
 * `available_quantity` has not moved yet. Neither column alone is the sellable
 * figure — the difference is.
 */
function sellableStock(product: Pick<InventoryProduct, 'available_quantity' | 'reserved_quantity'>) {
  return Math.max(0, Number(product.available_quantity || 0) - Number(product.reserved_quantity || 0));
}

type StockState = 'out' | 'low' | 'ok';

function stockState(product: InventoryProduct): StockState {
  const sellable = sellableStock(product);
  if (sellable <= 0) return 'out';
  if (sellable <= Number(product.min_stock || 0)) return 'low';
  return 'ok';
}

const CSV_REQUIRED_COLUMNS = ['name', 'sku', 'price', 'available', 'moq'];

const CSV_TEMPLATE = [
  'name,sku,category,description,price,unit,available,min_stock,moq,hsn,gsm,width,work_type,image_url,dispatch_days,origin_city,origin_state,status,sale_channel,retail_store_min_quantity,retail_store_max_quantity,end_user_min_quantity,end_user_max_quantity',
  'Pure Soft Net,NET-001,Net & Netting,Multi thread cording work,940,metre,120,10,3,5407,80,56,Cording,,3,Surat,Gujarat,draft,both,3,100,1,10',
].join('\n');

/**
 * CSV cells arrive as strings. `Number('abc')` is NaN and `NaN <= 0` is false,
 * so a plain comparison silently lets junk through to Postgres — this returns
 * null for anything that is not a real number instead.
 */
function csvNumber(value: unknown, fallback: number | null = null): number | null {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
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
  // Mirrors require_verified_gstin_for_live_listing(): the database only accepts
  // status = 'active' when gstin_status = 'active' OR gstin_verified is true.
  const [gstinVerified, setGstinVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus | 'low-stock' | 'out-of-stock'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [variantStock, setVariantStock] = useState<Record<string, VariantRollup>>({});
  const [stockEditId, setStockEditId] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState('');
  const [stockSaving, setStockSaving] = useState(false);

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
      .select('id,gstin_status,gstin_verified')
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
          .select('id,gstin_status,gstin_verified')
          .eq('user_id', user.id)
          .maybeSingle();
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
    setGstinVerified(seller.gstin_status === 'active' || seller.gstin_verified === true);
    const [productResult, variantResult] = await Promise.all([
      supabase.from('seller_products').select('*').eq('seller_id', seller.id).order('updated_at', { ascending: false }),
      supabase
        .from('seller_product_variants')
        .select('product_id,available_quantity,reserved_quantity,status')
        .eq('seller_id', seller.id)
        .neq('status', 'archived'),
    ]);

    if (productResult.error) {
      setError(productResult.error.message);
      setProducts([]);
    } else {
      setProducts((productResult.data || []) as InventoryProduct[]);
    }

    // A variant read failure must never blank the product list — the roll-up is
    // extra context, so it simply goes missing rather than breaking the page.
    const rollup: Record<string, VariantRollup> = {};
    if (!variantResult.error) {
      (variantResult.data || []).forEach((variant) => {
        const key = String(variant.product_id);
        const entry = rollup[key] || { total: 0, active: 0, outOfStock: 0, sellable: 0 };
        const sellable = sellableStock(variant as Pick<InventoryProduct, 'available_quantity' | 'reserved_quantity'>);
        entry.total += 1;
        if (variant.status === 'active') entry.active += 1;
        if (sellable <= 0) entry.outOfStock += 1;
        entry.sellable += sellable;
        rollup[key] = entry;
      });
    }
    setVariantStock(rollup);

    setSelectedIds([]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const stockCounts = useMemo(() => ({
    inStock: products.filter((product) => product.status !== 'archived' && Number(product.available_quantity) - Number(product.reserved_quantity || 0) > Number(product.min_stock || 0)).length,
    low: products.filter((product) => product.status !== 'archived' && Number(product.available_quantity) - Number(product.reserved_quantity || 0) <= Number(product.min_stock || 0)).length,
    // "Live" must mean a buyer can actually order it, which needs approval as
    // well as an active status. Counting status alone reported 5 live listings
    // to a seller who had 2: the other 3 were published and still waiting for
    // FabricTrad review, exactly as their own row labels said. The seller
    // Overview tile and admin_marketplace_totals both require both fields, so
    // this was the only place quoting a number nobody could buy from.
    active: products.filter((product) => product.status === 'active' && product.approval_status === 'approved').length,
    drafts: products.filter((product) => product.status === 'draft').length,
  }), [products]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !normalized || `${product.name} ${product.sku} ${product.category} ${product.work_type}`.toLowerCase().includes(normalized);
      const state = stockState(product);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'low-stock'
            ? product.status !== 'archived' && state === 'low'
            : statusFilter === 'out-of-stock'
              ? product.status !== 'archived' && state === 'out'
              : product.status === statusFilter;
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
    if (form.hsnCode.trim() && !validateHsn(form.hsnCode)) return 'HSN must be 4, 6 or 8 digits, or left blank.';
    // The database refuses status = 'active' without a verified GSTIN and a
    // valid HSN. Say so here rather than letting Postgres raise it.
    if (form.status === 'active') {
      const blockers = liveListingBlockers({ gstinVerified, hsnCode: form.hsnCode });
      if (blockers.length) {
        return `${blockers.map((item) => item.message).join(' ')} Choose "Draft" for now — ${blockers[0].fix.charAt(0).toLowerCase()}${blockers[0].fix.slice(1)}`;
      }
    }
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
          hsn_code: normalizeHsn(form.hsnCode) || null,
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
      toast.error(describeSellerProductError(saveError, 'Could not save product.'), { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const updateProductStatus = async (ids: string[], status: ProductStatus) => {
    if (!ids.length || !sellerId) return;
    if (status === 'archived' && !window.confirm(`Archive ${ids.length} selected product${ids.length === 1 ? '' : 's'}?`)) return;

    // Publishing is gated in the database. Filter first so a mixed selection
    // publishes what it can instead of failing the whole batch with a raw
    // Postgres exception, and name exactly what is blocking the rest.
    let targetIds = ids;
    if (status === 'active') {
      if (!gstinVerified) {
        toast.error(
          'Products cannot go live until your GSTIN is verified. They stay as drafts and publish as soon as verification is approved.',
          { duration: 8000 }
        );
        return;
      }
      const selected = products.filter((product) => ids.includes(product.id));
      const missingHsn = selected.filter((product) => !validateHsn(product.hsn_code));
      targetIds = selected.filter((product) => validateHsn(product.hsn_code)).map((product) => product.id);
      if (missingHsn.length) {
        toast.error(
          `${missingHsn.length} product${missingHsn.length === 1 ? ' has' : 's have'} no HSN code and cannot go live: ${missingHsn
            .slice(0, 3)
            .map((product) => product.sku)
            .join(', ')}${missingHsn.length > 3 ? '…' : ''}. Open each one and add its 4, 6 or 8 digit HSN.`,
          { duration: 9000 }
        );
      }
      if (!targetIds.length) return;
    }

    setBulkSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('seller_products')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('seller_id', sellerId)
        .in('id', targetIds);
      if (updateError) throw updateError;

      // Flipping status to 'active' alone leaves approval_status at
      // 'not_submitted', so the listing never enters moderation and never goes
      // live. Publishing means submitting for review — the same thing the
      // Add-product screen does when it creates a listing.
      if (status === 'active') {
        const { error: reviewError } = await supabase
          .from('seller_products')
          .update({ approval_status: 'pending', updated_at: new Date().toISOString() })
          .eq('seller_id', sellerId)
          .in('id', targetIds)
          .in('approval_status', RESUBMITTABLE_APPROVAL_STATUSES);
        if (reviewError) throw reviewError;
      }

      toast.success(
        status === 'active'
          ? `${targetIds.length} product${targetIds.length === 1 ? '' : 's'} published and sent for FabricTrad review.`
          : `${targetIds.length} product${targetIds.length === 1 ? '' : 's'} moved to ${status}.`
      );
      await loadProducts();
    } catch (caught) {
      toast.error(describeSellerProductError(caught, 'Could not update selected products.'), { duration: 8000 });
    } finally {
      setBulkSaving(false);
    }
  };

  // Restocking is the single most common inventory action, so it is editable
  // straight from the row rather than only inside the full product editor.
  // Only available_quantity moves here — reserved_quantity belongs to live
  // orders and is never writable by hand.
  const saveStock = async (product: InventoryProduct) => {
    if (!sellerId) return;
    const next = Number(stockDraft);
    if (!Number.isFinite(next) || next < 0) {
      toast.error('Enter a stock quantity of zero or more.');
      return;
    }
    if (next === Number(product.available_quantity || 0)) {
      setStockEditId(null);
      return;
    }
    setStockSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('seller_products')
        .update({ available_quantity: next, updated_at: new Date().toISOString() })
        .eq('seller_id', sellerId)
        .eq('id', product.id);
      if (updateError) throw updateError;
      toast.success(`${product.name} stock updated to ${next.toLocaleString('en-IN')}.`);
      setStockEditId(null);
      await loadProducts();
    } catch (caught) {
      toast.error(describeSellerProductError(caught, 'Stock could not be updated.'));
    } finally {
      setStockSaving(false);
    }
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([`${CSV_TEMPLATE}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fabrictrad-products-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  /**
   * Bulk import. Every row is validated against the same rules the manual
   * editor enforces *before* anything is sent to Postgres, so a bad row comes
   * back as "Row 4: price must be a number greater than 0" instead of a raw
   * constraint violation. The import is all-or-nothing: a seller should never
   * have to guess which half of their file landed.
   */
  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !sellerId) return;
    if (!file.name.toLowerCase().endsWith('.csv')) return toast.error('Choose a CSV file.');

    try {
      const lines = (await file.text()).split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) throw new Error('The CSV has a header row but no product rows.');
      const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/\s+/g, '_'));
      const missing = CSV_REQUIRED_COLUMNS.filter((key) => !headers.includes(key));
      if (missing.length) {
        throw new Error(
          `The CSV is missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Download the template for the exact header row.`
        );
      }

      // A file without a `status` column must never silently unpublish existing
      // listings, so the column is simply left untouched on upsert — Postgres
      // defaults new rows to 'draft' and keeps the current value on old ones.
      const hasStatusColumn = headers.includes('status');
      const rowErrors: string[] = [];
      const activeSkus: string[] = [];
      const seenSkus = new Map<string, number>();
      const records = lines.slice(1).map((line, index) => {
        const lineNumber = index + 2;
        const values = parseCsvLine(line);
        const row = Object.fromEntries(headers.map((header, position) => [header, values[position] || '']));
        const issues: string[] = [];

        const name = String(row.name || '').trim();
        const sku = String(row.sku || '').trim().toUpperCase();
        if (!name) issues.push('name is empty');
        if (!sku) issues.push('sku is empty');
        else if (seenSkus.has(sku)) issues.push(`sku ${sku} is repeated (also on row ${seenSkus.get(sku)})`);
        else seenSkus.set(sku, lineNumber);

        const price = csvNumber(row.price);
        if (price === null || price <= 0) issues.push('price must be a number greater than 0');
        const available = csvNumber(row.available);
        if (available === null || available < 0) issues.push('available must be a number of 0 or more');
        const moqRaw = csvNumber(row.moq);
        if (moqRaw === null || !Number.isInteger(moqRaw) || moqRaw < 1) issues.push('moq must be a whole number of at least 1');
        const moq = moqRaw !== null && Number.isInteger(moqRaw) && moqRaw >= 1 ? moqRaw : 1;

        const minStock = csvNumber(row.min_stock, 0);
        if (minStock === null || minStock < 0) issues.push('min_stock must be a number of 0 or more');
        const gsm = row.gsm ? csvNumber(row.gsm) : null;
        if (row.gsm && (gsm === null || gsm <= 0)) issues.push('gsm must be a positive number');
        const width = row.width ? csvNumber(row.width) : null;
        if (row.width && (width === null || width <= 0)) issues.push('width must be a positive number');
        const dispatchDays = csvNumber(row.dispatch_days, 3);
        if (dispatchDays === null || !Number.isInteger(dispatchDays) || dispatchDays < 1 || dispatchDays > 30) {
          issues.push('dispatch_days must be a whole number from 1 to 30');
        }

        const unitLabel = String(row.unit || '').trim() || 'metre';
        const imageUrl = String(row.image_url || '').trim();
        if (imageUrl && !optionalUrlValid(imageUrl)) issues.push('image_url must begin with http:// or https://');

        const hsn = normalizeHsn(row.hsn || row.hsn_code);
        if ((row.hsn || row.hsn_code) && !validateHsn(hsn)) issues.push('hsn must be 4, 6 or 8 digits');

        const saleChannelRaw = String(row.sale_channel || '').trim().toLowerCase();
        if (saleChannelRaw && !['b2b', 'retail', 'both'].includes(saleChannelRaw)) {
          issues.push('sale_channel must be b2b, retail or both');
        }
        const saleChannel: SaleChannel = saleChannelRaw === 'retail' || saleChannelRaw === 'both' ? saleChannelRaw : 'b2b';
        const personalEnabled = saleChannel !== 'b2b';

        const retailMin = csvNumber(row.retail_store_min_quantity, moq);
        const retailMax = row.retail_store_max_quantity ? csvNumber(row.retail_store_max_quantity) : null;
        if (retailMin === null || retailMin < 0) issues.push('retail_store_min_quantity must be 0 or more');
        if (row.retail_store_max_quantity && retailMax === null) issues.push('retail_store_max_quantity must be a number');
        if (retailMax !== null && retailMin !== null && retailMax < retailMin) {
          issues.push('retail_store_max_quantity cannot be below retail_store_min_quantity');
        }
        const endMin = personalEnabled ? csvNumber(row.end_user_min_quantity, 1) : null;
        const endMax = personalEnabled && row.end_user_max_quantity ? csvNumber(row.end_user_max_quantity) : null;
        if (personalEnabled && (endMin === null || endMin < 0)) issues.push('end_user_min_quantity must be 0 or more');
        if (endMax !== null && endMin !== null && endMax < endMin) {
          issues.push('end_user_max_quantity cannot be below end_user_min_quantity');
        }

        const statusRaw = String(row.status || '').trim().toLowerCase();
        if (statusRaw && !['draft', 'active', 'archived'].includes(statusRaw)) {
          issues.push('status must be draft, active or archived');
        }
        const status: ProductStatus = statusRaw === 'active' ? 'active' : statusRaw === 'archived' ? 'archived' : 'draft';
        if (status === 'active') {
          if (sku) activeSkus.push(sku);
          // Same gate as the editor, reported per row rather than as a
          // database exception halfway through the file.
          liveListingBlockers({ gstinVerified, hsnCode: hsn }).forEach((blocker) => {
            issues.push(
              blocker.key === 'hsn'
                ? 'status is active but hsn is missing — add an hsn column value or set status to draft'
                : 'status is active but your GSTIN is not verified yet — set status to draft'
            );
          });
        }

        if (issues.length) rowErrors.push(`Row ${lineNumber}: ${issues.join('; ')}.`);

        return {
          seller_id: sellerId,
          name,
          sku,
          category: String(row.category || '').trim() || 'Other',
          description: String(row.description || '').trim() || null,
          price_per_unit: price ?? 0,
          unit: unitCode(unitLabel),
          unit_label: unitLabel,
          available_quantity: available ?? 0,
          min_stock: minStock ?? 0,
          moq,
          gsm,
          width_inches: width,
          work_type: String(row.work_type || '').trim() || 'Plain',
          hsn_code: hsn || null,
          image_url: imageUrl || null,
          dispatch_days: dispatchDays ?? 3,
          origin_city: String(row.origin_city || '').trim() || profile?.city || null,
          origin_state: String(row.origin_state || '').trim() || profile?.state || null,
          ...(hasStatusColumn ? { status } : {}),
          sale_channel: saleChannel,
          retail_store_min_quantity: retailMin ?? moq,
          retail_store_max_quantity: retailMax,
          end_user_enabled: personalEnabled,
          end_user_limit_mode: personalEnabled ? 'custom' : 'disabled',
          end_user_min_quantity: personalEnabled ? endMin : null,
          end_user_max_quantity: personalEnabled ? endMax : null,
          // reserved_quantity is deliberately NOT written here. It holds stock
          // for orders awaiting buyer-company approval, and re-importing a file
          // must never wipe those reservations.
        };
      });

      if (rowErrors.length) {
        const shown = rowErrors.slice(0, 4).join(' ');
        throw new Error(
          `Nothing was imported. ${rowErrors.length} row${rowErrors.length === 1 ? '' : 's'} need fixing. ${shown}${rowErrors.length > 4 ? ` …and ${rowErrors.length - 4} more.` : ''}`
        );
      }

      const supabase = createClient();
      const { error: importError } = await supabase.from('seller_products').upsert(records, { onConflict: 'seller_id,sku' });
      if (importError) throw importError;

      // Rows the seller marked active must actually enter moderation, otherwise
      // they sit at approval_status 'not_submitted' and never reach buyers.
      if (activeSkus.length) {
        const { error: reviewError } = await supabase
          .from('seller_products')
          .update({ approval_status: 'pending', updated_at: new Date().toISOString() })
          .eq('seller_id', sellerId)
          .eq('status', 'active')
          .in('sku', activeSkus)
          .in('approval_status', RESUBMITTABLE_APPROVAL_STATUSES);
        if (reviewError) throw reviewError;
      }

      toast.success(
        `${records.length} product${records.length === 1 ? '' : 's'} imported${
          activeSkus.length
            ? `, ${activeSkus.length} sent for review`
            : hasStatusColumn
              ? ' as drafts'
              : ' — listing status left unchanged'
        }.`
      );
      await loadProducts();
    } catch (caught) {
      toast.error(describeSellerProductError(caught, 'CSV import failed.'), { duration: 12000 });
    }
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
          <button type="button" onClick={downloadCsvTemplate} className="ft-secondary-action flex min-h-11 items-center gap-2 px-3 py-2 text-xs">
            <Icon name="ArrowDownTrayIcon" size={14} /> CSV template
          </button>
          <button type="button" onClick={() => csvInputRef.current?.click()} className="ft-secondary-action flex min-h-11 items-center gap-2 px-3 py-2 text-xs">
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
        <strong className="text-foreground">Personal purchases are controlled per product.</strong> Edit a product below and choose Business + personal, Business only, or Personal only. HSN can be set right in the editor; GTIN, GST overrides and variation limits are under Buyer rules & tax.
      </div>

      {!gstinVerified && !loading && !error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/5 p-3 text-xs leading-5 text-muted-foreground">
          <Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5 shrink-0 text-warning" />
          <p>
            <strong className="text-foreground">GSTIN not verified yet.</strong> Products can be created, edited and stocked
            normally, but none can be published live until GST verification is approved. Keep them as drafts — nothing is lost.{' '}
            <Link href="/seller-dashboard?tab=profile" className="font-800 text-primary hover:underline">Check verification</Link>
          </p>
        </div>
      )}

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
          <option value="all">All products</option><option value="active">Active</option><option value="draft">Draft</option><option value="low-stock">Low stock</option><option value="out-of-stock">Out of stock</option><option value="archived">Archived</option>
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
                const available = sellableStock(product);
                const state = stockState(product);
                const low = state === 'low';
                const variants = variantStock[product.id];
                const editingStock = stockEditId === product.id;
                const selected = selectedIds.includes(product.id);
                const listingState = listingStateSummary(product);
                const shareable = listingState.live;
                const buyerLabel = product.sale_channel === 'both' ? 'Business + personal' : product.sale_channel === 'retail' ? 'Personal only' : 'Business only';
                return (
                  <tr key={product.id} className={selected ? 'bg-primary/5' : ''}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id))} aria-label={`Select ${product.name}`} /></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">{product.image_url ? <AppImage src={product.image_url} alt={product.name} fill sizes="44px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Icon name="PhotoIcon" size={18} /></div>}</div><div className="min-w-0"><p className="truncate text-xs font-800">{product.name}</p><p className="truncate font-mono text-[11px] text-muted-foreground">{product.sku} · {product.category}</p>{state === 'out' && <p className="mt-1 text-[11px] font-700 text-error">Out of stock · buyers cannot order this</p>}{low && <p className="mt-1 text-[11px] font-700 text-warning">Low stock · threshold {product.min_stock}</p>}{variants?.total ? <p className="mt-1 text-[11px] text-muted-foreground">{variants.total} variant{variants.total === 1 ? '' : 's'}{variants.outOfStock > 0 ? ` · ${variants.outOfStock} out of stock` : ''}</p> : null}</div></div></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-750 ${product.sale_channel === 'both' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{buyerLabel}</span></td>
                    <td className="px-4 py-3 text-right">
                      {editingStock ? (
                        <span className="flex items-center justify-end gap-1.5">
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            step="0.01"
                            value={stockDraft}
                            disabled={stockSaving}
                            onChange={(event) => setStockDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') { event.preventDefault(); void saveStock(product); }
                              if (event.key === 'Escape') setStockEditId(null);
                            }}
                            className="input-base w-24 px-2 py-1 text-right text-xs"
                            aria-label={`Stock quantity for ${product.name}`}
                          />
                          <button type="button" onClick={() => void saveStock(product)} disabled={stockSaving} className="ft-icon-button !min-h-8 !min-w-8" aria-label="Save stock">
                            <Icon name={stockSaving ? 'ArrowPathIcon' : 'CheckIcon'} size={14} className={stockSaving ? 'animate-spin' : ''} />
                          </button>
                          <button type="button" onClick={() => setStockEditId(null)} disabled={stockSaving} className="ft-icon-button !min-h-8 !min-w-8" aria-label="Cancel stock edit">
                            <Icon name="XMarkIcon" size={14} />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setStockEditId(product.id); setStockDraft(String(Number(product.available_quantity || 0))); }}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-right transition-colors hover:bg-muted ${state === 'out' ? 'text-error font-800' : state === 'low' ? 'text-warning font-800' : ''}`}
                          title="Click to update stock"
                        >
                          {available.toLocaleString('en-IN')} {displayUnit}
                          <Icon name="PencilSquareIcon" size={12} className="opacity-50" />
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-warning">{Number(product.reserved_quantity || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-750">₹{Number(product.price_per_unit || 0).toLocaleString('en-IN')}/{displayUnit}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={pillClassForStatus(listingState.pillStatus)}>{pillLabel(listingState.pillStatus)}</span>
                      <span className="mt-1 block max-w-[190px] text-[11px] leading-4 text-muted-foreground">{listingState.reason}</span>
                    </td>
                    <td className="px-4 py-3"><div className="flex justify-center gap-1">{shareable && <><ProductShareButton productId={product.id} productName={product.name} compact /><a href={`/product-detail?id=seller-${encodeURIComponent(product.id)}`} target="_blank" rel="noreferrer" className="ft-icon-button !min-h-9 !min-w-9" aria-label={`Open ${product.name}`}><Icon name="ArrowTopRightOnSquareIcon" size={15} /></a></>}<button type="button" onClick={() => openEdit(product)} className="ft-icon-button !min-h-9 !min-w-9" aria-label={`Edit ${product.name}`}><Icon name="PencilSquareIcon" size={15} /></button>{product.status !== 'archived' && <button type="button" onClick={() => void updateProductStatus([product.id], 'archived')} className="ft-icon-button !min-h-9 !min-w-9 hover:!text-error" aria-label={`Archive ${product.name}`}><Icon name="ArchiveBoxXMarkIcon" size={15} /></button>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Update product">
          <button type="button" className="absolute inset-0" onClick={() => !saving && setModalOpen(false)} aria-label="Close product editor" />
          <div className="relative z-10 max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
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
                <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3.5">
                  <label className="block text-sm font-700" htmlFor="inventory-hsn">
                    HSN code <span className="font-500 text-muted-foreground">(required only to publish live)</span>
                    <input
                      id="inventory-hsn"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.hsnCode}
                      onChange={(event) => setForm({ ...form, hsnCode: normalizeHsn(event.target.value) })}
                      className="input-base mt-1.5 w-full px-3 py-2.5 font-mono"
                      placeholder="e.g. 5208"
                    />
                  </label>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    {validateHsn(form.hsnCode) ? (
                      <>
                        <span className="font-800 text-success">Valid HSN.</span>{' '}
                        {describeHsn(form.hsnCode) ? `${describeHsn(form.hsnCode)}. ` : ''}
                        GST on the buyer invoice: {previewGstRate(form.hsnCode, form.pricePerUnit)}%.
                      </>
                    ) : form.hsnCode.trim() ? (
                      <span className="font-800 text-warning">HSN must be 4, 6 or 8 digits — you have {form.hsnCode.length}.</span>
                    ) : (
                      'A 4, 6 or 8 digit HSN is required before this product can go live. It sets the GST rate on the buyer invoice.'
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {HSN_QUICK_PICKS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setForm({ ...form, hsnCode: code })}
                        title={describeHsn(code) || `HSN ${code}`}
                        className={`min-h-9 rounded-lg border px-2.5 font-mono text-[11px] font-700 ${form.hsnCode === code ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
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
