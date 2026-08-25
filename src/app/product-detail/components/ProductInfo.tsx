'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useProduct } from '@/lib/hooks/useProduct';

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
type Company = {
  id: string;
  company_name: string;
  purchase_order_required: boolean;
  order_review_required: boolean;
  default_payment_terms: string;
  default_deposit_percent: number;
};
type CompanyLocation = {
  id: string;
  location_name: string;
  payment_terms: string;
  deposit_percent: number | null;
  order_review_required: boolean | null;
  is_default: boolean;
};
type ConfirmedOrder = {
  orderId?: string;
  subtotal?: number;
  gstAmount?: number;
  totalAmount?: number;
  gstRate?: number;
  taxInvoiceType?: string;
  paymentTerms?: string;
  depositPercent?: number;
  requiresReview?: boolean;
};

const PAYMENT_TERM_LABELS: Record<string, string> = {
  due_on_order: 'Due on order',
  due_on_fulfillment: 'Due on fulfilment',
  net_7: 'Net 7',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
  net_90: 'Net 90',
};
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    Number(value || 0)
  );

export default function ProductInfo() {
  const { product, loading } = useProduct();
  const { user, profile, isDemoAccount } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const selectedVariant = product.variants?.find(
    (variant) => variant.id === product.selectedVariantId
  );
  const retailEnabled = product.saleChannel === 'retail' || product.saleChannel === 'both';
  const baseMinimum = retailEnabled
    ? 1
    : Math.max(1, Number(selectedVariant?.moq || product.moq || 1));
  const available = Math.max(0, Number(selectedVariant?.available ?? product.available));
  const basePrice = Number(selectedVariant?.price || product.price);
  const unit = selectedVariant?.unit || product.unit;

  const [catalogRules, setCatalogRules] = useState<CatalogRule[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [businessControlsLoading, setBusinessControlsLoading] = useState(false);
  const [qty, setQty] = useState(baseMinimum);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadBusinessControls = async () => {
      if (!user?.id || product.source !== 'seller' || !product.rawProductId || !product.sellerId) {
        if (mounted) {
          setCatalogRules([]);
          setCompany(null);
          setLocations([]);
          setSelectedLocationId('');
        }
        return;
      }

      setBusinessControlsLoading(true);
      if (isDemoAccount) {
        const demoCompany: Company = {
          id: 'demo-company',
          company_name: profile?.business_name || 'Demo Buyer Textiles',
          purchase_order_required: true,
          order_review_required: true,
          default_payment_terms: 'net_30',
          default_deposit_percent: 20,
        };
        const demoLocation: CompanyLocation = {
          id: 'demo-location',
          location_name: 'Mumbai Head Office',
          payment_terms: 'inherit',
          deposit_percent: null,
          order_review_required: null,
          is_default: true,
        };
        if (mounted) {
          setCompany(demoCompany);
          setLocations([demoLocation]);
          setSelectedLocationId(demoLocation.id);
          setCatalogRules([
            {
              id: 'demo-rule',
              catalog_id: 'demo-catalog',
              product_id: product.rawProductId,
              variant_id: null,
              price_override: roundMoney(basePrice * 0.97),
              minimum_quantity: Math.max(baseMinimum, 20),
              maximum_quantity: null,
              quantity_increment: unit === 'mtr' || unit === 'kg' ? 5 : 1,
              price_breaks: [
                { minimum_quantity: 50, price: roundMoney(basePrice * 0.94) },
                { minimum_quantity: 100, price: roundMoney(basePrice * 0.9) },
              ],
            },
          ]);
          setBusinessControlsLoading(false);
        }
        return;
      }

      try {
        const { data: companyData, error: companyError } = await supabase
          .from('b2b_company_accounts')
          .select(
            'id,company_name,purchase_order_required,order_review_required,default_payment_terms,default_deposit_percent'
          )
          .eq('owner_user_id', user.id)
          .maybeSingle();
        if (companyError) throw companyError;
        const resolvedCompany = companyData as Company | null;

        let resolvedLocations: CompanyLocation[] = [];
        if (resolvedCompany) {
          const { data, error } = await supabase
            .from('b2b_company_locations')
            .select(
              'id,location_name,payment_terms,deposit_percent,order_review_required,is_default'
            )
            .eq('company_id', resolvedCompany.id)
            .order('is_default', { ascending: false });
          if (error) throw error;
          resolvedLocations = (data || []) as CompanyLocation[];
        }

        const { data: catalogs, error: catalogError } = await supabase
          .from('seller_catalogs')
          .select('id')
          .eq('seller_id', product.sellerId)
          .eq('status', 'active');
        if (catalogError) throw catalogError;
        const catalogIds = (catalogs || []).map((catalog) => catalog.id);
        let resolvedRules: CatalogRule[] = [];
        if (catalogIds.length) {
          const { data, error } = await supabase
            .from('seller_catalog_rules')
            .select(
              'id,catalog_id,product_id,variant_id,price_override,minimum_quantity,maximum_quantity,quantity_increment,price_breaks'
            )
            .eq('product_id', product.rawProductId)
            .in('catalog_id', catalogIds);
          if (error) throw error;
          resolvedRules = (data || []) as CatalogRule[];
        }

        if (!mounted) return;
        setCompany(resolvedCompany);
        setLocations(resolvedLocations);
        setSelectedLocationId(
          (current) =>
            current ||
            resolvedLocations.find((location) => location.is_default)?.id ||
            resolvedLocations[0]?.id ||
            ''
        );
        setCatalogRules(resolvedRules);
      } catch (error) {
        if (mounted) {
          setCatalogRules([]);
          toast.error(error instanceof Error ? error.message : 'Could not load business pricing.');
        }
      } finally {
        if (mounted) setBusinessControlsLoading(false);
      }
    };

    void loadBusinessControls();
    return () => {
      mounted = false;
    };
  }, [
    baseMinimum,
    basePrice,
    isDemoAccount,
    product.rawProductId,
    product.sellerId,
    product.source,
    profile?.business_name,
    supabase,
    unit,
    user?.id,
  ]);

  const catalogRule = useMemo(() => {
    const exact = catalogRules.find((rule) => rule.variant_id === (selectedVariant?.id || null));
    return exact || catalogRules.find((rule) => rule.variant_id === null) || null;
  }, [catalogRules, selectedVariant?.id]);
  const minimum = Math.max(baseMinimum, Number(catalogRule?.minimum_quantity || 0));
  const maximum = Math.max(
    minimum,
    Math.min(
      available || Number.POSITIVE_INFINITY,
      Number(catalogRule?.maximum_quantity || Number.POSITIVE_INFINITY)
    )
  );
  const quantityIncrement = Math.max(
    0.01,
    Number(catalogRule?.quantity_increment || (unit === 'mtr' || unit === 'kg' ? 0.5 : 1))
  );

  useEffect(() => {
    setQty(minimum);
    setConfirmedOrder(null);
  }, [minimum, product.selectedVariantId]);

  const priceBreaks = useMemo(
    () =>
      (Array.isArray(catalogRule?.price_breaks) ? [...catalogRule.price_breaks] : []).sort(
        (a, b) => a.minimum_quantity - b.minimum_quantity
      ),
    [catalogRule?.price_breaks]
  );
  const catalogBasePrice = Number(catalogRule?.price_override || basePrice);
  const eligibleBreak = priceBreaks
    .filter((priceBreak) => qty >= Number(priceBreak.minimum_quantity))
    .at(-1);
  const price = Number(eligibleBreak?.price || catalogBasePrice);
  const estimatedGoodsValue = useMemo(() => roundMoney(qty * price), [price, qty]);
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) || null;
  const paymentTerms =
    selectedLocation?.payment_terms && selectedLocation.payment_terms !== 'inherit'
      ? selectedLocation.payment_terms
      : company?.default_payment_terms || 'due_on_order';
  const depositPercent = Math.max(
    0,
    Math.min(
      100,
      Number(selectedLocation?.deposit_percent ?? company?.default_deposit_percent ?? 0)
    )
  );
  const requiresReview =
    selectedLocation?.order_review_required ?? company?.order_review_required ?? false;
  const estimatedDepositBeforeTax = roundMoney(
    estimatedGoodsValue * (depositPercent / 100)
  );

  const selectVariant = (variantId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('variant', variantId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const clampQuantity = (value: number) => {
    if (!Number.isFinite(value)) return minimum;
    const constrained = Math.max(minimum, Math.min(maximum, value));
    const steps = Math.round((constrained - minimum) / quantityIncrement);
    return Number((minimum + steps * quantityIncrement).toFixed(2));
  };

  const submitOrderRequest = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`${pathname}?${searchParams.toString()}`)}`);
      return;
    }
    if (profile?.can_buy === false) {
      toast.error('Buying access is not enabled for this account.');
      return;
    }
    if (available <= 0 || qty < minimum || qty > maximum) {
      toast.error('Choose a quantity within the available catalogue limits.');
      return;
    }
    const alignedSteps = (qty - minimum) / quantityIncrement;
    if (Math.abs(alignedSteps - Math.round(alignedSteps)) > 0.001) {
      toast.error(`Quantity must increase in steps of ${quantityIncrement} ${unit}.`);
      return;
    }
    if (company?.purchase_order_required && !purchaseOrderNumber.trim()) {
      toast.error('Enter your company purchase order number.');
      return;
    }
    if (company && locations.length && !selectedLocation) {
      toast.error('Select the company location placing this order.');
      return;
    }

    setSubmittingOrder(true);
    try {
      if (isDemoAccount || product.source === 'catalog' || !product.rawProductId) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        setConfirmedOrder({
          subtotal: estimatedGoodsValue,
          totalAmount: estimatedGoodsValue,
          paymentTerms,
          depositPercent,
          requiresReview,
        });
      } else {
        const { data, error } = await supabase.rpc('submit_catalog_order_request', {
          p_product_id: product.rawProductId,
          p_variant_id: selectedVariant?.id || null,
          p_quantity: qty,
          p_company_id: company?.id || null,
          p_company_location_id: selectedLocation?.id || null,
          p_purchase_order_number: purchaseOrderNumber.trim() || null,
          p_payment_terms: paymentTerms,
          p_deposit_percent: depositPercent,
          p_requires_review: requiresReview,
          p_notes: `${retailEnabled ? 'Retail' : 'B2B'} catalogue request for ${product.name}${catalogRule ? ' using eligible catalogue pricing' : ''}`,
        });
        if (error) throw error;
        setConfirmedOrder((data || {}) as ConfirmedOrder);
      }
      toast.success(
        requiresReview
          ? 'Order request submitted for company review.'
          : 'Server-priced order request sent to the seller.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The order request could not be submitted.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (loading) {
    return <div className="h-[32rem] animate-pulse rounded-2xl border border-border bg-muted" />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {product.source === 'seller' && <span className="tag-new">Live seller catalogue</span>}
            <span className="badge-gstin">Server-calculated GST</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-800 text-primary">
              {product.saleChannel === 'both' ?'B2B + Retail'
                : product.saleChannel === 'retail' ?'Retail / B2C' :'B2B / Wholesale'}
            </span>
            {catalogRule && (
              <span className="ft-orange-chip">
                <Icon name="TagIcon" size={11} /> Catalogue price
              </span>
            )}
            {product.packageFormat && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 text-muted-foreground">
                {product.packageFormat}
              </span>
            )}
          </div>
          <h1 className="text-lg font-800 leading-snug text-foreground">{product.name}</h1>
          {product.sku && <p className="mt-1 text-xs text-muted-foreground">SKU {product.sku}</p>}
        </div>
        <button
          type="button"
          onClick={() => setSaved((current) => !current)}
          className={`shrink-0 rounded-xl border p-2 transition-all ${
            saved
              ? 'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:border-primary hover:text-primary'
          }`}
          aria-label={saved ? 'Remove from saved products' : 'Save product'}
        >
          <Icon name="HeartIcon" size={18} variant={saved ? 'solid' : 'outline'} />
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon name="ShieldCheckIcon" size={14} className="text-success" />
        <span>{product.seller}</span><span>·</span><span>{product.city}</span>
      </div>

      {!!product.variants?.length && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">
              Select colour / design
            </p>
            <span className="text-xs text-muted-foreground">
              {product.variants.filter((variant) => variant.available > 0).length} in stock
            </span>
          </div>
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {product.variants.map((variant) => {
              const active = variant.id === product.selectedVariantId;
              const unavailable = variant.available <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => selectVariant(variant.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/10' :'border-border hover:border-primary/50'
                  } ${unavailable ? 'cursor-not-allowed opacity-55' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-black/10 shadow-sm"
                      style={{ backgroundColor: variant.colorHex || '#d1d5db' }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-800 text-foreground">{variant.colorName}</p>
                      <p className="truncate text-xs text-muted-foreground">{variant.designName}</p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                        <span className="font-800 text-primary">{money(variant.price)}/{variant.unit}</span>
                        <span className={unavailable ? 'text-error' : 'text-success'}>
                          {unavailable
                            ? 'Out of stock'
                            : `${variant.available.toLocaleString('en-IN')} ${variant.unit}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedVariant && (
        <div className="mb-4 rounded-xl border border-secondary/20 bg-secondary/5 p-3">
          <p className="text-sm font-800 text-foreground">
            {selectedVariant.colorName} · {selectedVariant.designName}
          </p>
          {selectedVariant.description && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {selectedVariant.description}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <span className="text-3xl font-800 text-primary">{money(price)}</span>
        <span className="mb-1 text-sm text-muted-foreground">per {unit}</span>
        {catalogRule && price < basePrice && (
          <span className="mb-1 text-xs text-muted-foreground line-through">{money(basePrice)}</span>
        )}
        {eligibleBreak && (
          <span className="mb-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-800 text-success">
            Volume tier applied
          </span>
        )}
      </div>

      {catalogRule && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <p className="font-800 text-primary">Eligible wholesale catalogue pricing</p>
          <p className="mt-1 leading-5 text-muted-foreground">
            Minimum {minimum.toLocaleString('en-IN')} {unit} · increments of{' '}
            {quantityIncrement.toLocaleString('en-IN')} {unit}
            {Number.isFinite(maximum)
              ? ` · maximum ${maximum.toLocaleString('en-IN')} ${unit}`
              : ''}
          </p>
          {!!priceBreaks.length && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {priceBreaks.map((priceBreak) => (
                <span
                  key={`${priceBreak.minimum_quantity}-${priceBreak.price}`}
                  className={`ft-orange-chip ${qty >= priceBreak.minimum_quantity ? 'ring-1 ring-primary/30' : ''}`}
                >
                  {priceBreak.minimum_quantity}+ · {money(priceBreak.price)}/{unit}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-muted p-3">
          <p className="text-muted-foreground">Available</p>
          <p className="mt-1 font-800 text-foreground">
            {available.toLocaleString('en-IN')} {unit}
          </p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-muted-foreground">Minimum order</p>
          <p className="mt-1 font-800 text-foreground">
            {minimum.toLocaleString('en-IN')} {unit}
          </p>
          {retailEnabled && !catalogRule && (
            <p className="mt-0.5 text-[10px] text-success">Retail quantity enabled</p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-700 text-foreground">Quantity ({unit})</p>
          <span className="text-xs text-muted-foreground">
            Max {Number.isFinite(maximum) ? maximum.toLocaleString('en-IN') : available.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQty((current) => clampQuantity(current - quantityIncrement))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted hover:border-primary"
            aria-label="Reduce quantity"
          ><Icon name="MinusIcon" size={16} /></button>
          <input
            type="number"
            value={qty}
            min={minimum}
            max={Number.isFinite(maximum) ? maximum : undefined}
            step={quantityIncrement}
            onChange={(event) => setQty(Number(event.target.value))}
            onBlur={() => setQty((current) => clampQuantity(current))}
            className="input-base flex-1 rounded-xl px-3 py-2 text-center text-sm font-700"
          />
          <button
            type="button"
            onClick={() => setQty((current) => clampQuantity(current + quantityIncrement))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted hover:border-primary"
            aria-label="Increase quantity"
          ><Icon name="PlusIcon" size={16} /></button>
        </div>
      </div>

      {company ? (
        <div className="mb-4 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-800 text-foreground">{company.company_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Company purchasing controls apply to this request.
              </p>
            </div>
            <Link href="/company-purchasing" className="text-xs font-800 text-primary">Manage</Link>
          </div>
          {!!locations.length && (
            <label className="block text-xs font-700">
              Purchasing location
              <select
                value={selectedLocationId}
                onChange={(event) => setSelectedLocationId(event.target.value)}
                className="input-base mt-1.5 w-full rounded-lg px-3 py-2"
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.location_name}{location.is_default ? ' · Default' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-xs font-700">
            Purchase order number {company.purchase_order_required ? '*' : '(optional)'}
            <input
              value={purchaseOrderNumber}
              onChange={(event) => setPurchaseOrderNumber(event.target.value.toUpperCase())}
              className="input-base mt-1.5 w-full rounded-lg px-3 py-2 uppercase"
              placeholder="PO-2026-001"
            />
          </label>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-muted-foreground">Payment terms</p>
              <p className="mt-1 font-800">{PAYMENT_TERM_LABELS[paymentTerms] || paymentTerms}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-2.5">
              <p className="text-muted-foreground">Opening payment</p>
              <p className="mt-1 font-800">
                {depositPercent > 0 && depositPercent < 100
                  ? `${depositPercent}% · about ${money(estimatedDepositBeforeTax)} before GST`
                  : 'Full server-calculated balance'}
              </p>
            </div>
          </div>
          {requiresReview && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 p-2.5 text-xs font-700 text-warning">
              <Icon name="ClockIcon" size={14} /> This request requires company approval before seller action.
            </div>
          )}
        </div>
      ) : user && !businessControlsLoading ? (
        <Link
          href="/company-purchasing"
          className="mb-4 flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 transition hover:border-primary"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="BuildingOffice2Icon" size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-xs font-800 text-foreground">Set up company purchasing</strong>
            <small className="block text-xs text-muted-foreground">
              Add PO rules, locations, payment terms and approvers.
            </small>
          </span>
          <Icon name="ArrowRightIcon" size={14} className="text-primary" />
        </Link>
      ) : null}

      <div className="mb-4 rounded-xl bg-muted p-3">
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{qty} {unit} × {money(price)}</span>
          <span className="font-700 text-foreground">{money(estimatedGoodsValue)}</span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-4 border-t border-border pt-2 text-xs">
          <span className="text-muted-foreground">GST and final total</span>
          <span className="max-w-[16rem] text-right font-700 text-foreground">
            Calculated by the server from the approved seller HSN/GST rate, tax-inclusive setting and place of supply.
          </span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 p-3">
        <Icon name="TruckIcon" size={16} className="shrink-0 text-success" />
        <div>
          <p className="text-xs font-700 text-success">
            Dispatch in {product.dispatchDays} business day{product.dispatchDays === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-muted-foreground">Tracking appears in the buyer account after dispatch.</p>
        </div>
      </div>

      {confirmedOrder ? (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-success">
            <Icon name="CheckCircleIcon" size={20} />
            <span className="text-sm font-800">
              {confirmedOrder.requiresReview
                ? 'Order request submitted for review.'
                : 'Order request sent to the seller.'}
            </span>
          </div>
          {confirmedOrder.totalAmount !== undefined && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div><p className="text-muted-foreground">Subtotal</p><p className="font-800">{money(confirmedOrder.subtotal)}</p></div>
              <div><p className="text-muted-foreground">GST</p><p className="font-800">{money(confirmedOrder.gstAmount)}</p></div>
              <div><p className="text-muted-foreground">Confirmed total</p><p className="font-800 text-success">{money(confirmedOrder.totalAmount)}</p></div>
              <div><p className="text-muted-foreground">Invoice</p><p className="font-800 uppercase">{confirmedOrder.taxInvoiceType || 'after payment'}</p></div>
            </div>
          )}
          <Link href="/buyer-dashboard?tab=orders" className="mt-3 inline-flex text-xs font-800 text-primary underline">
            View purchase in my account
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void submitOrderRequest()}
          disabled={available <= 0 || submittingOrder || businessControlsLoading}
          className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="ShoppingCartIcon" size={16} />
          {submittingOrder
            ? 'Sending server-priced request…'
            : businessControlsLoading
              ? 'Loading business terms…'
              : available > 0
                ? requiresReview
                  ? 'Submit for company review'
                  : retailEnabled
                    ? 'Request this order' :'Submit B2B order request' :'Selected variation is out of stock'}
        </button>
      )}
    </div>
  );
}
