'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useProduct } from '@/lib/hooks/useProduct';
import { describeHsn, indiaGstRuleText, resolveIndiaGstRate } from '@/lib/indiaTax';

type BuyerType = 'retail_store' | 'end_user';
type LimitMode = 'same_as_retail_store' | 'custom' | 'disabled';
type PolicyRow = {
  gtin: string | null;
  gtin_status: string;
  hsn_code?: string | null;
  brand_name?: string | null;
  manufacturer_name?: string | null;
  country_of_origin?: string | null;
  gst_rate: number | null;
  price_includes_gst: boolean | null;
  retail_store_min_quantity: number | null;
  retail_store_max_quantity: number | null;
  end_user_enabled: boolean | null;
  end_user_limit_mode: LimitMode | null;
  end_user_min_quantity: number | null;
  end_user_max_quantity: number | null;
};
type CatalogRule = {
  price_override: number | null;
  minimum_quantity: number;
  maximum_quantity: number | null;
  quantity_increment: number;
  price_breaks: Array<{ minimum_quantity: number; price: number }>;
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
type OrderResult = {
  id?: string;
  buyerType?: BuyerType;
  quantity?: number;
  unit?: string;
  pricePerUnit?: number;
  subtotal?: number;
  gstAmount?: number;
  totalAmount?: number;
  invoiceType?: 'b2b' | 'b2c';
  inputTaxCreditPossible?: boolean;
  taxNote?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
const round = (value: number) => Math.round(value * 100) / 100;

export default function ProductInfoV2() {
  const { product, loading } = useProduct();
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const selectedVariant = product.variants?.find(
    (variant) => variant.id === product.selectedVariantId
  );
  const available = Math.max(0, Number(selectedVariant?.available ?? product.available));
  const basePrice = Number(selectedVariant?.price || product.price);
  const unit = selectedVariant?.unit || product.unit;

  const [buyerType, setBuyerType] = useState<BuyerType>('end_user');
  const [buyerGstin, setBuyerGstin] = useState<string | null>(null);
  const [buyerGstinStatus, setBuyerGstinStatus] = useState('not_provided');
  const [sellerGstinVerified, setSellerGstinVerified] = useState(false);
  const [productPolicy, setProductPolicy] = useState<PolicyRow | null>(null);
  const [variantPolicy, setVariantPolicy] = useState<PolicyRow | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [catalogRule, setCatalogRule] = useState<CatalogRule | null>(null);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [qty, setQty] = useState(1);
  const [loadingRules, setLoadingRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadRules = async () => {
      setLoadingRules(true);
      try {
        let resolvedBuyerType: BuyerType = 'end_user';
        let resolvedBuyerGstin: string | null = null;
        let resolvedBuyerGstinStatus = 'not_provided';
        let resolvedCompany: Company | null = null;
        let resolvedLocations: CompanyLocation[] = [];
        let resolvedProductPolicy: PolicyRow | null = null;
        let resolvedVariantPolicy: PolicyRow | null = null;
        let resolvedCatalogRule: CatalogRule | null = null;
        let resolvedSellerGstinVerified = false;

        if (user?.id) {
          const { data: buyer, error: buyerError } = await supabase
            .from('buyer_profiles')
            .select('buyer_type,gstin,gstin_status,gstin_verified,is_active')
            .eq('user_id', user.id)
            .maybeSingle();
          if (buyerError) throw buyerError;
          if (!buyer?.is_active) {
            throw new Error('An active buyer profile is required before placing an order.');
          }

          resolvedBuyerType = buyer.buyer_type === 'retail_store' ? 'retail_store' : 'end_user';
          resolvedBuyerGstin = buyer.gstin || null;
          resolvedBuyerGstinStatus =
            buyer.gstin_status || (buyer.gstin_verified ? 'active' : 'not_provided');

          if (resolvedBuyerType === 'retail_store') {
            const { data: companyData, error: companyError } = await supabase
              .from('b2b_company_accounts')
              .select(
                'id,company_name,purchase_order_required,order_review_required,default_payment_terms,default_deposit_percent'
              )
              .eq('owner_user_id', user.id)
              .eq('status', 'active')
              .maybeSingle();
            if (companyError) throw companyError;
            resolvedCompany = companyData as Company | null;

            if (resolvedCompany) {
              const { data: locationData, error: locationError } = await supabase
                .from('b2b_company_locations')
                .select(
                  'id,location_name,payment_terms,deposit_percent,order_review_required,is_default'
                )
                .eq('company_id', resolvedCompany.id)
                .order('is_default', { ascending: false });
              if (locationError) throw locationError;
              resolvedLocations = (locationData || []) as CompanyLocation[];
            }
          }
        }

        if (product.source === 'seller' && product.rawProductId) {
          const { data: productRow, error: productPolicyError } = await supabase
            .from('seller_products')
            .select(
              'gtin,gtin_status,hsn_code,brand_name,manufacturer_name,country_of_origin,gst_rate,price_includes_gst,retail_store_min_quantity,retail_store_max_quantity,end_user_enabled,end_user_limit_mode,end_user_min_quantity,end_user_max_quantity'
            )
            .eq('id', product.rawProductId)
            .eq('status', 'active')
            .eq('approval_status', 'approved')
            .maybeSingle();
          if (productPolicyError) throw productPolicyError;
          resolvedProductPolicy = productRow as PolicyRow | null;

          if (selectedVariant?.id) {
            const { data: variantRow, error: variantPolicyError } = await supabase
              .from('seller_product_variants')
              .select(
                'gtin,gtin_status,gst_rate,price_includes_gst,retail_store_min_quantity,retail_store_max_quantity,end_user_enabled,end_user_limit_mode,end_user_min_quantity,end_user_max_quantity'
              )
              .eq('id', selectedVariant.id)
              .eq('product_id', product.rawProductId)
              .eq('status', 'active')
              .eq('approval_status', 'approved')
              .maybeSingle();
            if (variantPolicyError) throw variantPolicyError;
            resolvedVariantPolicy = variantRow as PolicyRow | null;
          }

          if (product.sellerId) {
            const { data: seller, error: sellerError } = await supabase
              .from('seller_profiles')
              .select('gstin_status,gstin_verified')
              .eq('id', product.sellerId)
              .eq('is_active', true)
              .maybeSingle();
            if (sellerError) throw sellerError;
            resolvedSellerGstinVerified =
              seller?.gstin_status === 'active' || seller?.gstin_verified === true;
          }

          if (resolvedBuyerType === 'retail_store' && product.sellerId) {
            const { data: catalogData, error: catalogError } = await supabase
              .from('seller_catalogs')
              .select('id,company_id,scope')
              .eq('seller_id', product.sellerId)
              .eq('status', 'active');
            if (catalogError) throw catalogError;

            const eligibleCatalogIds = (catalogData || [])
              .filter(
                (catalog) =>
                  catalog.scope === 'all_buyers' ||
                  (catalog.scope === 'company' && catalog.company_id === resolvedCompany?.id)
              )
              .map((catalog) => catalog.id);

            if (eligibleCatalogIds.length) {
              const { data: ruleData, error: ruleError } = await supabase
                .from('seller_catalog_rules')
                .select(
                  'variant_id,price_override,minimum_quantity,maximum_quantity,quantity_increment,price_breaks'
                )
                .eq('product_id', product.rawProductId)
                .in('catalog_id', eligibleCatalogIds);
              if (ruleError) throw ruleError;
              const exact = (ruleData || []).find(
                (rule) => rule.variant_id === (selectedVariant?.id || null)
              );
              const fallback = (ruleData || []).find((rule) => rule.variant_id === null);
              resolvedCatalogRule = (exact || fallback || null) as CatalogRule | null;
            }
          }
        }

        if (!mounted) return;
        setBuyerType(resolvedBuyerType);
        setBuyerGstin(resolvedBuyerGstin);
        setBuyerGstinStatus(resolvedBuyerGstinStatus);
        setCompany(resolvedCompany);
        setLocations(resolvedLocations);
        setSelectedLocationId(
          (current) =>
            current ||
            resolvedLocations.find((location) => location.is_default)?.id ||
            resolvedLocations[0]?.id ||
            ''
        );
        setProductPolicy(resolvedProductPolicy);
        setVariantPolicy(resolvedVariantPolicy);
        setCatalogRule(resolvedCatalogRule);
        setSellerGstinVerified(resolvedSellerGstinVerified);
      } catch (caught) {
        if (mounted) {
          toast.error(caught instanceof Error ? caught.message : 'Buyer rules could not be loaded.');
        }
      } finally {
        if (mounted) setLoadingRules(false);
      }
    };

    void loadRules();
    return () => {
      mounted = false;
    };
  }, [
    product.rawProductId,
    product.sellerId,
    product.source,
    selectedVariant?.id,
    supabase,
    user?.id,
  ]);

  const effective = variantPolicy || productPolicy;
  const businessMinimum = Math.max(
    0.01,
    Number(
      variantPolicy?.retail_store_min_quantity ??
        productPolicy?.retail_store_min_quantity ??
        selectedVariant?.moq ??
        product.moq ??
        1
    )
  );
  const businessMaximum =
    variantPolicy?.retail_store_max_quantity ?? productPolicy?.retail_store_max_quantity ?? null;
  const endUserEnabled = Boolean(
    (variantPolicy?.end_user_enabled ?? productPolicy?.end_user_enabled ?? false) &&
      (product.saleChannel === 'retail' || product.saleChannel === 'both')
  );
  const endUserMode =
    variantPolicy?.end_user_limit_mode || productPolicy?.end_user_limit_mode || 'disabled';
  const personalMinimum =
    endUserMode === 'same_as_retail_store'
      ? businessMinimum
      : Math.max(
          0.01,
          Number(variantPolicy?.end_user_min_quantity ?? productPolicy?.end_user_min_quantity ?? 1)
        );
  const personalMaximum =
    endUserMode === 'same_as_retail_store'
      ? businessMaximum
      : variantPolicy?.end_user_max_quantity ?? productPolicy?.end_user_max_quantity ?? null;
  const policyMinimum = buyerType === 'end_user' ? personalMinimum : businessMinimum;
  const policyMaximum = buyerType === 'end_user' ? personalMaximum : businessMaximum;
  const catalogMinimum =
    buyerType === 'retail_store' ? Number(catalogRule?.minimum_quantity || 0) : 0;
  const catalogMaximum =
    buyerType === 'retail_store' ? catalogRule?.maximum_quantity ?? null : null;
  const minimum = Math.max(policyMinimum, catalogMinimum || 0.01);
  const maximum = Math.min(
    available || Number.POSITIVE_INFINITY,
    policyMaximum ?? Number.POSITIVE_INFINITY,
    catalogMaximum ?? Number.POSITIVE_INFINITY
  );
  const increment = Math.max(
    0.01,
    Number(catalogRule?.quantity_increment || (unit === 'mtr' || unit === 'kg' ? 0.5 : 1))
  );
  const orderBlocked =
    buyerType === 'end_user' &&
    (!endUserEnabled ||
      endUserMode === 'disabled' ||
      !['retail', 'both'].includes(product.saleChannel || 'b2b'));

  useEffect(() => {
    if (Number.isFinite(minimum)) setQty(minimum);
    setOrderResult(null);
  }, [minimum, product.selectedVariantId]);

  const catalogBasePrice = Number(catalogRule?.price_override || basePrice);
  const eligibleBreak = (Array.isArray(catalogRule?.price_breaks) ? catalogRule.price_breaks : [])
    .filter((item) => qty >= Number(item.minimum_quantity))
    .sort((a, b) => Number(a.minimum_quantity) - Number(b.minimum_quantity))
    .at(-1);
  const price = Number(eligibleBreak?.price || catalogBasePrice);
  const hsnCode = productPolicy?.hsn_code || '';
  const storedGstRate = Number(
    effective?.gst_rate ?? productPolicy?.gst_rate ?? (product.gst === false ? 0 : 5)
  );
  const gstRate = resolveIndiaGstRate({ hsnCode, unitPrice: price, storedRate: storedGstRate });
  const hsnDescription = describeHsn(hsnCode);
  const gstRuleText = indiaGstRuleText(hsnCode, price);
  const priceIncludesGst = Boolean(
    effective?.price_includes_gst ?? productPolicy?.price_includes_gst ?? false
  );
  const subtotal = round(qty * price);
  const gstAmount =
    gstRate <= 0
      ? 0
      : priceIncludesGst
        ? round(subtotal - subtotal / (1 + gstRate / 100))
        : round((subtotal * gstRate) / 100);
  const total = priceIncludesGst ? subtotal : round(subtotal + gstAmount);
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) || null;
  const paymentTerms =
    selectedLocation?.payment_terms && selectedLocation.payment_terms !== 'inherit'
      ? selectedLocation.payment_terms
      : company?.default_payment_terms || 'due_on_order';
  const depositPercent = Number(
    selectedLocation?.deposit_percent ?? company?.default_deposit_percent ?? 0
  );
  const requiresReview =
    selectedLocation?.order_review_required ?? company?.order_review_required ?? false;

  const changeVariant = (variantId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('variant', variantId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const clampQuantity = (value: number) => {
    if (!Number.isFinite(value)) return minimum;
    const constrained = Math.max(minimum, Math.min(maximum, value));
    const steps = Math.round((constrained - minimum) / increment);
    return Number((minimum + steps * increment).toFixed(2));
  };

  const submitOrder = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`${pathname}?${searchParams.toString()}`)}`);
      return;
    }
    if (profile?.can_buy === false) {
      toast.error('Buying access is not enabled for this account.');
      return;
    }
    if (product.source !== 'seller' || !product.rawProductId || !product.sellerId) {
      toast.error('This listing is not connected to a live seller product and cannot be ordered.');
      return;
    }
    if (orderBlocked) {
      toast.error('This seller has not enabled personal quantities for this product.');
      return;
    }
    if (!Number.isFinite(maximum) || maximum < minimum || available <= 0) {
      toast.error('This product is currently unavailable.');
      return;
    }
    if (qty < minimum || qty > maximum) {
      toast.error(`Choose a quantity between ${minimum} and ${maximum} ${unit}.`);
      return;
    }
    if (company?.purchase_order_required && !purchaseOrderNumber.trim()) {
      toast.error('Enter the company purchase order number.');
      return;
    }
    if (company && locations.length && !selectedLocation) {
      toast.error('Select the company location placing this order.');
      return;
    }

    setSubmitting(true);
    try {
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
        p_notes: `${buyerType === 'end_user' ? 'Buy for me' : 'Retail Store'} request for ${product.name}`,
      });
      if (error) throw error;
      if (!data || typeof data !== 'object') {
        throw new Error('The order was not persisted. Please retry.');
      }
      setOrderResult(data as OrderResult);
      toast.success(
        requiresReview ? 'Order submitted for company review.' : 'Order request sent to the seller.'
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : 'The order request could not be submitted.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="h-[32rem] animate-pulse rounded-2xl border border-border bg-muted" />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="tag-new">Live seller catalogue</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-800 text-primary">
              {product.saleChannel === 'both'
                ? 'Business + personal'
                : product.saleChannel === 'retail'
                  ? 'Personal enabled'
                  : 'Business only'}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 text-muted-foreground">
              {buyerType === 'retail_store' ? 'Retail Store profile' : 'Buy for me profile'}
            </span>
          </div>
          <h1 className="mt-2 text-lg font-800 leading-snug text-foreground">{product.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{product.seller} · {product.city}</p>
        </div>
        <button
          type="button"
          onClick={() => setSaved((current) => !current)}
          className={`rounded-xl border p-2 ${
            saved
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground'
          }`}
          aria-label={saved ? 'Remove saved product' : 'Save product'}
        >
          <Icon name="HeartIcon" size={18} variant={saved ? 'solid' : 'outline'} />
        </button>
      </div>

      {!!product.variants?.length && (
        <div className="mt-5">
          <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Colour / design</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => changeVariant(variant.id)}
                className={`rounded-xl border px-3 py-2 text-xs font-700 ${
                  variant.id === selectedVariant?.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground'
                }`}
              >
                {variant.colorName} · {variant.designName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-border bg-muted/25 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Eligible unit price</p>
            <p className="mt-1 text-2xl font-800 text-foreground">
              {money(price)}<span className="text-sm font-600 text-muted-foreground">/{unit}</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {available.toLocaleString('en-IN')} {unit} available
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-muted-foreground">GTIN</p>
            <p className="mt-1 font-800 text-foreground">{effective?.gtin || 'Not provided'}</p>
            {effective?.gtin && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {effective.gtin_status.replaceAll('_', ' ')}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-muted-foreground">HSN / GST</p>
            <p className="mt-1 font-800 text-foreground">
              {hsnCode ? `HSN ${hsnCode}` : 'HSN required'} · {gstRate}% GST
            </p>
            {hsnDescription && (
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{hsnDescription}</p>
            )}
            {gstRuleText && (
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{gstRuleText}</p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              {priceIncludesGst ? 'Included in displayed price' : 'Added to displayed price'}
            </p>
          </div>
        </div>
      </div>

      {loadingRules ? (
        <div className="mt-4 h-20 animate-pulse rounded-xl bg-muted" />
      ) : orderBlocked ? (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex gap-3">
            <Icon name="ShoppingBagIcon" size={20} className="shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-800 text-amber-950">Personal purchase not enabled</p>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                The seller has limited this product to Retail Store buyers. Use a business buyer profile or ask the seller through a buyer requirement.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
            {buyerType === 'end_user'
              ? `Personal range: ${minimum}–${Number.isFinite(maximum) ? maximum : 'available stock'} ${unit}.`
              : `Business range: ${minimum}–${Number.isFinite(maximum) ? maximum : 'available stock'} ${unit}${catalogRule ? ' with eligible catalogue pricing' : ''}.`}
          </div>

          <label className="block text-sm font-700 text-foreground">
            Quantity ({unit})
            <div className="mt-1.5 flex items-center gap-2">
              <button type="button" onClick={() => setQty(clampQuantity(qty - increment))} className="ft-icon-button" aria-label="Reduce quantity">
                <Icon name="MinusIcon" size={16} />
              </button>
              <input
                type="number"
                value={qty}
                min={minimum}
                max={Number.isFinite(maximum) ? maximum : undefined}
                step={increment}
                onChange={(event) => setQty(clampQuantity(Number(event.target.value)))}
                className="input-base min-w-0 flex-1 px-4 py-3 text-center font-800"
              />
              <button type="button" onClick={() => setQty(clampQuantity(qty + increment))} className="ft-icon-button" aria-label="Increase quantity">
                <Icon name="PlusIcon" size={16} />
              </button>
            </div>
          </label>

          {company && (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">
                Company purchase · {company.company_name}
              </p>
              {locations.length > 0 && (
                <label className="block text-xs font-700 text-foreground">
                  Ordering location
                  <select
                    value={selectedLocationId}
                    onChange={(event) => setSelectedLocationId(event.target.value)}
                    className="input-base mt-1.5 w-full px-3 py-2.5 font-400"
                  >
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>{location.location_name}</option>
                    ))}
                  </select>
                </label>
              )}
              {company.purchase_order_required && (
                <label className="block text-xs font-700 text-foreground">
                  Purchase order number *
                  <input
                    value={purchaseOrderNumber}
                    onChange={(event) => setPurchaseOrderNumber(event.target.value)}
                    className="input-base mt-1.5 w-full px-3 py-2.5 font-400"
                  />
                </label>
              )}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>GST {gstRate}% {priceIncludesGst ? '(included)' : ''}</span><span>{money(gstAmount)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-800 text-foreground"><span>Estimated total</span><span>{money(total)}</span></div>
          </div>

          <div className={`rounded-xl border p-3 text-xs leading-5 ${
            buyerType === 'retail_store' && buyerGstinStatus === 'active'
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border bg-muted/30 text-muted-foreground'
          }`}>
            {buyerType === 'retail_store' && buyerGstinStatus === 'active'
              ? `Verified buyer GSTIN ${buyerGstin}. The B2B invoice will include it. GST is still charged; eligible input tax credit depends on invoice and return conditions.`
              : buyerType === 'retail_store'
                ? 'Business profile selected, but an active buyer GSTIN is not confirmed. The order receives a consumer/non-ITC invoice until verification succeeds.'
                : 'Personal purchase: no PAN, Aadhaar or GSTIN is needed. A consumer invoice is issued with GST where applicable.'}
          </div>

          <div className="rounded-xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
            <span className="font-800 text-foreground">How buying works:</span> submit this real order request, the seller accepts it, then Razorpay payment becomes available in your Buyer Dashboard. The order is never marked paid before server-side payment verification succeeds.
          </div>

          <button
            type="button"
            onClick={submitOrder}
            disabled={submitting || available <= 0 || maximum < minimum}
            className="btn-primary w-full py-3 text-sm disabled:opacity-50"
          >
            {submitting
              ? 'Creating real order…'
              : requiresReview
                ? 'Submit for company review'
                : 'Send order request'}
          </button>
        </div>
      )}

      {orderResult && (
        <div className="mt-5 rounded-2xl border border-success/30 bg-success/10 p-4">
          <div className="flex items-start gap-3">
            <Icon name="CheckCircleIcon" size={22} className="shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-800 text-foreground">Order saved successfully</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Exact server total: {money(Number(orderResult.totalAmount || total))} ·{' '}
                {orderResult.invoiceType === 'b2b' ? 'B2B tax invoice' : 'Consumer invoice'}
              </p>
              {orderResult.id && (
                <p className="mt-1 break-all text-[10px] text-muted-foreground">Order ID: {orderResult.id}</p>
              )}
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{orderResult.taxNote}</p>
              {orderResult.inputTaxCreditPossible && (
                <p className="mt-2 text-xs font-800 text-success">
                  Potentially eligible for input tax credit, subject to GST law and invoice matching.
                </p>
              )}
              <p className="mt-3 text-xs font-700 text-foreground">
                Next: wait for seller acceptance, then pay securely from Buyer Dashboard.
              </p>
              <button
                type="button"
                onClick={() => router.push('/buyer-dashboard')}
                className="btn-primary mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs"
              >
                Open Buyer Dashboard <Icon name="ArrowRightIcon" size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
