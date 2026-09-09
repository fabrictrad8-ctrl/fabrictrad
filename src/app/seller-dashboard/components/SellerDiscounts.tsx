'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type Campaign = {
  id: string;
  name: string;
  campaign_type: string;
  target_product_key: string | null;
  code: string | null;
  discount_percent: number;
  min_order_value: number;
  max_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  start_date: string;
  end_date: string;
  funded_by: string;
  status: string;
  displayStatus: string;
};

type ProductOption = { id: string; name: string; sku: string | null };

const statusConfig: Record<string, string> = {
  active: 'bg-success/10 text-success',
  scheduled: 'bg-blue-50 text-blue-600',
  expired: 'bg-muted text-muted-foreground',
  paused: 'bg-amber-50 text-warning',
};

const campaignTypeLabels: Record<string, string> = {
  'Seller-specific': 'My whole shop',
  'Product-specific': 'One product',
  'Coupon Code': 'Coupon code',
};

const campaignTypes = ['Seller-specific', 'Product-specific', 'Coupon Code'];

const emptyForm = {
  name: '',
  campaignType: '',
  targetProductKey: '',
  productLabel: '',
  code: '',
  discountPercent: '',
  minOrderValue: '',
  maxDiscount: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
};

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function SellerDiscounts() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
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
      const response = await fetch('/api/seller/discounts', { credentials: 'same-origin' });
      const result = (await response.json().catch(() => ({}))) as { campaigns?: Campaign[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Campaigns could not be loaded.');
      setCampaigns(result.campaigns || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Campaigns could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Searches only this seller's own catalog - my_seller_id() resolves server-side
  // from the signed-in session, so there's no client-supplied seller id to spoof.
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
        const { data: sellerId } = await supabase.rpc('my_seller_id');
        if (controller.signal.aborted || !sellerId) return;
        const term = `%${normalized}%`;
        const { data: rows, error } = await supabase
          .from('seller_products')
          .select('id,name,sku')
          .eq('seller_id', sellerId)
          .or(`name.ilike.${term},sku.ilike.${term}`)
          .limit(20);
        if (controller.signal.aborted) return;
        setProductResults(error || !rows ? [] : rows.map((row) => ({ id: row.id, name: row.name || 'Untitled product', sku: row.sku })));
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

  const openEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      campaignType: campaign.campaign_type,
      targetProductKey: campaign.target_product_key || '',
      productLabel: '',
      code: campaign.code || '',
      discountPercent: String(campaign.discount_percent),
      minOrderValue: String(campaign.min_order_value),
      maxDiscount: campaign.max_discount === null ? '' : String(campaign.max_discount),
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      usageLimit: campaign.usage_limit === null ? '' : String(campaign.usage_limit),
    });
    setShowCreate(true);
  };

  const selectProduct = (product: ProductOption) => {
    setForm((f) => ({ ...f, targetProductKey: product.id, productLabel: `${product.name}${product.sku ? ` (${product.sku})` : ''}` }));
    setProductQuery('');
    setProductResults([]);
    setProductDropdownOpen(false);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.campaignType || !form.discountPercent || !form.startDate || !form.endDate) {
      toast.error('Name, type, discount % and both dates are required.');
      return;
    }
    if (!editingId && form.campaignType === 'Product-specific' && !form.targetProductKey) {
      toast.error('Choose which of your products this campaign applies to.');
      return;
    }
    if (!editingId && form.campaignType === 'Coupon Code' && !form.code.trim()) {
      toast.error('Enter the code buyers will type in at checkout.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        campaignType: form.campaignType,
        targetProductKey: form.targetProductKey || null,
        code: form.code || null,
        discountPercent: Number(form.discountPercent),
        minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : 0,
        maxDiscount: form.maxDiscount || null,
        usageLimit: form.usageLimit || null,
        startDate: form.startDate,
        endDate: form.endDate,
      };
      const response = editingId
        ? await fetch(`/api/seller/discounts/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'edit', ...payload }),
          })
        : await fetch('/api/seller/discounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Campaign could not be saved.');
      toast.success(editingId ? 'Campaign updated.' : 'Campaign created.');
      setShowCreate(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Campaign could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (campaign: Campaign) => {
    setBusyId(campaign.id);
    try {
      const nextAction = campaign.displayStatus === 'paused' ? 'activate' : 'pause';
      const response = await fetch(`/api/seller/discounts/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: nextAction }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Campaign could not be updated.');
      toast.success(nextAction === 'pause' ? 'Campaign paused.' : 'Campaign activated.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Campaign could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (campaign: Campaign) => {
    if (!window.confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;
    setDeletingId(campaign.id);
    try {
      const response = await fetch(`/api/seller/discounts/${campaign.id}`, { method: 'DELETE', credentials: 'same-origin' });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Campaign could not be deleted.');
      toast.success('Campaign deleted.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Campaign could not be deleted.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">My Discounts & Coupons</h1>
          <p className="mt-1 text-xs text-muted-foreground">Run your own campaigns across your whole shop or a single product. These are funded by you and only ever discount your own listings — FabricTrad-wide campaigns are managed separately by FabricTrad.</p>
        </div>
        <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm rounded-xl flex items-center gap-2">
          <Icon name="PlusIcon" size={16} />
          Create Campaign
        </button>
      </div>

      {showCreate && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-6 animate-fade-in">
          <h2 className="font-800 text-foreground mb-4">{editingId ? 'Edit campaign' : 'New Campaign'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Campaign Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Diwali Shop Sale" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Applies To *</label>
              <select value={form.campaignType} onChange={(e) => setForm((f) => ({ ...f, campaignType: e.target.value }))} className="input-base w-full px-3 py-2 text-sm rounded-xl" disabled={!!editingId}>
                <option value="">Select</option>
                {campaignTypes.map((t) => <option key={t} value={t}>{campaignTypeLabels[t]}</option>)}
              </select>
            </div>
            {form.campaignType === 'Product-specific' && (
              <div className="relative">
                <label className="block text-xs font-700 text-foreground mb-1.5">Which product? *</label>
                {editingId ? (
                  <input type="text" value={form.productLabel || 'Cannot change the product on an existing campaign'} disabled className="input-base w-full px-3 py-2 text-sm rounded-xl opacity-70" />
                ) : (
                  <>
                    <input
                      type="text"
                      value={form.targetProductKey ? form.productLabel : productQuery}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, targetProductKey: '', productLabel: '' }));
                        setProductQuery(e.target.value);
                        setProductDropdownOpen(true);
                      }}
                      onFocus={() => setProductDropdownOpen(true)}
                      placeholder="Search your products by name or SKU"
                      className="input-base w-full px-3 py-2 text-sm rounded-xl"
                    />
                    {productDropdownOpen && (productQuery.trim().length >= 2 || productSearching) && (
                      <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
                        {productSearching && <div className="px-3 py-3 text-xs text-muted-foreground">Searching…</div>}
                        {!productSearching && productResults.length === 0 && (
                          <div className="px-3 py-3 text-xs text-muted-foreground">No matching products in your shop.</div>
                        )}
                        {!productSearching &&
                          productResults.map((product) => (
                            <button key={product.id} type="button" onClick={() => selectProduct(product)} className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted">
                              <span className="font-700 text-foreground">{product.name}</span>
                              {product.sku && <span className="text-xs text-muted-foreground">{product.sku}</span>}
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {form.campaignType === 'Coupon Code' && (
              <div>
                <label className="block text-xs font-700 text-foreground mb-1.5">Code buyers type in *</label>
                <input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. MYSHOP10" maxLength={32} className="input-base w-full px-3 py-2 text-sm rounded-xl uppercase" disabled={!!editingId} />
                <p className="mt-1 text-[11px] text-muted-foreground">3-32 characters. Applies to orders placed with your shop only — not case-sensitive at checkout.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Discount % *</label>
              <input type="number" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} placeholder="e.g. 10" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Min Order Value (₹)</label>
              <input type="number" value={form.minOrderValue} onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))} placeholder="0" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Max Discount (₹)</label>
              <input type="number" value={form.maxDiscount} onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))} placeholder="Optional cap" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Total Usage Limit</label>
              <input type="number" value={form.usageLimit} onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))} placeholder="Optional" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Start Date *</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">End Date *</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setShowCreate(false); setEditingId(null); setProductDropdownOpen(false); }} disabled={saving} className="btn-secondary px-4 py-2 text-sm rounded-xl">Cancel</button>
            <button onClick={() => void submit()} disabled={saving} className="btn-primary px-5 py-2 text-sm rounded-xl disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create Campaign'}</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading && <div className="py-12 text-center"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
        {!loading && campaigns.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-muted-foreground">
            <Icon name="TicketIcon" size={28} className="mx-auto mb-3 opacity-40" />
            <p className="font-700 text-foreground">No campaigns yet</p>
            <p className="mt-1 text-sm">Create your first discount or coupon code to see it here.</p>
          </div>
        )}
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="mono-id">{campaign.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`text-xs font-700 px-2.5 py-0.5 rounded-full ${statusConfig[campaign.displayStatus] || statusConfig.expired}`}>
                    {campaign.displayStatus.charAt(0).toUpperCase() + campaign.displayStatus.slice(1)}
                  </span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{campaignTypeLabels[campaign.campaign_type] || campaign.campaign_type}</span>
                  {campaign.code && <span className="mono-id">{campaign.code}</span>}
                </div>
                <p className="text-base font-800 text-foreground mb-1">{campaign.name}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Discount: <span className="font-700 text-primary">{campaign.discount_percent}%</span></span>
                  <span>Min Order: <span className="font-700">{money(campaign.min_order_value)}</span></span>
                  <span>{campaign.start_date} → {campaign.end_date}</span>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-2">
                <p className="text-xs text-muted-foreground">{campaign.usage_count}{campaign.usage_limit ? `/${campaign.usage_limit}` : ''} uses</p>
                <div className="flex gap-1.5">
                  <button onClick={() => void toggleStatus(campaign)} disabled={busyId === campaign.id || campaign.displayStatus === 'expired'} className={`text-xs px-2.5 py-1 rounded-lg font-600 border disabled:opacity-50 ${campaign.displayStatus === 'paused' ? 'bg-success/10 text-success border-success/20' : 'bg-amber-50 text-warning border-amber-200'}`}>
                    {campaign.displayStatus === 'paused' ? 'Activate' : 'Pause'}
                  </button>
                  <button onClick={() => openEdit(campaign)} className="bg-muted border border-border text-xs px-2.5 py-1 rounded-lg font-600 text-foreground">Edit</button>
                  <button onClick={() => void remove(campaign)} disabled={deletingId === campaign.id} className="bg-error/10 border border-error/20 text-xs px-2.5 py-1 rounded-lg font-600 text-error disabled:opacity-50">
                    {deletingId === campaign.id ? 'Deleting…' : 'Delete'}
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
