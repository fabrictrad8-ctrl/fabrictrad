'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const PAYMENT_TERMS = [
  ['due_on_order', 'Due on order'],
  ['due_on_fulfillment', 'Due on fulfilment'],
  ['net_7', 'Net 7'],
  ['net_15', 'Net 15'],
  ['net_30', 'Net 30'],
  ['net_45', 'Net 45'],
  ['net_60', 'Net 60'],
  ['net_90', 'Net 90'],
] as const;

type Company = {
  id: string;
  owner_user_id: string;
  company_name: string;
  gstin: string | null;
  status: 'active' | 'pending' | 'suspended';
  purchase_order_required: boolean;
  order_review_required: boolean;
  default_payment_terms: string;
  default_deposit_percent: number;
};

type CompanyLocation = {
  id: string;
  company_id: string;
  location_name: string;
  gstin: string | null;
  shipping_address: Record<string, string>;
  billing_address: Record<string, string>;
  payment_terms: string;
  deposit_percent: number | null;
  order_review_required: boolean | null;
  is_default: boolean;
};

type CompanyContact = {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: 'company_admin' | 'ordering' | 'viewer';
  can_place_orders: boolean;
  can_view_all_orders: boolean;
  invite_status: 'pending' | 'active' | 'revoked';
};

type RecentOrder = {
  id: string;
  seller_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit: string;
  price_per_unit: number;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  purchase_order_number: string | null;
};

const emptyLocation = {
  location_name: '',
  gstin: '',
  line1: '',
  city: '',
  state: '',
  pincode: '',
};

export default function BuyerCompanyPurchasing() {
  const { user, profile, isDemoAccount } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [locationForm, setLocationForm] = useState(emptyLocation);
  const [contactForm, setContactForm] = useState({ full_name: '', email: '', role: 'ordering' as CompanyContact['role'] });
  const [companyForm, setCompanyForm] = useState({
    company_name: profile?.business_name || '',
    gstin: profile?.gstin || '',
    purchase_order_required: false,
    order_review_required: false,
    default_payment_terms: 'due_on_order',
    default_deposit_percent: 0,
  });

  const loadWorkspace = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    if (isDemoAccount) {
      const demoCompany: Company = {
        id: 'demo-company',
        owner_user_id: user.id,
        company_name: profile?.business_name || 'Demo Buyer Textiles',
        gstin: profile?.gstin || '24ABCDE1234F1Z5',
        status: 'active',
        purchase_order_required: true,
        order_review_required: true,
        default_payment_terms: 'net_30',
        default_deposit_percent: 20,
      };
      setCompany(demoCompany);
      setCompanyForm({
        company_name: demoCompany.company_name,
        gstin: demoCompany.gstin || '',
        purchase_order_required: demoCompany.purchase_order_required,
        order_review_required: demoCompany.order_review_required,
        default_payment_terms: demoCompany.default_payment_terms,
        default_deposit_percent: demoCompany.default_deposit_percent,
      });
      setLocations([
        {
          id: 'demo-location',
          company_id: demoCompany.id,
          location_name: 'Mumbai Head Office',
          gstin: demoCompany.gstin,
          shipping_address: { line1: 'Demo Sourcing Office', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
          billing_address: { line1: 'Demo Sourcing Office', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
          payment_terms: 'inherit',
          deposit_percent: null,
          order_review_required: null,
          is_default: true,
        },
      ]);
      setContacts([
        {
          id: 'demo-contact',
          company_id: demoCompany.id,
          email: user.email,
          full_name: profile?.full_name || 'Demo Buyer',
          role: 'company_admin',
          can_place_orders: true,
          can_view_all_orders: true,
          invite_status: 'active',
        },
      ]);
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: companyData, error: companyError } = await supabase
      .from('b2b_company_accounts')
      .select('*')
      .eq('owner_user_id', user.id)
      .maybeSingle();

    if (companyError) {
      toast.error(companyError.message);
      setLoading(false);
      return;
    }

    const resolvedCompany = companyData as Company | null;
    setCompany(resolvedCompany);
    if (resolvedCompany) {
      setCompanyForm({
        company_name: resolvedCompany.company_name,
        gstin: resolvedCompany.gstin || '',
        purchase_order_required: resolvedCompany.purchase_order_required,
        order_review_required: resolvedCompany.order_review_required,
        default_payment_terms: resolvedCompany.default_payment_terms,
        default_deposit_percent: Number(resolvedCompany.default_deposit_percent || 0),
      });

      const [{ data: locData }, { data: contData }] = await Promise.all([
        supabase.from('b2b_company_locations').select('*').eq('company_id', resolvedCompany.id).order('is_default', { ascending: false }),
        supabase.from('b2b_company_contacts').select('*').eq('company_id', resolvedCompany.id).order('created_at', { ascending: true }),
      ]);
      setLocations((locData || []) as CompanyLocation[]);
      setContacts((contData || []) as CompanyContact[]);
    } else {
      setLocations([]);
      setContacts([]);
    }

    const { data: orderData } = await supabase
      .from('catalog_order_requests')
      .select('id,seller_id,product_id,variant_id,quantity,unit,price_per_unit,subtotal,gst_amount,total_amount,status,created_at,purchase_order_number')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);
    setOrders((orderData || []) as RecentOrder[]);
    setLoading(false);
  }, [isDemoAccount, profile?.business_name, profile?.full_name, profile?.gstin, supabase, user]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const saveCompany = async () => {
    if (!user?.id || !companyForm.company_name.trim()) return toast.error('Enter the company name.');
    if (companyForm.default_deposit_percent < 0 || companyForm.default_deposit_percent > 100) return toast.error('Deposit must be between 0 and 100%.');
    setSaving(true);
    try {
      if (isDemoAccount) {
        setCompany((current) => ({
          id: current?.id || 'demo-company',
          owner_user_id: user.id,
          status: 'active',
          ...companyForm,
          gstin: companyForm.gstin || null,
        }));
      } else {
        const { data, error } = await supabase
          .from('b2b_company_accounts')
          .upsert(
            {
              owner_user_id: user.id,
              company_name: companyForm.company_name.trim(),
              gstin: companyForm.gstin.trim() || null,
              purchase_order_required: companyForm.purchase_order_required,
              order_review_required: companyForm.order_review_required,
              default_payment_terms: companyForm.default_payment_terms,
              default_deposit_percent: companyForm.default_deposit_percent,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'owner_user_id' }
          )
          .select('*')
          .single();
        if (error) throw error;
        setCompany(data as Company);
      }
      toast.success('Company purchasing settings saved.');
      await loadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save company settings.');
    } finally {
      setSaving(false);
    }
  };

  const addLocation = async () => {
    if (!company) return toast.error('Save the company profile first.');
    if (!locationForm.location_name.trim() || !locationForm.line1.trim() || !locationForm.city.trim() || !locationForm.state.trim() || !/^\d{6}$/.test(locationForm.pincode)) {
      return toast.error('Enter the location name and a complete address with a valid PIN code.');
    }
    const address = { line1: locationForm.line1.trim(), city: locationForm.city.trim(), state: locationForm.state.trim(), pincode: locationForm.pincode };
    try {
      if (isDemoAccount) {
        setLocations((current) => [
          ...current,
          {
            id: `demo-location-${Date.now()}`,
            company_id: company.id,
            location_name: locationForm.location_name.trim(),
            gstin: locationForm.gstin.trim() || null,
            shipping_address: address,
            billing_address: address,
            payment_terms: 'inherit',
            deposit_percent: null,
            order_review_required: null,
            is_default: current.length === 0,
          },
        ]);
      } else {
        const { error } = await supabase.from('b2b_company_locations').insert({
          company_id: company.id,
          location_name: locationForm.location_name.trim(),
          gstin: locationForm.gstin.trim() || null,
          shipping_address: address,
          billing_address: address,
          payment_terms: 'inherit',
          is_default: locations.length === 0,
        });
        if (error) throw error;
        await loadWorkspace();
      }
      setLocationForm(emptyLocation);
      setShowLocationForm(false);
      toast.success('Company location added.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the location.');
    }
  };

  const setDefaultLocation = async (locationId: string) => {
    if (!company) return;
    try {
      if (isDemoAccount) {
        setLocations((current) => current.map((location) => ({ ...location, is_default: location.id === locationId })));
      } else {
        await supabase.from('b2b_company_locations').update({ is_default: false }).eq('company_id', company.id);
        const { error } = await supabase.from('b2b_company_locations').update({ is_default: true }).eq('id', locationId).eq('company_id', company.id);
        if (error) throw error;
        await loadWorkspace();
      }
      toast.success('Default purchasing location updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the location.');
    }
  };

  const addContact = async () => {
    if (!company) return toast.error('Save the company profile first.');
    if (!contactForm.full_name.trim() || !/^\S+@\S+\.\S+$/.test(contactForm.email.trim())) return toast.error('Enter a contact name and valid email.');
    try {
      const permissions = {
        company_admin: { can_place_orders: true, can_view_all_orders: true },
        ordering: { can_place_orders: true, can_view_all_orders: false },
        viewer: { can_place_orders: false, can_view_all_orders: true },
      }[contactForm.role];
      if (isDemoAccount) {
        setContacts((current) => [
          ...current,
          {
            id: `demo-contact-${Date.now()}`,
            company_id: company.id,
            full_name: contactForm.full_name.trim(),
            email: contactForm.email.trim().toLowerCase(),
            role: contactForm.role,
            ...permissions,
            invite_status: 'pending',
          },
        ]);
      } else {
        const { error } = await supabase.from('b2b_company_contacts').insert({
          company_id: company.id,
          full_name: contactForm.full_name.trim(),
          email: contactForm.email.trim().toLowerCase(),
          role: contactForm.role,
          ...permissions,
        });
        if (error) throw error;
        await loadWorkspace();
      }
      setContactForm({ full_name: '', email: '', role: 'ordering' });
      setShowContactForm(false);
      toast.success('Company contact added.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the contact.');
    }
  };

  const reorder = async (order: RecentOrder) => {
    if (!user?.id) return;
    if (isDemoAccount) return toast.success('Demo reorder prepared. Live checkout remains disabled.');
    try {
      const location = locations.find((item) => item.is_default) || locations[0];
      const terms = location?.payment_terms && location.payment_terms !== 'inherit' ? location.payment_terms : company?.default_payment_terms || 'due_on_order';
      const deposit = location?.deposit_percent ?? company?.default_deposit_percent ?? 0;
      const needsReview = location?.order_review_required ?? company?.order_review_required ?? false;
      const { error } = await supabase.from('catalog_order_requests').insert({
        buyer_id: user.id,
        seller_id: order.seller_id,
        product_id: order.product_id,
        variant_id: order.variant_id,
        quantity: order.quantity,
        unit: order.unit,
        price_per_unit: order.price_per_unit,
        subtotal: order.subtotal,
        gst_amount: order.gst_amount,
        total_amount: order.total_amount,
        status: 'pending',
        notes: `Quick reorder from request ${order.id.slice(0, 8).toUpperCase()}`,
        company_id: company?.id || null,
        company_location_id: location?.id || null,
        purchase_order_number: company?.purchase_order_required ? `PO-${Date.now().toString().slice(-8)}` : null,
        payment_terms: terms,
        deposit_percent: deposit,
        requires_review: needsReview,
        review_status: needsReview ? 'pending' : 'not_required',
      });
      if (error) throw error;
      toast.success('Reorder request sent to the seller.');
      await loadWorkspace();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the reorder.');
    }
  };

  if (loading) return <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />;

  return (
    <div className="space-y-6">
      <div className="ft-page-header mb-0">
        <div>
          <p className="ft-route-kicker">B2B purchasing</p>
          <h1 className="ft-page-title mt-1">Company purchasing</h1>
          <p className="ft-page-subtitle">Manage purchasing locations, PO controls, payment terms, approvers and repeat orders from one account.</p>
        </div>
        <span className="ft-orange-chip"><Icon name="ShieldCheckIcon" size={14} /> Persistent company controls</span>
      </div>

      <div className="ft-kpi-grid">
        {[
          ['Company status', company?.status || 'Not configured', 'BuildingOffice2Icon'],
          ['Locations', locations.length, 'MapPinIcon'],
          ['Purchasing contacts', contacts.length, 'UsersIcon'],
          ['Payment terms', PAYMENT_TERMS.find(([value]) => value === companyForm.default_payment_terms)?.[1] || 'Due on order', 'CalendarDaysIcon'],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="ft-kpi">
            <div className="flex items-center justify-between gap-3"><p className="ft-kpi-label">{label}</p><Icon name={String(icon)} size={16} className="text-primary" /></div>
            <p className="ft-kpi-value text-base">{value}</p>
          </div>
        ))}
      </div>

      <section className="ft-section p-5 sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><h2 className="text-lg font-800 text-foreground">Company policy</h2><p className="mt-1 text-sm text-muted-foreground">These defaults flow into new catalogue order requests.</p></div>
          <button type="button" onClick={saveCompany} disabled={saving} className="btn-primary rounded-xl px-4 py-2.5 text-sm">{saving ? 'Saving…' : 'Save company settings'}</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-700">Company name<input value={companyForm.company_name} onChange={(event) => setCompanyForm({ ...companyForm, company_name: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label>
          <label className="text-sm font-700">GSTIN<input value={companyForm.gstin} onChange={(event) => setCompanyForm({ ...companyForm, gstin: event.target.value.toUpperCase() })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 uppercase" /></label>
          <label className="text-sm font-700">Default payment terms<select value={companyForm.default_payment_terms} onChange={(event) => setCompanyForm({ ...companyForm, default_payment_terms: event.target.value })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5">{PAYMENT_TERMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-700">Deposit required (%)<input type="number" min="0" max="100" value={companyForm.default_deposit_percent} onChange={(event) => setCompanyForm({ ...companyForm, default_deposit_percent: Number(event.target.value) })} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5" /></label>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => setCompanyForm({ ...companyForm, purchase_order_required: !companyForm.purchase_order_required })} className={`ft-policy-toggle ${companyForm.purchase_order_required ? 'is-active' : ''}`} aria-pressed={companyForm.purchase_order_required}><span><strong>Require PO number</strong><small>Every order request must contain an internal purchase order reference.</small></span><span className="ft-switch"><i /></span></button>
          <button type="button" onClick={() => setCompanyForm({ ...companyForm, order_review_required: !companyForm.order_review_required })} className={`ft-policy-toggle ${companyForm.order_review_required ? 'is-active' : ''}`} aria-pressed={companyForm.order_review_required}><span><strong>Submit orders for review</strong><small>Requests are marked for approval before payment and fulfilment.</small></span><span className="ft-switch"><i /></span></button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="ft-section p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-800">Company locations</h2><p className="text-xs text-muted-foreground">Separate ship-to, billing and tax settings.</p></div><button type="button" onClick={() => setShowLocationForm((value) => !value)} className="btn-secondary rounded-xl px-3 py-2 text-xs"><Icon name="PlusIcon" size={14} /> Add</button></div>
          {showLocationForm && <div className="mb-4 grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-2">{[
            ['location_name','Location name'],['gstin','GSTIN'],['line1','Address line'],['city','City'],['state','State'],['pincode','PIN code'],
          ].map(([key,label]) => <label key={key} className="text-xs font-700">{label}<input value={locationForm[key as keyof typeof locationForm]} onChange={(event) => setLocationForm({ ...locationForm, [key]: event.target.value })} className="input-base mt-1 w-full rounded-lg px-3 py-2" /></label>)}<div className="flex gap-2 sm:col-span-2"><button type="button" onClick={addLocation} className="btn-primary rounded-lg px-3 py-2 text-xs">Save location</button><button type="button" onClick={() => setShowLocationForm(false)} className="btn-secondary rounded-lg px-3 py-2 text-xs">Cancel</button></div></div>}
          <div className="space-y-3">{locations.length ? locations.map((location) => <article key={location.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-sm font-800">{location.location_name}</p>{location.is_default && <span className="ft-orange-chip">Default</span>}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{[location.shipping_address.line1, location.shipping_address.city, location.shipping_address.state, location.shipping_address.pincode].filter(Boolean).join(', ')}</p>{location.gstin && <p className="mt-1 text-xs text-muted-foreground">GSTIN {location.gstin}</p>}</div>{!location.is_default && <button type="button" onClick={() => void setDefaultLocation(location.id)} className="text-xs font-800 text-primary">Make default</button>}</div></article>) : <div className="ft-empty-state min-h-40"><div><Icon name="MapPinIcon" size={28} className="mx-auto text-primary" /><p className="mt-2 text-sm font-800">No company locations yet</p><p className="mt-1 text-xs text-muted-foreground">Add the addresses your purchasing team orders for.</p></div></div>}</div>
        </section>

        <section className="ft-section p-5">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-800">Purchasing contacts</h2><p className="text-xs text-muted-foreground">Company admins, orderers and read-only viewers.</p></div><button type="button" onClick={() => setShowContactForm((value) => !value)} className="btn-secondary rounded-xl px-3 py-2 text-xs"><Icon name="UserPlusIcon" size={14} /> Add</button></div>
          {showContactForm && <div className="mb-4 grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><label className="text-xs font-700">Full name<input value={contactForm.full_name} onChange={(event) => setContactForm({ ...contactForm, full_name: event.target.value })} className="input-base mt-1 w-full rounded-lg px-3 py-2" /></label><label className="text-xs font-700">Email<input type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} className="input-base mt-1 w-full rounded-lg px-3 py-2" /></label><label className="text-xs font-700">Permission<select value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value as CompanyContact['role'] })} className="input-base mt-1 w-full rounded-lg px-3 py-2"><option value="company_admin">Company admin</option><option value="ordering">Ordering only</option><option value="viewer">View orders only</option></select></label><div className="flex gap-2"><button type="button" onClick={addContact} className="btn-primary rounded-lg px-3 py-2 text-xs">Add contact</button><button type="button" onClick={() => setShowContactForm(false)} className="btn-secondary rounded-lg px-3 py-2 text-xs">Cancel</button></div></div>}
          <div className="space-y-3">{contacts.length ? contacts.map((contact) => <article key={contact.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-800 text-primary">{contact.full_name.slice(0,2).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-800">{contact.full_name}</p><p className="truncate text-xs text-muted-foreground">{contact.email}</p></div><div className="text-right"><span className="ft-badge">{contact.role.replace('_',' ')}</span><p className="mt-1 text-[10px] text-muted-foreground">{contact.invite_status}</p></div></article>) : <div className="ft-empty-state min-h-40"><div><Icon name="UsersIcon" size={28} className="mx-auto text-primary" /><p className="mt-2 text-sm font-800">No purchasing contacts</p><p className="mt-1 text-xs text-muted-foreground">Add colleagues and assign ordering permissions.</p></div></div>}</div>
        </section>
      </div>

      <section className="ft-section overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center"><div><h2 className="font-800">Quick reorder</h2><p className="text-xs text-muted-foreground">Repeat a previous catalogue request with current company controls.</p></div><span className="ft-badge">{orders.length} recent requests</span></div>
        <div className="ft-table-wrap"><table><thead><tr><th>Request</th><th>Quantity</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{orders.length ? orders.map((order) => <tr key={order.id}><td><p className="font-mono text-xs font-700">{order.id.slice(0,8).toUpperCase()}</p><p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('en-IN')}</p></td><td>{Number(order.quantity).toLocaleString('en-IN')} {order.unit}</td><td className="font-700">₹{Number(order.total_amount).toLocaleString('en-IN')}</td><td><span className="ft-badge">{order.status.replaceAll('_',' ')}</span></td><td className="text-right"><button type="button" onClick={() => void reorder(order)} className="btn-secondary rounded-lg px-3 py-2 text-xs"><Icon name="ArrowPathIcon" size={14} /> Reorder</button></td></tr>) : <tr><td colSpan={5}><div className="ft-empty-state"><div><Icon name="ArrowPathIcon" size={28} className="mx-auto text-primary" /><p className="mt-2 text-sm font-800">No previous requests to reorder</p><p className="mt-1 text-xs text-muted-foreground">Your latest catalogue orders will appear here.</p></div></div></td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}