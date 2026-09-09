'use client';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';

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

const statusConfig: Record<string, string> = {
  active: 'bg-success/10 text-success',
  scheduled: 'bg-blue-50 text-blue-600',
  expired: 'bg-muted text-muted-foreground',
  paused: 'bg-amber-50 text-warning',
};

const campaignTypes = [
  'Website-wide',
  'Product-specific',
  'Category',
  'Seller-specific',
  'Buyer-specific',
  'First-order',
  'Flash Sale',
  'Coupon Code',
  'Festival Offer',
  'Free Shipping',
];

const emptyForm = {
  name: '',
  campaignType: '',
  targetProductKey: '',
  code: '',
  discountPercent: '',
  minOrderValue: '',
  maxDiscount: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
  fundedBy: 'FabricTrad',
};

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function AdminDiscounts() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/discounts', { credentials: 'same-origin' });
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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowCreate(true);
  };

  const openEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      campaignType: campaign.campaign_type,
      targetProductKey: campaign.target_product_key || '',
      code: campaign.code || '',
      discountPercent: String(campaign.discount_percent),
      minOrderValue: String(campaign.min_order_value),
      maxDiscount: campaign.max_discount === null ? '' : String(campaign.max_discount),
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      usageLimit: campaign.usage_limit === null ? '' : String(campaign.usage_limit),
      fundedBy: campaign.funded_by,
    });
    setShowCreate(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.campaignType || !form.discountPercent || !form.startDate || !form.endDate) {
      toast.error('Name, type, discount % and both dates are required.');
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
        fundedBy: form.fundedBy,
      };
      const response = editingId
        ? await fetch(`/api/admin/discounts/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'edit', ...payload }),
          })
        : await fetch('/api/admin/discounts', {
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
      const response = await fetch(`/api/admin/discounts/${campaign.id}`, {
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Discount & Promotions</h1>
          <p className="mt-1 text-xs text-muted-foreground">Eligible campaigns apply automatically at checkout, or via the code buyers enter for Coupon Code campaigns. Free Shipping campaigns don&apos;t auto-apply yet — there&apos;s no separate shipping charge to waive.</p>
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
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Monsoon Sale 2026" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Campaign Type *</label>
              <select value={form.campaignType} onChange={(e) => setForm((f) => ({ ...f, campaignType: e.target.value }))} className="input-base w-full px-3 py-2 text-sm rounded-xl" disabled={!!editingId}>
                <option value="">Select type</option>
                {campaignTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.campaignType === 'Product-specific' && (
              <div>
                <label className="block text-xs font-700 text-foreground mb-1.5">Target product id *</label>
                <input type="text" value={form.targetProductKey} onChange={(e) => setForm((f) => ({ ...f, targetProductKey: e.target.value }))} placeholder="seller_products.id" className="input-base w-full px-3 py-2 text-sm rounded-xl" disabled={!!editingId} />
              </div>
            )}
            {form.campaignType === 'Category' && (
              <div>
                <label className="block text-xs font-700 text-foreground mb-1.5">Target category *</label>
                <input type="text" value={form.targetProductKey} onChange={(e) => setForm((f) => ({ ...f, targetProductKey: e.target.value }))} placeholder="e.g. Silk, Cotton Fabric" className="input-base w-full px-3 py-2 text-sm rounded-xl" disabled={!!editingId} />
                <p className="mt-1 text-[11px] text-muted-foreground">Must match a seller_products.category value exactly.</p>
              </div>
            )}
            {form.campaignType === 'Seller-specific' && (
              <div>
                <label className="block text-xs font-700 text-foreground mb-1.5">Target seller id *</label>
                <input type="text" value={form.targetProductKey} onChange={(e) => setForm((f) => ({ ...f, targetProductKey: e.target.value }))} placeholder="seller_profiles.id" className="input-base w-full px-3 py-2 text-sm rounded-xl" disabled={!!editingId} />
              </div>
            )}
            {form.campaignType === 'Buyer-specific' && (
              <div>
                <label className="block text-xs font-700 text-foreground mb-1.5">Target buyer email *</label>
                <input type="email" value={form.targetProductKey} onChange={(e) => setForm((f) => ({ ...f, targetProductKey: e.target.value }))} placeholder="buyer@example.com" className="input-base w-full px-3 py-2 text-sm rounded-xl" disabled={!!editingId} />
                <p className="mt-1 text-[11px] text-muted-foreground">Must match the email on an existing FabricTrad account.</p>
              </div>
            )}
            {form.campaignType === 'Coupon Code' && (
              <div>
                <label className="block text-xs font-700 text-foreground mb-1.5">Code buyers type in *</label>
                <input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. FESTIVE10" maxLength={32} className="input-base w-full px-3 py-2 text-sm rounded-xl uppercase" disabled={!!editingId} />
                <p className="mt-1 text-[11px] text-muted-foreground">3-32 characters: letters, numbers, hyphens or underscores. Not case-sensitive at checkout.</p>
              </div>
            )}
            {form.campaignType === 'Free Shipping' && (
              <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                FabricTrad does not currently charge buyers a separate shipping fee at checkout, so there is nothing for this campaign type to waive — it will not auto-apply at checkout until a real shipping charge exists to discount.
              </div>
            )}
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Discount % *</label>
              <input type="number" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} placeholder="e.g. 10" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Min Order Value (₹)</label>
              <input type="number" value={form.minOrderValue} onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))} placeholder="50000" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Max Discount (₹)</label>
              <input type="number" value={form.maxDiscount} onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))} placeholder="5000" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
            </div>
            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">Total Usage Limit</label>
              <input type="number" value={form.usageLimit} onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))} placeholder="500" className="input-base w-full px-3 py-2 text-sm rounded-xl" />
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
              <select value={form.fundedBy} onChange={(e) => setForm((f) => ({ ...f, fundedBy: e.target.value }))} className="input-base w-full px-3 py-2 text-sm rounded-xl" disabled={!!editingId}>
                <option>FabricTrad</option>
                <option>Seller</option>
                <option>Shared 50/50</option>
                <option>Custom Split</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setShowCreate(false); setEditingId(null); }} disabled={saving} className="btn-secondary px-4 py-2 text-sm rounded-xl">Cancel</button>
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
            <p className="mt-1 text-sm">Create your first discount campaign to see it here.</p>
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
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{campaign.campaign_type}</span>
                  {campaign.code && <span className="mono-id">{campaign.code}</span>}
                </div>
                <p className="text-base font-800 text-foreground mb-1">{campaign.name}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Discount: <span className="font-700 text-primary">{campaign.discount_percent}%</span></span>
                  <span>Min Order: <span className="font-700">{money(campaign.min_order_value)}</span></span>
                  <span>Funded by: <span className="font-700">{campaign.funded_by}</span></span>
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
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
