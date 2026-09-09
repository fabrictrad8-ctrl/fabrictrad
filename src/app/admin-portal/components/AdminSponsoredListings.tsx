'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type Placement = {
  id: string;
  product_id: string;
  seller_id: string;
  start_date: string;
  end_date: string;
  status: string;
  funded_by: string;
  daily_rate: number | null;
  notes: string | null;
  displayStatus: string;
  product_name: string;
  product_sku: string | null;
  seller_name: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  seller_id: string;
  seller_name: string;
};

const statusConfig: Record<string, string> = {
  active: 'bg-success/10 text-success',
  scheduled: 'bg-blue-50 text-blue-600',
  expired: 'bg-muted text-muted-foreground',
  paused: 'bg-amber-50 text-warning',
};

const fundedByOptions = ['Seller', 'FabricTrad', 'Shared 50/50', 'Custom Split'];

const emptyForm = {
  productId: '',
  productLabel: '',
  startDate: '',
  endDate: '',
  fundedBy: 'Seller',
  dailyRate: '',
  notes: '',
};

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function AdminSponsoredListings() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/sponsored', { credentials: 'same-origin' });
      const result = (await response.json().catch(() => ({}))) as { placements?: Placement[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Sponsored placements could not be loaded.');
      setPlacements(result.placements || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sponsored placements could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Lightweight product picker, modeled on how AdminListings resolves seller names for
  // seller_products rows — searched client-side against live, approved products only.
  useEffect(() => {
    const normalized = productQuery.trim();
    if (!productDropdownOpen || normalized.length < 2) {
      setProductResults([]);
      setProductSearching(false);
      return;
    }
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    const timer = window.setTimeout(async () => {
      setProductSearching(true);
      try {
        const supabase = createClient();
        const term = `%${normalized}%`;
        const { data: rows, error } = await supabase
          .from('seller_products')
          .select('id,seller_id,name,sku')
          .eq('status', 'active')
          .eq('approval_status', 'approved')
          .or(`name.ilike.${term},sku.ilike.${term}`)
          .limit(20);
        if (controller.signal.aborted) return;
        if (error || !rows) {
          setProductResults([]);
          return;
        }
        const sellerIds = [...new Set(rows.map((row) => row.seller_id).filter(Boolean))];
        const sellerNames = new Map<string, string>();
        if (sellerIds.length) {
          const { data: sellers } = await supabase
            .from('seller_profiles')
            .select('id,display_name,legal_business_name')
            .in('id', sellerIds);
          (sellers || []).forEach((seller) => {
            sellerNames.set(seller.id, seller.display_name || seller.legal_business_name || 'FabricTrad seller');
          });
        }
        if (controller.signal.aborted) return;
        setProductResults(
          rows.map((row) => ({
            id: row.id,
            name: row.name || 'Untitled product',
            sku: row.sku,
            seller_id: row.seller_id,
            seller_name: sellerNames.get(row.seller_id) || 'FabricTrad seller',
          }))
        );
      } finally {
        if (!controller.signal.aborted) setProductSearching(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [productQuery, productDropdownOpen]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setProductQuery('');
    setProductResults([]);
    setShowCreate(true);
  };

  const openEdit = (placement: Placement) => {
    setEditingId(placement.id);
    setForm({
      productId: placement.product_id,
      productLabel: `${placement.product_name}${placement.product_sku ? ` (${placement.product_sku})` : ''} — ${placement.seller_name}`,
      startDate: placement.start_date,
      endDate: placement.end_date,
      fundedBy: placement.funded_by,
      dailyRate: placement.daily_rate === null ? '' : String(placement.daily_rate),
      notes: placement.notes || '',
    });
    setShowCreate(true);
  };

  const selectProduct = (product: ProductOption) => {
    setForm((f) => ({ ...f, productId: product.id, productLabel: `${product.name}${product.sku ? ` (${product.sku})` : ''} — ${product.seller_name}` }));
    setProductQuery('');
    setProductResults([]);
    setProductDropdownOpen(false);
  };

  const submit = async () => {
    if (!editingId && !form.productId) {
      toast.error('Choose a product to sponsor.');
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error('Start and end dates are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        productId: form.productId,
        startDate: form.startDate,
        endDate: form.endDate,
        fundedBy: form.fundedBy,
        dailyRate: form.dailyRate === '' ? null : Number(form.dailyRate),
        notes: form.notes.trim() || null,
      };
      const response = editingId
        ? await fetch(`/api/admin/sponsored/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'edit', ...payload }),
          })
        : await fetch('/api/admin/sponsored', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Placement could not be saved.');
      toast.success(editingId ? 'Placement updated.' : 'Placement created.');
      setShowCreate(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Placement could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (placement: Placement) => {
    setBusyId(placement.id);
    try {
      const nextAction = placement.displayStatus === 'paused' ? 'activate' : 'pause';
      const response = await fetch(`/api/admin/sponsored/${placement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: nextAction }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Placement could not be updated.');
      toast.success(nextAction === 'pause' ? 'Placement paused.' : 'Placement activated.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Placement could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (placement: Placement) => {
    if (!window.confirm(`Delete the sponsored placement for "${placement.product_name}"? This cannot be undone.`)) return;
    setDeletingId(placement.id);
    try {
      const response = await fetch(`/api/admin/sponsored/${placement.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Placement could not be deleted.');
      toast.success('Placement deleted.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Placement could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Sponsored Listings</h1>
          <p className="mt-1 text-xs text-muted-foreground">Paid placement for products in the marketplace grid. Funding here is bookkeeping only — FabricTrad does not automatically charge sellers; record how payment was actually collected in the notes.</p>
        </div>
        <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2">
          <Icon name="PlusIcon" size={16} />
          New Placement
        </button>
      </div>

      {showCreate && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-6 animate-fade-in">
          <h2 className="font-800 text-foreground mb-4">{editingId ? 'Edit placement' : 'New Sponsored Placement'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-3 relative">
              <label className="block text-xs font-700 text-foreground mb-1.5">Product *</label>
              {editingId ? (
                <input type="text" value={form.productLabel} disabled className="input-base w-full px-3 py-2 text-sm rounded-xl opacity-70" />
              ) : (
                <>
                  <input
                    type="text"
                    value={form.productId ? form.productLabel : productQuery}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, productId: '', productLabel: '' }));
                      setProductQuery(e.target.value);
                      setProductDropdownOpen(true);
                    }}
                    onFocus={() => setProductDropdownOpen(true)}
                    placeholder="Search by product name or SKU"
                    className="input-base w-full px-3 py-2 text-sm rounded-xl"
                  />
                  {productDropdownOpen && (productQuery.trim().length >= 2 || productSearching) && (
                    <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
                      {productSearching && <div className="px-3 py-3 text-xs text-muted-foreground">Searching…</div>}
                      {!productSearching && productResults.length === 0 && (
                        <div className="px-3 py-3 text-xs text-muted-foreground">No live, approved products match.</div>
                      )}
                      {!productSearching &&
                        productResults.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => selectProduct(product)}
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <span className="font-700 text-foreground">{product.name}</span>
                            <span className="text-xs text-muted-foreground">{product.sku ? `${product.sku} · ` : ''}{product.seller_name}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Start Date *</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">End Date *</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Funded By</label>
              <select value={form.fundedBy} onChange={(e) => setForm((f) => ({ ...f, fundedBy: e.target.value }))} className="input-base w-full px-3 py-2 text-sm rounded-xl">
                {fundedByOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Daily Rate (₹)</label>
              <input type="number" value={form.dailyRate} onChange={(e) => setForm((f) => ({ ...f, dailyRate: e.target.value }))} placeholder="e.g. 500" min="0" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-700 text-foreground mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Seller paid ₹500/day via bank transfer, ref #123"
                maxLength={500}
                rows={2}
                className="input-base w-full px-3 py-2 text-sm rounded-xl"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">For admin bookkeeping only — this is not charged automatically. Record how payment was actually collected, if any.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setShowCreate(false); setEditingId(null); setProductDropdownOpen(false); }} disabled={saving} className="btn-secondary px-4 py-2 text-sm rounded-xl">Cancel</button>
            <button onClick={() => void submit()} disabled={saving} className="btn-primary px-5 py-2 text-sm rounded-xl disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create Placement'}</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading && <div className="py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
        {!loading && placements.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-muted-foreground">
            <Icon name="MegaphoneIcon" size={28} className="mx-auto mb-3 opacity-40" />
            <p className="font-700 text-foreground">No sponsored placements yet</p>
            <p className="mt-1 text-sm">Create your first paid placement to see it here.</p>
          </div>
        )}
        {placements.map((placement) => (
          <div key={placement.id} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="mono-id">{placement.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`text-xs font-700 px-2.5 py-0.5 rounded-full ${statusConfig[placement.displayStatus] || statusConfig.expired}`}>
                    {placement.displayStatus.charAt(0).toUpperCase() + placement.displayStatus.slice(1)}
                  </span>
                  {placement.product_sku && <span className="mono-id">{placement.product_sku}</span>}
                </div>
                <p className="text-base font-800 text-foreground mb-1">{placement.product_name}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Seller: <span className="font-700 text-foreground">{placement.seller_name}</span></span>
                  <span>Funded by: <span className="font-700">{placement.funded_by}</span></span>
                  {placement.daily_rate !== null && <span>Rate: <span className="font-700 text-primary">{money(placement.daily_rate)}/day</span></span>}
                  <span>{placement.start_date} → {placement.end_date}</span>
                </div>
                {placement.notes && <p className="mt-2 text-xs text-muted-foreground italic">&ldquo;{placement.notes}&rdquo;</p>}
              </div>
              <div className="flex flex-col sm:items-end gap-2">
                <div className="flex gap-1.5">
                  <button onClick={() => void toggleStatus(placement)} disabled={busyId === placement.id || placement.displayStatus === 'expired'} className={`text-xs px-2.5 py-1 rounded-lg font-600 border disabled:opacity-50 ${placement.displayStatus === 'paused' ? 'bg-success/10 text-success border-success/20' : 'bg-amber-50 text-warning border-amber-200'}`}>
                    {placement.displayStatus === 'paused' ? 'Activate' : 'Pause'}
                  </button>
                  <button onClick={() => openEdit(placement)} className="bg-muted border border-border text-xs px-2.5 py-1 rounded-lg font-600 text-foreground">Edit</button>
                  <button onClick={() => void remove(placement)} disabled={deletingId === placement.id} className="bg-error/10 border border-error/20 text-xs px-2.5 py-1 rounded-lg font-600 text-error disabled:opacity-50">
                    {deletingId === placement.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
