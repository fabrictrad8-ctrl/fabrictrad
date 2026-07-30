'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type Catalog = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  scope: 'all_buyers' | 'company';
  company_id: string | null;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  price_per_unit: number;
  unit: string;
  moq: number;
  available_quantity: number;
  status: string;
};

type PriceBreak = { minimum_quantity: number; price: number };

type CatalogRule = {
  id: string;
  catalog_id: string;
  product_id: string;
  variant_id: string | null;
  price_override: number | null;
  minimum_quantity: number;
  maximum_quantity: number | null;
  quantity_increment: number;
  price_breaks: PriceBreak[];
};

const parsePriceBreaks = (value: string): PriceBreak[] => {
  if (!value.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [quantity, price] = item.split(':').map((part) => Number(part.trim()));
      if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price <= 0) {
        throw new Error('Use price breaks in the format 50:780, 100:740.');
      }
      return { minimum_quantity: quantity, price };
    })
    .sort((a, b) => a.minimum_quantity - b.minimum_quantity);
};

const formatPriceBreaks = (breaks: PriceBreak[]) =>
  breaks.map((item) => `${item.minimum_quantity}:${item.price}`).join(', ');

export default function SellerCatalogPricing() {
  const { user, isDemoAccount } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rules, setRules] = useState<CatalogRule[]>([]);
  const [activeCatalogId, setActiveCatalogId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ name: '', description: '' });
  const [ruleForm, setRuleForm] = useState({
    product_id: '',
    price_override: '',
    minimum_quantity: '1',
    maximum_quantity: '',
    quantity_increment: '1',
    price_breaks: '',
  });

  const activeCatalog = catalogs.find((catalog) => catalog.id === activeCatalogId) || null;

  const loadWorkspace = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    if (isDemoAccount) {
      setSellerId('demo-seller');
      const demoProducts: Product[] = [
        { id: 'demo-product-1', name: 'Pure Dyeable Soft Net', sku: 'STM-NET-001', price_per_unit: 840, unit: 'mtr', moq: 50, available_quantity: 2400, status: 'active' },
        { id: 'demo-product-2', name: 'Organza Sequence Fabric', sku: 'STM-ORG-001', price_per_unit: 980, unit: 'mtr', moq: 20, available_quantity: 45, status: 'active' },
      ];
      const demoCatalog: Catalog = { id: 'demo-catalog', seller_id: 'demo-seller', name: 'Wholesale 2026', description: 'Standard wholesale pricing for verified buyers.', status: 'active', scope: 'all_buyers', company_id: null, currency: 'INR', starts_at: null, ends_at: null };
      setProducts(demoProducts);
      setCatalogs([demoCatalog]);
      setActiveCatalogId(demoCatalog.id);
      setRules([
        { id: 'demo-rule', catalog_id: demoCatalog.id, product_id: demoProducts[0].id, variant_id: null, price_override: 820, minimum_quantity: 50, maximum_quantity: null, quantity_increment: 10, price_breaks: [{ minimum_quantity: 100, price: 790 }, { minimum_quantity: 250, price: 760 }] },
      ]);
      setLoading(false);
      return;
    }

    const { data: seller, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !seller?.id) {
      toast.error(sellerError?.message || 'Seller profile is not available.');
      setLoading(false);
      return;
    }
    setSellerId(seller.id);

    const [{ data: productData, error: productError }, { data: catalogData, error: catalogError }] = await Promise.all([
      supabase.from('seller_products').select('id,name,sku,price_per_unit,unit,moq,available_quantity,status').eq('seller_id', seller.id).neq('status', 'archived').order('name'),
      supabase.from('seller_catalogs').select('*').eq('seller_id', seller.id).order('updated_at', { ascending: false }),
    ]);
    if (productError) toast.error(productError.message);
    if (catalogError) toast.error(catalogError.message);
    setProducts((productData || []) as Product[]);
    const nextCatalogs = (catalogData || []) as Catalog[];
    setCatalogs(nextCatalogs);
    const nextActive = activeCatalogId && nextCatalogs.some((catalog) => catalog.id === activeCatalogId)
      ? activeCatalogId
      : nextCatalogs[0]?.id || '';
    setActiveCatalogId(nextActive);

    if (nextActive) {
      const { data: ruleData, error: ruleError } = await supabase
        .from('seller_catalog_rules')
        .select('*')
        .eq('catalog_id', nextActive)
        .order('created_at');
      if (ruleError) toast.error(ruleError.message);
      setRules((ruleData || []) as CatalogRule[]);
    } else {
      setRules([]);
    }
    setLoading(false);
  }, [activeCatalogId, isDemoAccount, supabase, user?.id]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!activeCatalogId || isDemoAccount) return;
    let mounted = true;
    supabase
      .from('seller_catalog_rules')
      .select('*')
      .eq('catalog_id', activeCatalogId)
      .order('created_at')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) toast.error(error.message);
        setRules((data || []) as CatalogRule[]);
      });
    return () => { mounted = false; };
  }, [activeCatalogId, isDemoAccount, supabase]);

  const createCatalog = async () => {
    if (!sellerId || !catalogForm.name.trim()) return toast.error('Enter a catalog name.');
    try {
      if (isDemoAccount) {
        const next: Catalog = { id: `demo-catalog-${Date.now()}`, seller_id: sellerId, name: catalogForm.name.trim(), description: catalogForm.description.trim() || null, status: 'draft', scope: 'all_buyers', company_id: null, currency: 'INR', starts_at: null, ends_at: null };
        setCatalogs((current) => [next, ...current]);
        setActiveCatalogId(next.id);
        setRules([]);
      } else {
        const { data, error } = await supabase
          .from('seller_catalogs')
          .insert({ seller_id: sellerId, name: catalogForm.name.trim(), description: catalogForm.description.trim() || null, status: 'draft', scope: 'all_buyers', currency: 'INR' })
          .select('*')
          .single();
        if (error) throw error;
        setActiveCatalogId(data.id);
        await loadWorkspace();
      }
      setCatalogForm({ name: '', description: '' });
      setShowCatalogForm(false);
      toast.success('Pricing catalog created as a draft.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the catalog.');
    }
  };

  const updateCatalogStatus = async (status: Catalog['status']) => {
    if (!activeCatalog) return;
    try {
      if (isDemoAccount) {
        setCatalogs((current) => current.map((catalog) => catalog.id === activeCatalog.id ? { ...catalog, status } : catalog));
      } else {
        const { error } = await supabase.from('seller_catalogs').update({ status, updated_at: new Date().toISOString() }).eq('id', activeCatalog.id).eq('seller_id', sellerId);
        if (error) throw error;
        await loadWorkspace();
      }
      toast.success(status === 'active' ? 'Catalog published to eligible buyers.' : `Catalog moved to ${status}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the catalog.');
    }
  };

  const saveRule = async () => {
    if (!activeCatalog || !ruleForm.product_id) return toast.error('Choose a product.');
    const minimum = Number(ruleForm.minimum_quantity);
    const maximum = ruleForm.maximum_quantity ? Number(ruleForm.maximum_quantity) : null;
    const increment = Number(ruleForm.quantity_increment);
    const override = ruleForm.price_override ? Number(ruleForm.price_override) : null;
    if (!Number.isFinite(minimum) || minimum <= 0 || !Number.isFinite(increment) || increment <= 0) return toast.error('Minimum and increment must be greater than zero.');
    if (maximum !== null && maximum < minimum) return toast.error('Maximum quantity cannot be below the minimum.');
    if (override !== null && override <= 0) return toast.error('Catalog price must be greater than zero.');

    let priceBreaks: PriceBreak[];
    try {
      priceBreaks = parsePriceBreaks(ruleForm.price_breaks);
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : 'Invalid price breaks.');
    }

    setSaving(true);
    try {
      const payload = {
        catalog_id: activeCatalog.id,
        product_id: ruleForm.product_id,
        variant_id: null,
        price_override: override,
        minimum_quantity: minimum,
        maximum_quantity: maximum,
        quantity_increment: increment,
        price_breaks: priceBreaks,
        updated_at: new Date().toISOString(),
      };
      if (isDemoAccount) {
        setRules((current) => {
          const existing = current.find((rule) => rule.product_id === ruleForm.product_id && !rule.variant_id);
          if (existing) return current.map((rule) => rule.id === existing.id ? { ...rule, ...payload } : rule);
          return [...current, { id: `demo-rule-${Date.now()}`, ...payload } as CatalogRule];
        });
      } else {
        const { data: existing } = await supabase
          .from('seller_catalog_rules')
          .select('id')
          .eq('catalog_id', activeCatalog.id)
          .eq('product_id', ruleForm.product_id)
          .is('variant_id', null)
          .maybeSingle();
        const result = existing?.id
          ? await supabase.from('seller_catalog_rules').update(payload).eq('id', existing.id)
          : await supabase.from('seller_catalog_rules').insert(payload);
        if (result.error) throw result.error;
        const { data } = await supabase.from('seller_catalog_rules').select('*').eq('catalog_id', activeCatalog.id).order('created_at');
        setRules((data || []) as CatalogRule[]);
      }
      setRuleForm({ product_id: '', price_override: '', minimum_quantity: '1', maximum_quantity: '', quantity_increment: '1', price_breaks: '' });
      toast.success('Catalog pricing rule saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the pricing rule.');
    } finally {
      setSaving(false);
    }
  };

  const editRule = (rule: CatalogRule) => {
    setRuleForm({
      product_id: rule.product_id,
      price_override: rule.price_override ? String(rule.price_override) : '',
      minimum_quantity: String(rule.minimum_quantity),
      maximum_quantity: rule.maximum_quantity ? String(rule.maximum_quantity) : '',
      quantity_increment: String(rule.quantity_increment),
      price_breaks: formatPriceBreaks(Array.isArray(rule.price_breaks) ? rule.price_breaks : []),
    });
    document.getElementById('catalog-rule-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const deleteRule = async (rule: CatalogRule) => {
    if (!window.confirm('Remove this product from the pricing catalog?')) return;
    try {
      if (isDemoAccount) setRules((current) => current.filter((item) => item.id !== rule.id));
      else {
        const { error } = await supabase.from('seller_catalog_rules').delete().eq('id', rule.id);
        if (error) throw error;
        setRules((current) => current.filter((item) => item.id !== rule.id));
      }
      toast.success('Pricing rule removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the rule.');
    }
  };

  if (loading) return <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />;

  const rulesWithProducts = rules.map((rule) => ({ rule, product: products.find((product) => product.id === rule.product_id) }));

  return (
    <div className="space-y-6">
      <div className="ft-page-header mb-0">
        <div>
          <p className="ft-route-kicker">Wholesale merchandising</p>
          <h1 className="ft-page-title mt-1">Catalogs and pricing</h1>
          <p className="ft-page-subtitle">Publish buyer-facing catalogs with minimums, increments, negotiated prices and volume breaks.</p>
        </div>
        <button type="button" onClick={() => setShowCatalogForm(true)} className="btn-primary rounded-xl px-4 py-2.5 text-sm"><Icon name="PlusIcon" size={15} /> New catalog</button>
      </div>

      {showCatalogForm && <section className="ft-section p-5"><div className="grid gap-4 md:grid-cols-[1fr_1.5fr_auto] md:items-end"><label className="text-sm font-700">Catalog name<input value={catalogForm.name} onChange={(event) => setCatalogForm({ ...catalogForm, name: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" placeholder="Wholesale 2026" /></label><label className="text-sm font-700">Description<input value={catalogForm.description} onChange={(event) => setCatalogForm({ ...catalogForm, description: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" placeholder="Standard prices for verified buyers" /></label><div className="flex gap-2"><button type="button" onClick={createCatalog} className="btn-primary rounded-xl px-4 py-2.5 text-sm">Create draft</button><button type="button" onClick={() => setShowCatalogForm(false)} className="btn-secondary rounded-xl px-4 py-2.5 text-sm">Cancel</button></div></div></section>}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="ft-section h-fit overflow-hidden xl:sticky xl:top-20">
          <div className="border-b border-border p-4"><p className="text-sm font-800">Pricing catalogs</p><p className="mt-1 text-xs text-muted-foreground">Draft, publish or archive catalog sets.</p></div>
          <div className="space-y-1 p-2">{catalogs.length ? catalogs.map((catalog) => <button key={catalog.id} type="button" onClick={() => setActiveCatalogId(catalog.id)} className={`w-full rounded-xl border p-3 text-left transition ${catalog.id === activeCatalogId ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-muted/50'}`}><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-800">{catalog.name}</p><span className={`ft-badge ${catalog.status === 'active' ? 'ft-badge--success' : catalog.status === 'draft' ? 'ft-badge--warning' : ''}`}>{catalog.status}</span></div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{catalog.description || 'No description'}</p></button>) : <div className="ft-empty-state min-h-48"><div><Icon name="TagIcon" size={28} className="mx-auto text-primary" /><p className="mt-2 text-sm font-800">No catalogs yet</p><p className="mt-1 text-xs text-muted-foreground">Create a draft and add product rules.</p></div></div>}</div>
        </aside>

        <div className="space-y-6">
          {activeCatalog ? <>
            <section className="ft-section p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-800">{activeCatalog.name}</h2><span className={`ft-badge ${activeCatalog.status === 'active' ? 'ft-badge--success' : 'ft-badge--warning'}`}>{activeCatalog.status}</span></div><p className="mt-2 text-sm text-muted-foreground">{activeCatalog.description || 'Add products and pricing rules, then publish the catalog.'}</p></div><div className="flex flex-wrap gap-2">{activeCatalog.status !== 'active' && <button type="button" onClick={() => void updateCatalogStatus('active')} className="btn-primary rounded-xl px-3 py-2 text-xs"><Icon name="GlobeAltIcon" size={14} /> Publish</button>}{activeCatalog.status === 'active' && <button type="button" onClick={() => void updateCatalogStatus('draft')} className="btn-secondary rounded-xl px-3 py-2 text-xs">Move to draft</button>}<button type="button" onClick={() => void updateCatalogStatus('archived')} className="btn-secondary rounded-xl px-3 py-2 text-xs">Archive</button></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[['Products', rules.length, 'ArchiveBoxIcon'],['Buyer scope', activeCatalog.scope === 'all_buyers' ? 'All verified buyers' : 'Assigned company', 'UsersIcon'],['Currency', activeCatalog.currency, 'BanknotesIcon']].map(([label,value,icon]) => <div key={String(label)} className="rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon name={String(icon)} size={15} className="text-primary" /></div><p className="mt-2 text-sm font-800">{value}</p></div>)}</div></section>

            <section id="catalog-rule-form" className="ft-section p-5 sm:p-6"><div className="mb-5"><h2 className="font-800">Product pricing rule</h2><p className="mt-1 text-xs text-muted-foreground">Set a catalog price, quantity minimum/maximum, ordering increment and optional volume prices.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><label className="text-sm font-700 xl:col-span-2">Product<select value={ruleForm.product_id} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); setRuleForm({ ...ruleForm, product_id: event.target.value, price_override: product ? String(product.price_per_unit) : '', minimum_quantity: product ? String(product.moq) : '1' }); }} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5"><option value="">Select a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku} · ₹{Number(product.price_per_unit).toLocaleString('en-IN')}/{product.unit}</option>)}</select></label><label className="text-sm font-700">Catalog price<input type="number" min="0.01" step="0.01" value={ruleForm.price_override} onChange={(event) => setRuleForm({ ...ruleForm, price_override: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700">Minimum quantity<input type="number" min="0.01" step="0.5" value={ruleForm.minimum_quantity} onChange={(event) => setRuleForm({ ...ruleForm, minimum_quantity: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700">Maximum quantity<input type="number" min="0.01" step="0.5" value={ruleForm.maximum_quantity} onChange={(event) => setRuleForm({ ...ruleForm, maximum_quantity: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" placeholder="No maximum" /></label><label className="text-sm font-700">Quantity increment<input type="number" min="0.01" step="0.5" value={ruleForm.quantity_increment} onChange={(event) => setRuleForm({ ...ruleForm, quantity_increment: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label><label className="text-sm font-700 md:col-span-2 xl:col-span-3">Volume price breaks<input value={ruleForm.price_breaks} onChange={(event) => setRuleForm({ ...ruleForm, price_breaks: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" placeholder="50:780, 100:740, 250:700" /><span className="mt-1 block text-xs font-400 text-muted-foreground">Format: quantity:price. Buyers automatically receive the best eligible price.</span></label></div><button type="button" onClick={saveRule} disabled={saving} className="btn-primary mt-5 rounded-xl px-5 py-2.5 text-sm">{saving ? 'Saving…' : 'Save pricing rule'}</button></section>

            <section className="ft-section overflow-hidden"><div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-800">Catalog products</h2><p className="text-xs text-muted-foreground">Pricing and quantity rules visible to eligible buyers.</p></div><span className="ft-badge">{rules.length} rules</span></div><div className="ft-table-wrap"><table><thead><tr><th>Product</th><th>Catalog price</th><th>Quantity rule</th><th>Volume breaks</th><th></th></tr></thead><tbody>{rulesWithProducts.length ? rulesWithProducts.map(({ rule, product }) => <tr key={rule.id}><td><p className="text-sm font-800">{product?.name || 'Product'}</p><p className="font-mono text-xs text-muted-foreground">{product?.sku}</p></td><td><p className="font-800 text-primary">₹{Number(rule.price_override || product?.price_per_unit || 0).toLocaleString('en-IN')}/{product?.unit || 'unit'}</p>{rule.price_override && product && Number(rule.price_override) < Number(product.price_per_unit) && <p className="text-xs text-success">{Math.round((1 - Number(rule.price_override) / Number(product.price_per_unit)) * 100)}% below standard</p>}</td><td><p className="text-xs font-700">Min {Number(rule.minimum_quantity).toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">Increment {Number(rule.quantity_increment).toLocaleString('en-IN')}{rule.maximum_quantity ? ` · Max ${Number(rule.maximum_quantity).toLocaleString('en-IN')}` : ''}</p></td><td><div className="flex flex-wrap gap-1">{Array.isArray(rule.price_breaks) && rule.price_breaks.length ? rule.price_breaks.map((item) => <span key={`${item.minimum_quantity}-${item.price}`} className="ft-orange-chip">{item.minimum_quantity}+ · ₹{item.price}</span>) : <span className="text-xs text-muted-foreground">No breaks</span>}</div></td><td><div className="flex justify-end gap-1"><button type="button" onClick={() => editRule(rule)} className="ft-icon-button" aria-label="Edit pricing rule"><Icon name="PencilSquareIcon" size={15} /></button><button type="button" onClick={() => void deleteRule(rule)} className="ft-icon-button" aria-label="Delete pricing rule"><Icon name="TrashIcon" size={15} /></button></div></td></tr>) : <tr><td colSpan={5}><div className="ft-empty-state"><div><Icon name="ArchiveBoxIcon" size={28} className="mx-auto text-primary" /><p className="mt-2 text-sm font-800">No products in this catalog</p><p className="mt-1 text-xs text-muted-foreground">Use the form above to add the first pricing rule.</p></div></div></td></tr>}</tbody></table></div></section>
          </> : <section className="ft-section ft-empty-state min-h-[420px]"><div><Icon name="TagIcon" size={34} className="mx-auto text-primary" /><h2 className="mt-3 text-lg font-800">Create a pricing catalog</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Group products, set minimums and increments, add volume price breaks, then publish the catalog to buyers.</p><button type="button" onClick={() => setShowCatalogForm(true)} className="btn-primary mt-5 rounded-xl px-5 py-2.5 text-sm">Create catalog</button></div></section>}
        </div>
      </div>
    </div>
  );
}