'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type SaleChannel = 'b2b' | 'retail' | 'both';

interface InventoryTemplate {
  id: string;
  name: string;
  category: string;
  gsm: number | null;
  moq: number;
  price_per_unit: number;
  unit_label: string;
  work_type: string;
  dispatch_days: number;
  sale_channel: SaleChannel;
  pricing_tiers: PricingTier[];
  created_at: string;
}

interface PricingTier {
  min_qty: number;
  max_qty: number | null;
  price: number;
  label: string;
}

interface SellerProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  gsm: number | null;
  moq: number;
  price_per_unit: number;
  status: string;
}

const LOCAL_KEY = 'fabrictrad:inventory-templates';

function readLocalTemplates(): InventoryTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalTemplates(templates: InventoryTemplate[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(templates));
}

const PRESET_TEMPLATES: Omit<InventoryTemplate, 'id' | 'created_at'>[] = [
  {
    name: 'Premium Cotton Shirting',
    category: 'Cotton',
    gsm: 120,
    moq: 50,
    price_per_unit: 450,
    unit_label: 'metre',
    work_type: 'Plain',
    dispatch_days: 3,
    sale_channel: 'both',
    pricing_tiers: [
      { min_qty: 50, max_qty: 199, price: 450, label: 'Standard' },
      { min_qty: 200, max_qty: 499, price: 420, label: 'Bulk' },
      { min_qty: 500, max_qty: null, price: 390, label: 'Wholesale' },
    ],
  },
  {
    name: 'Banarasi Silk Saree Fabric',
    category: 'Banarasi Silk',
    gsm: 200,
    moq: 20,
    price_per_unit: 1800,
    unit_label: 'metre',
    work_type: 'Zari Work',
    dispatch_days: 5,
    sale_channel: 'b2b',
    pricing_tiers: [
      { min_qty: 20, max_qty: 49, price: 1800, label: 'Standard' },
      { min_qty: 50, max_qty: 99, price: 1650, label: 'Bulk' },
      { min_qty: 100, max_qty: null, price: 1500, label: 'Wholesale' },
    ],
  },
  {
    name: 'Georgette Dress Material',
    category: 'Georgette',
    gsm: 80,
    moq: 30,
    price_per_unit: 320,
    unit_label: 'metre',
    work_type: 'Plain',
    dispatch_days: 2,
    sale_channel: 'both',
    pricing_tiers: [
      { min_qty: 30, max_qty: 99, price: 320, label: 'Standard' },
      { min_qty: 100, max_qty: 299, price: 295, label: 'Bulk' },
      { min_qty: 300, max_qty: null, price: 270, label: 'Wholesale' },
    ],
  },
  {
    name: 'Heavy Velvet Upholstery',
    category: 'Velvet',
    gsm: 350,
    moq: 25,
    price_per_unit: 950,
    unit_label: 'metre',
    work_type: 'Plain',
    dispatch_days: 4,
    sale_channel: 'b2b',
    pricing_tiers: [
      { min_qty: 25, max_qty: 74, price: 950, label: 'Standard' },
      { min_qty: 75, max_qty: 199, price: 880, label: 'Bulk' },
      { min_qty: 200, max_qty: null, price: 820, label: 'Wholesale' },
    ],
  },
  {
    name: 'Linen Suiting Fabric',
    category: 'Linen',
    gsm: 160,
    moq: 40,
    price_per_unit: 680,
    unit_label: 'metre',
    work_type: 'Plain',
    dispatch_days: 3,
    sale_channel: 'both',
    pricing_tiers: [
      { min_qty: 40, max_qty: 149, price: 680, label: 'Standard' },
      { min_qty: 150, max_qty: 399, price: 630, label: 'Bulk' },
      { min_qty: 400, max_qty: null, price: 580, label: 'Wholesale' },
    ],
  },
];

const blankTemplate: Omit<InventoryTemplate, 'id' | 'created_at'> = {
  name: '',
  category: 'Cotton',
  gsm: null,
  moq: 50,
  price_per_unit: 0,
  unit_label: 'metre',
  work_type: 'Plain',
  dispatch_days: 3,
  sale_channel: 'both',
  pricing_tiers: [
    { min_qty: 1, max_qty: null, price: 0, label: 'Standard' },
  ],
};

export default function SellerInventoryTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<InventoryTemplate[]>([]);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InventoryTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<InventoryTemplate | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState<Omit<InventoryTemplate, 'id' | 'created_at'>>(blankTemplate);
  const [productSearch, setProductSearch] = useState('');
  const [applyField, setApplyField] = useState<'gsm' | 'moq' | 'price' | 'all'>('all');

  useEffect(() => {
    const saved = readLocalTemplates();
    if (saved.length === 0) {
      const presets = PRESET_TEMPLATES.map((t, i) => ({
        ...t,
        id: `preset-${i}`,
        created_at: new Date().toISOString(),
      }));
      setTemplates(presets);
      writeLocalTemplates(presets);
    } else {
      setTemplates(saved);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (!user?.id) return;
    setLoadingProducts(true);
    const supabase = createClient();
    const { data: seller } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!seller?.id) { setLoadingProducts(false); return; }
    setSellerId(String(seller.id));
    const { data } = await supabase
      .from('seller_products')
      .select('id,name,sku,category,gsm,moq,price_per_unit,status')
      .eq('seller_id', seller.id)
      .neq('status', 'archived')
      .order('name');
    setProducts((data || []) as SellerProduct[]);
    setLoadingProducts(false);
  }, [user?.id]);

  const saveTemplate = () => {
    if (!form.name.trim()) return toast.error('Template name is required.');
    if (form.price_per_unit <= 0) return toast.error('Base price must be greater than zero.');
    if (form.moq < 1) return toast.error('MOQ must be at least 1.');

    let updated: InventoryTemplate[];
    if (editingTemplate) {
      updated = templates.map((t) =>
        t.id === editingTemplate.id ? { ...form, id: t.id, created_at: t.created_at } : t
      );
      toast.success('Template updated.');
    } else {
      const newTemplate: InventoryTemplate = {
        ...form,
        id: `tpl-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      updated = [newTemplate, ...templates];
      toast.success('Template saved.');
    }
    setTemplates(updated);
    writeLocalTemplates(updated);
    setModalOpen(false);
    setEditingTemplate(null);
    setForm(blankTemplate);
  };

  const deleteTemplate = (id: string) => {
    if (!window.confirm('Delete this template?')) return;
    let updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    writeLocalTemplates(updated);
    toast.success('Template deleted.');
  };

  const openBatchApply = async (template: InventoryTemplate) => {
    setSelectedTemplate(template);
    setSelectedProductIds([]);
    setProductSearch('');
    setApplyField('all');
    await loadProducts();
    setBatchModalOpen(true);
  };

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return !q || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q);
  });

  const applyTemplate = async () => {
    if (!selectedTemplate || !sellerId || selectedProductIds.length === 0) return;
    if (selectedProductIds.length < 2) {
      return toast.error('Select at least 2 products to use batch apply.');
    }
    setApplying(true);
    try {
      const supabase = createClient();
      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (applyField === 'all' || applyField === 'gsm') updatePayload.gsm = selectedTemplate.gsm;
      if (applyField === 'all' || applyField === 'moq') updatePayload.moq = selectedTemplate.moq;
      if (applyField === 'all' || applyField === 'price') updatePayload.price_per_unit = selectedTemplate.price_per_unit;
      if (applyField === 'all') {
        updatePayload.dispatch_days = selectedTemplate.dispatch_days;
        updatePayload.sale_channel = selectedTemplate.sale_channel;
        updatePayload.work_type = selectedTemplate.work_type;
      }

      const { error } = await supabase
        .from('seller_products')
        .update(updatePayload)
        .eq('seller_id', sellerId)
        .in('id', selectedProductIds);

      if (error) throw error;
      toast.success(`Template applied to ${selectedProductIds.length} products.`);
      setBatchModalOpen(false);
      setSelectedProductIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply template.');
    } finally {
      setApplying(false);
    }
  };

  const addTier = () => {
    const lastTier = form.pricing_tiers[form.pricing_tiers.length - 1];
    const newMin = lastTier ? (lastTier.max_qty ?? lastTier.min_qty + 100) + 1 : 1;
    setForm({
      ...form,
      pricing_tiers: [
        ...form.pricing_tiers,
        { min_qty: newMin, max_qty: null, price: form.price_per_unit * 0.9, label: 'Tier' },
      ],
    });
  };

  const updateTier = (index: number, field: keyof PricingTier, value: string | number | null) => {
    const tiers = [...form.pricing_tiers];
    tiers[index] = { ...tiers[index], [field]: value };
    setForm({ ...form, pricing_tiers: tiers });
  };

  const removeTier = (index: number) => {
    if (form.pricing_tiers.length <= 1) return;
    setForm({ ...form, pricing_tiers: form.pricing_tiers.filter((_, i) => i !== index) });
  };

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="ft-route-kicker">Inventory</p>
          <h1 className="mt-1 text-2xl font-800 tracking-tight text-foreground">Inventory Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create preset GSM / MOQ / pricing tiers and batch-apply them to 10+ similar fabrics at once.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingTemplate(null); setForm(blankTemplate); setModalOpen(true); }}
          className="ft-primary-action flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          <Icon name="PlusIcon" size={15} /> New template
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
        <strong className="text-foreground">How it works:</strong> Save a template with your standard GSM, MOQ, and tiered pricing. Then click <strong className="text-foreground">Batch apply</strong> to push those values to 10 or more similar products in one click — no CSV required.
      </div>

      {templates.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Icon name="DocumentDuplicateIcon" size={36} className="mx-auto text-muted-foreground" />
          <p className="mt-4 text-sm font-800 text-foreground">No templates yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create your first template to speed up bulk SKU management.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <div key={template.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-800 text-foreground">{template.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{template.category} · {template.work_type}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => { setEditingTemplate(template); setForm({ name: template.name, category: template.category, gsm: template.gsm, moq: template.moq, price_per_unit: template.price_per_unit, unit_label: template.unit_label, work_type: template.work_type, dispatch_days: template.dispatch_days, sale_channel: template.sale_channel, pricing_tiers: template.pricing_tiers }); setModalOpen(true); }}
                  className="ft-icon-button !min-h-8 !min-w-8"
                  aria-label="Edit template"
                >
                  <Icon name="PencilSquareIcon" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(template.id)}
                  className="ft-icon-button !min-h-8 !min-w-8 hover:!text-error"
                  aria-label="Delete template"
                >
                  <Icon name="TrashIcon" size={14} />
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center text-xs">
              <div>
                <p className="text-muted-foreground">GSM</p>
                <p className="mt-0.5 font-800 text-foreground">{template.gsm ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">MOQ</p>
                <p className="mt-0.5 font-800 text-foreground">{template.moq} {template.unit_label}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Base price</p>
                <p className="mt-0.5 font-800 text-primary">₹{template.price_per_unit.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {template.pricing_tiers.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-700 uppercase tracking-wider text-muted-foreground">Pricing tiers</p>
                <div className="space-y-1">
                  {template.pricing_tiers.map((tier, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5 text-xs">
                      <span className="text-muted-foreground">
                        {tier.min_qty}–{tier.max_qty ?? '∞'} {template.unit_label}
                      </span>
                      <span className="font-800 text-foreground">₹{tier.price.toLocaleString('en-IN')}/{template.unit_label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-750 ${template.sale_channel === 'both' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {template.sale_channel === 'both' ? 'B2B + retail' : template.sale_channel === 'b2b' ? 'B2B only' : 'Retail only'}
              </span>
              <button
                type="button"
                onClick={() => void openBatchApply(template)}
                className="ft-primary-action flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <Icon name="BoltIcon" size={13} /> Batch apply
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Template editor modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => setModalOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-800">{editingTemplate ? 'Edit template' : 'New inventory template'}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Set preset GSM, MOQ, and tiered pricing for bulk SKU management.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="ft-icon-button"><Icon name="XMarkIcon" size={18} /></button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="col-span-2 text-sm font-700">
                  Template name *
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" placeholder="e.g. Premium Cotton Shirting" />
                </label>
                <label className="text-sm font-700">
                  Category
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" />
                </label>
                <label className="text-sm font-700">
                  Work type
                  <input value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" />
                </label>
                <label className="text-sm font-700">
                  GSM <span className="font-500 text-muted-foreground">(optional)</span>
                  <input type="number" min="0" value={form.gsm ?? ''} onChange={(e) => setForm({ ...form, gsm: e.target.value ? Number(e.target.value) : null })} className="input-base mt-1.5 w-full px-3 py-2.5" placeholder="e.g. 120" />
                </label>
                <label className="text-sm font-700">
                  MOQ *
                  <input type="number" min="1" value={form.moq} onChange={(e) => setForm({ ...form, moq: Number(e.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" />
                </label>
                <label className="text-sm font-700">
                  Base price (₹) *
                  <input type="number" min="0.01" step="0.01" value={form.price_per_unit || ''} onChange={(e) => setForm({ ...form, price_per_unit: Number(e.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" />
                </label>
                <label className="text-sm font-700">
                  Unit
                  <input value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} className="input-base mt-1.5 w-full px-3 py-2.5" />
                </label>
                <label className="text-sm font-700">
                  Dispatch days
                  <input type="number" min="1" max="30" value={form.dispatch_days} onChange={(e) => setForm({ ...form, dispatch_days: Number(e.target.value) })} className="input-base mt-1.5 w-full px-3 py-2.5" />
                </label>
                <label className="text-sm font-700">
                  Sale channel
                  <select value={form.sale_channel} onChange={(e) => setForm({ ...form, sale_channel: e.target.value as SaleChannel })} className="input-base mt-1.5 w-full px-3 py-2.5">
                    <option value="both">Business + personal</option>
                    <option value="b2b">Business only</option>
                    <option value="retail">Personal only</option>
                  </select>
                </label>
              </div>

              {/* Pricing tiers */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-800">Pricing tiers</p>
                  <button type="button" onClick={addTier} className="ft-secondary-action flex items-center gap-1.5 px-3 py-1.5 text-xs">
                    <Icon name="PlusIcon" size={13} /> Add tier
                  </button>
                </div>
                <div className="space-y-2">
                  {form.pricing_tiers.map((tier, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border border-border bg-muted/30 p-3">
                      <label className="text-xs font-700">
                        Min qty
                        <input type="number" min="1" value={tier.min_qty} onChange={(e) => updateTier(i, 'min_qty', Number(e.target.value))} className="input-base mt-1 w-full px-2 py-1.5 text-xs" />
                      </label>
                      <label className="text-xs font-700">
                        Max qty
                        <input type="number" min="1" value={tier.max_qty ?? ''} onChange={(e) => updateTier(i, 'max_qty', e.target.value ? Number(e.target.value) : null)} className="input-base mt-1 w-full px-2 py-1.5 text-xs" placeholder="∞" />
                      </label>
                      <label className="text-xs font-700">
                        Price (₹)
                        <input type="number" min="0.01" step="0.01" value={tier.price || ''} onChange={(e) => updateTier(i, 'price', Number(e.target.value))} className="input-base mt-1 w-full px-2 py-1.5 text-xs" />
                      </label>
                      <div className="flex items-end pb-1">
                        <button type="button" onClick={() => removeTier(i)} disabled={form.pricing_tiers.length <= 1} className="ft-icon-button !min-h-8 !min-w-8 hover:!text-error disabled:opacity-30" aria-label="Remove tier">
                          <Icon name="TrashIcon" size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="ft-secondary-action px-5 py-2.5">Cancel</button>
                <button type="button" onClick={saveTemplate} className="ft-primary-action px-5 py-2.5">
                  {editingTemplate ? 'Update template' : 'Save template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch apply modal */}
      {batchModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={() => !applying && setBatchModalOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-800">Batch apply template</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Applying: <strong className="text-foreground">{selectedTemplate.name}</strong> — select 2+ products below.
                </p>
              </div>
              <button type="button" onClick={() => setBatchModalOpen(false)} className="ft-icon-button"><Icon name="XMarkIcon" size={18} /></button>
            </div>

            {/* What to apply */}
            <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-800 text-foreground">Apply fields</p>
              <div className="flex flex-wrap gap-2">
                {(['all', 'gsm', 'moq', 'price'] as const).map((field) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setApplyField(field)}
                    className={`rounded-full px-3 py-1.5 text-xs font-750 transition ${applyField === field ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {field === 'all' ? 'All fields' : field.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {applyField === 'all' || applyField === 'gsm' ? <div className="rounded-lg bg-primary/10 p-2 text-center"><p className="text-muted-foreground">GSM</p><p className="font-800 text-primary">{selectedTemplate.gsm ?? '—'}</p></div> : null}
                {applyField === 'all' || applyField === 'moq' ? <div className="rounded-lg bg-primary/10 p-2 text-center"><p className="text-muted-foreground">MOQ</p><p className="font-800 text-primary">{selectedTemplate.moq}</p></div> : null}
                {applyField === 'all' || applyField === 'price' ? <div className="rounded-lg bg-primary/10 p-2 text-center"><p className="text-muted-foreground">Price</p><p className="font-800 text-primary">₹{selectedTemplate.price_per_unit.toLocaleString('en-IN')}</p></div> : null}
              </div>
            </div>

            {/* Product search */}
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Icon name="MagnifyingGlassIcon" size={15} className="text-muted-foreground" />
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name, SKU or category…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{selectedProductIds.length} of {filteredProducts.length} selected</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelectedProductIds(filteredProducts.map((p) => p.id))} className="font-750 text-primary hover:underline">Select all</button>
                <button type="button" onClick={() => setSelectedProductIds([])} className="font-750 text-muted-foreground hover:underline">Clear</button>
              </div>
            </div>

            {loadingProducts ? (
              <div className="py-8 text-center"><span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                {filteredProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>
                ) : (
                  filteredProducts.map((product) => {
                    const checked = selectedProductIds.includes(product.id);
                    return (
                      <label key={product.id} className={`flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-0 transition hover:bg-muted/30 ${checked ? 'bg-primary/5' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setSelectedProductIds((prev) => e.target.checked ? [...prev, product.id] : prev.filter((id) => id !== product.id))}
                          className="h-4 w-4 accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-700 text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku} · {product.category} · GSM {product.gsm ?? '—'} · MOQ {product.moq}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-750 ${product.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{product.status}</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}

            {selectedProductIds.length > 0 && selectedProductIds.length < 2 && (
              <p className="mt-2 text-xs text-warning">Select at least 2 products to use batch apply.</p>
            )}

            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setBatchModalOpen(false)} className="ft-secondary-action px-5 py-2.5">Cancel</button>
              <button
                type="button"
                onClick={() => void applyTemplate()}
                disabled={applying || selectedProductIds.length < 2}
                className="ft-primary-action flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
              >
                {applying ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Applying…</> : <><Icon name="BoltIcon" size={15} /> Apply to {selectedProductIds.length} products</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
