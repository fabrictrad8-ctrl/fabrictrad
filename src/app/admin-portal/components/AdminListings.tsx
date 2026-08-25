'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { createClient } from '@/lib/supabase/client';
import { exportToCSV } from '@/lib/exportUtils';

type ProductRow = {
  id: string;
  seller_id: string;
  name: string | null;
  sku: string | null;
  category: string | null;
  fabric_name: string | null;
  quality: string | null;
  product_type: string | null;
  product_url: string | null;
  custom_attributes: Record<string, string> | null;
  price_per_unit: number | null;
  unit: string | null;
  unit_label: string | null;
  available_quantity: number | null;
  reserved_quantity: number | null;
  moq: number | null;
  image_url: string | null;
  status: string | null;
  approval_status: string | null;
  admin_review_notes: string | null;
  variant_count: number | null;
  gtin: string | null;
  gtin_status: string | null;
  hsn_code: string | null;
  gst_rate: number | null;
  created_at: string | null;
  updated_at: string | null;
  seller_name?: string;
};

type Filter = 'all' | 'pending' | 'active' | 'paused' | 'rejected' | 'out_of_stock';
type ReviewAction = 'approve' | 'reject' | 'pause';

const effectiveStatus = (product: ProductRow) =>
  String(product.approval_status || product.status || 'draft').toLowerCase();

const statusTone = (status: string) => {
  if (['approved', 'active'].includes(status)) return 'bg-success/10 text-success border-success/20';
  if (status === 'rejected') return 'bg-error/10 text-error border-error/20';
  if (status === 'paused') return 'bg-muted text-muted-foreground border-border';
  return 'bg-warning/10 text-warning border-warning/20';
};

const statusLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const displayUnit = (product: ProductRow) => product.unit_label?.trim() || product.unit || 'unit';

export default function AdminListings() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<{ ids: string[]; action: ReviewAction } | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data: rows, error: productsError } = await supabase
      .from('seller_products')
      .select('id,seller_id,name,sku,category,fabric_name,quality,product_type,product_url,custom_attributes,price_per_unit,unit,unit_label,available_quantity,reserved_quantity,moq,image_url,status,approval_status,admin_review_notes,variant_count,gtin,gtin_status,hsn_code,gst_rate,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (productsError) {
      setProducts([]);
      setError('Live seller products could not be loaded.');
      setLoading(false);
      return;
    }

    const sellerIds = [...new Set((rows || []).map((row) => row.seller_id).filter(Boolean))];
    const sellerNames = new Map<string, string>();
    if (sellerIds.length) {
      const { data: sellers } = await supabase
        .from('seller_profiles')
        .select('id,display_name,legal_business_name')
        .in('id', sellerIds);
      (sellers || []).forEach((seller) => {
        sellerNames.set(
          seller.id,
          seller.display_name || seller.legal_business_name || 'FabricTrad seller'
        );
      });
    }

    setProducts(
      ((rows || []) as ProductRow[]).map((product) => ({
        ...product,
        seller_name: sellerNames.get(product.seller_id) || 'FabricTrad seller',
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    if (!focusId || loading) return;
    window.setTimeout(() => {
      document.getElementById(`product-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [focusId, loading]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const status = effectiveStatus(product);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'pending' && ['draft', 'pending', 'pending_review', 'submitted'].includes(status)) ||
        (filter === 'active' && ['active', 'approved'].includes(status)) ||
        (filter === 'paused' && status === 'paused') ||
        (filter === 'rejected' && status === 'rejected') ||
        (filter === 'out_of_stock' && Number(product.available_quantity || 0) <= 0);
      if (!matchesFilter) return false;
      if (!normalized) return true;
      return [
        product.name,
        product.sku,
        product.category,
        product.fabric_name,
        product.quality,
        product.product_type,
        product.unit_label,
        product.seller_name,
        product.gtin,
        product.hsn_code,
        status,
        ...Object.entries(product.custom_attributes || {}).flat(),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, products, query]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => filtered.some((product) => product.id === id)));
  }, [filtered]);

  const saveReview = async () => {
    if (!reviewing?.ids.length) return;
    if (reviewing.action === 'reject' && notes.trim().length < 5) {
      toast.error('Add a clear rejection reason for the seller.');
      return;
    }
    setSaving(true);
    try {
      for (const id of reviewing.ids) {
        const response = await fetch(`/api/admin/products/${id}/review`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ action: reviewing.action, notes }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Product review could not be saved.');
      }
      toast.success(
        reviewing.ids.length === 1
          ? `Product ${reviewing.action === 'approve' ? 'approved' : reviewing.action === 'reject' ? 'rejected' : 'paused'}.`
          : `${reviewing.ids.length} products updated.`
      );
      setReviewing(null);
      setNotes('');
      setSelected([]);
      await loadProducts();
    } catch (caughtError) {
      toast.error(caughtError instanceof Error ? caughtError.message : 'Product review could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const filters: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All products' },
    { key: 'pending', label: 'Pending review' },
    { key: 'active', label: 'Active' },
    { key: 'paused', label: 'Paused' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'out_of_stock', label: 'Out of stock' },
  ];

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Products</p>
          <h1 className="mt-1 text-2xl font-800 tracking-tight text-foreground">Marketplace product review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the seller&apos;s own fabric names, categories, units and custom attributes. Product URL is optional and only appears when supplied.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.length > 0 && (
            <>
              <button type="button" onClick={() => setReviewing({ ids: selected, action: 'approve' })} className="ft-primary-action inline-flex items-center gap-2 px-3 py-2 text-xs">
                <Icon name="CheckCircleIcon" size={15} /> Approve {selected.length}
              </button>
              <button type="button" onClick={() => setReviewing({ ids: selected, action: 'reject' })} className="inline-flex items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-3 py-2 text-xs font-800 text-error">
                <Icon name="XCircleIcon" size={15} /> Reject {selected.length}
              </button>
            </>
          )}
          <button type="button" onClick={() => void loadProducts()} className="ft-secondary-action inline-flex items-center gap-2 px-3 py-2 text-xs">
            <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                filtered.map((product) => ({
                  Product: product.name || '',
                  SKU: product.sku || '',
                  Seller: product.seller_name || '',
                  Category: product.category || '',
                  Fabric: product.fabric_name || '',
                  Quality: product.quality || '',
                  'Product Type': product.product_type || '',
                  Price: Number(product.price_per_unit || 0),
                  Unit: displayUnit(product),
                  Stock: Number(product.available_quantity || 0),
                  MOQ: Number(product.moq || 0),
                  Status: effectiveStatus(product),
                  URL: product.product_url || '',
                  GTIN: product.gtin || '',
                  HSN: product.hsn_code || '',
                  'GST Rate': Number(product.gst_rate || 0),
                })),
                'fabrictrad-products'
              )
            }
            className="ft-secondary-action inline-flex items-center gap-2 px-3 py-2 text-xs"
          >
            <Icon name="ArrowDownTrayIcon" size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
            <Icon name="MagnifyingGlassIcon" size={17} className="text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search product, custom fabric, quality, type, unit, seller, GTIN or HSN"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {filters.map((item) => (
              <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-800 transition ${filter === item.key ? 'bg-primary text-white' : 'border border-border bg-card text-muted-foreground hover:text-foreground'}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
          <span>{loading ? 'Loading products…' : `${filtered.length} of ${products.length} products`}</span>
          <span>Flexible seller catalogue</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] text-sm">
            <thead className="bg-muted/70 text-left text-xs font-800 text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input type="checkbox" aria-label="Select all visible products" checked={filtered.length > 0 && filtered.every((product) => selected.includes(product.id))} onChange={(event) => setSelected(event.target.checked ? filtered.map((product) => product.id) : [])} className="rounded border-border text-primary focus:ring-primary" />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Seller details</th>
                <th className="px-4 py-3 text-right">Price & availability</th>
                <th className="px-4 py-3">Identifiers</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-6 py-14 text-center text-sm text-muted-foreground">No products match this view.</td></tr>}
              {filtered.map((product) => {
                const status = effectiveStatus(product);
                const focused = focusId === product.id;
                const customEntries = Object.entries(product.custom_attributes || {}).slice(0, 4);
                return (
                  <tr id={`product-${product.id}`} key={product.id} className={focused ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/30'}>
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${product.name || 'product'}`} checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} className="rounded border-border text-primary focus:ring-primary" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                          {product.image_url ? <AppImage src={product.image_url} alt={product.name || 'Fabric product'} fill sizes="48px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center"><Icon name="PhotoIcon" size={18} className="text-muted-foreground" /></span>}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-72 truncate font-800 text-foreground">{product.name || 'Untitled product'}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{product.fabric_name || product.category || 'Custom product'}{product.quality ? ` · ${product.quality}` : ''}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{product.product_type || product.category || 'Other'} · {product.variant_count || 0} variants</p>
                          {customEntries.length > 0 && <p className="mt-1 max-w-80 truncate text-[11px] text-muted-foreground">{customEntries.map(([name, value]) => `${name}: ${value}`).join(' · ')}</p>}
                          {product.product_url && (
                            <a href={product.product_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-800 text-primary hover:underline">
                              Seller product URL <Icon name="ArrowTopRightOnSquareIcon" size={11} />
                            </a>
                          )}
                          <p className="mono-id mt-1">{product.sku || product.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-700 text-foreground">{product.seller_name}</p>
                      <p className="mono-id mt-1">{product.seller_id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-800 text-foreground">₹{Number(product.price_per_unit || 0).toLocaleString('en-IN')}/{displayUnit(product)}</p>
                      <p className={`mt-1 text-xs font-700 ${Number(product.available_quantity || 0) <= 0 ? 'text-error' : Number(product.available_quantity || 0) <= 10 ? 'text-warning' : 'text-muted-foreground'}`}>
                        {Number(product.available_quantity || 0).toLocaleString('en-IN')} {displayUnit(product)} available · MOQ {Number(product.moq || 0)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-700 text-foreground">GTIN: {product.gtin || 'Not added'}</p>
                      <p className="mt-1 text-xs capitalize text-muted-foreground">{product.gtin_status || 'unverified'} · HSN {product.hsn_code || '—'} · GST {Number(product.gst_rate || 0)}%</p>
                    </td>
                    <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-800 ${statusTone(status)}`}>{statusLabel(status)}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {!['active', 'approved'].includes(status) && <button type="button" onClick={() => setReviewing({ ids: [product.id], action: 'approve' })} className="rounded-lg border border-success/20 bg-success/10 px-2.5 py-1.5 text-xs font-800 text-success">Approve</button>}
                        {status !== 'rejected' && <button type="button" onClick={() => setReviewing({ ids: [product.id], action: 'reject' })} className="rounded-lg border border-error/20 bg-error/10 px-2.5 py-1.5 text-xs font-800 text-error">Reject</button>}
                        {['active', 'approved'].includes(status) && <button type="button" onClick={() => setReviewing({ ids: [product.id], action: 'pause' })} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-800 text-foreground">Pause</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {reviewing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Product review action">
          <button type="button" className="absolute inset-0" onClick={() => !saving && setReviewing(null)} aria-label="Close product review" />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-800 uppercase tracking-wider text-primary">Product review</p>
                <h2 className="mt-1 text-xl font-800 capitalize text-foreground">{reviewing.action} {reviewing.ids.length === 1 ? 'product' : `${reviewing.ids.length} products`}</h2>
              </div>
              <button type="button" onClick={() => setReviewing(null)} disabled={saving} className="ft-icon-button"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {reviewing.action === 'approve' ?'Approval does not require a product URL. If the seller supplied one, it is shown in the product row; otherwise no URL field is displayed.'
                : reviewing.action === 'reject' ?'The rejection reason is saved for the seller and the product remains unavailable to buyers.' :'Pausing removes the product from active marketplace results without deleting seller data.'}
            </p>
            <label className="mt-5 block text-sm font-700 text-foreground">
              {reviewing.action === 'reject' ? 'Reason for seller' : 'Administrator note (optional)'}
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={1000} placeholder={reviewing.action === 'reject' ? 'Explain what the seller must correct…' : 'Add an internal review note…'} className="mt-2 w-full rounded-xl border border-border bg-muted/40 px-3 py-3 text-sm text-foreground outline-none focus:border-primary/40" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReviewing(null)} disabled={saving} className="ft-secondary-action px-4 py-2.5 text-sm">Cancel</button>
              <button type="button" onClick={() => void saveReview()} disabled={saving} className={`px-4 py-2.5 text-sm font-800 text-white disabled:opacity-50 ${reviewing.action === 'reject' ? 'rounded-xl bg-error' : 'ft-primary-action'}`}>
                {saving ? 'Saving…' : `Confirm ${reviewing.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
