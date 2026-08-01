import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeGtin, validateGtin } from '@/lib/commerceIdentifiers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LimitMode = 'same_as_retail_store' | 'custom' | 'disabled';

type UpdatePayload = {
  productId?: unknown;
  variantId?: unknown;
  gtin?: unknown;
  hsnCode?: unknown;
  brandName?: unknown;
  manufacturerName?: unknown;
  countryOfOrigin?: unknown;
  gstRate?: unknown;
  priceIncludesGst?: unknown;
  retailStoreMinQuantity?: unknown;
  retailStoreMaxQuantity?: unknown;
  endUserEnabled?: unknown;
  endUserLimitMode?: unknown;
  endUserMinQuantity?: unknown;
  endUserMaxQuantity?: unknown;
};

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const clean = (value: unknown, max = 300) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, max);

const optionalNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const resolveSeller = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { supabase, user: null, seller: null };
  const { data: seller } = await supabase
    .from('seller_profiles')
    .select('id,gstin,gstin_status,gstin_verified,verification_status,settlement_eligible')
    .eq('user_id', user.id)
    .maybeSingle();
  return { supabase, user, seller };
};

export async function GET() {
  const { supabase, user, seller } = await resolveSeller();
  if (!user) return json({ error: 'Sign in to manage seller product rules.' }, 401);
  if (!seller?.id) return json({ error: 'Complete seller onboarding first.' }, 403);

  const [{ data: products, error: productError }, { data: variants, error: variantError }] =
    await Promise.all([
      supabase
        .from('seller_products')
        .select(
          'id,name,sku,status,approval_status,sale_channel,unit,moq,available_quantity,gtin,gtin_status,gtin_verified_at,hsn_code,brand_name,manufacturer_name,country_of_origin,gst_rate,price_includes_gst,retail_store_min_quantity,retail_store_max_quantity,end_user_enabled,end_user_limit_mode,end_user_min_quantity,end_user_max_quantity,updated_at'
        )
        .eq('seller_id', seller.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('seller_product_variants')
        .select(
          'id,product_id,variant_code,color_name,design_name,status,unit,moq,available_quantity,gtin,gtin_status,gtin_verified_at,gst_rate,price_includes_gst,retail_store_min_quantity,retail_store_max_quantity,end_user_enabled,end_user_limit_mode,end_user_min_quantity,end_user_max_quantity,updated_at'
        )
        .eq('seller_id', seller.id)
        .order('updated_at', { ascending: false }),
    ]);
  if (productError || variantError) {
    return json({ error: productError?.message || variantError?.message || 'Product rules could not be loaded.' }, 500);
  }

  return json({
    seller: {
      gstin: seller.gstin,
      gstinStatus: seller.gstin_status,
      gstinVerified: seller.gstin_status === 'active' || seller.gstin_verified,
      verificationStatus: seller.verification_status,
      settlementEligible: seller.settlement_eligible,
    },
    products: products || [],
    variants: variants || [],
  });
}

export async function PUT(request: NextRequest) {
  const { supabase, user, seller } = await resolveSeller();
  if (!user) return json({ error: 'Sign in to update seller product rules.' }, 401);
  if (!seller?.id) return json({ error: 'Complete seller onboarding first.' }, 403);

  let input: UpdatePayload;
  try {
    input = (await request.json()) as UpdatePayload;
  } catch {
    return json({ error: 'Product-rule payload is invalid.' }, 400);
  }

  const productId = clean(input.productId, 64);
  const variantId = clean(input.variantId, 64);
  if (!productId) return json({ error: 'Choose a product.' }, 400);

  const gtin = normalizeGtin(input.gtin);
  if (gtin && !validateGtin(gtin)) {
    return json({ error: 'GTIN must be a valid GTIN-8, GTIN-12, GTIN-13 or GTIN-14 with the correct check digit.' }, 400);
  }

  const retailMin = optionalNumber(input.retailStoreMinQuantity);
  const retailMax = optionalNumber(input.retailStoreMaxQuantity);
  const endMin = optionalNumber(input.endUserMinQuantity);
  const endMax = optionalNumber(input.endUserMaxQuantity);
  const gstRate = optionalNumber(input.gstRate);
  if ([retailMin, retailMax, endMin, endMax, gstRate].some((value) => Number.isNaN(value))) {
    return json({ error: 'Quantity and tax fields must contain valid numbers.' }, 400);
  }
  if ((retailMin ?? 0) < 0 || (endMin ?? 0) < 0) return json({ error: 'Minimum quantities cannot be negative.' }, 400);
  if (retailMax !== null && retailMax < (retailMin ?? 0)) return json({ error: 'Retail Store maximum must be greater than or equal to its minimum.' }, 400);
  if (endMax !== null && endMax < (endMin ?? 0)) return json({ error: 'Buy for me maximum must be greater than or equal to its minimum.' }, 400);
  if (gstRate !== null && (gstRate < 0 || gstRate > 100)) return json({ error: 'GST rate must be between 0 and 100.' }, 400);

  const limitMode: LimitMode =
    input.endUserLimitMode === 'same_as_retail_store' || input.endUserLimitMode === 'disabled'
      ? input.endUserLimitMode
      : 'custom';
  const endUserEnabled = input.endUserEnabled === true && limitMode !== 'disabled';
  const commonValues = {
    gtin: gtin || null,
    gtin_status: gtin ? 'format_valid' : 'not_provided',
    gst_rate: gstRate,
    price_includes_gst: input.priceIncludesGst === true,
    retail_store_min_quantity: retailMin,
    retail_store_max_quantity: retailMax,
    end_user_enabled: endUserEnabled,
    end_user_limit_mode: endUserEnabled ? limitMode : 'disabled',
    end_user_min_quantity: endUserEnabled && limitMode === 'custom' ? endMin : null,
    end_user_max_quantity: endUserEnabled && limitMode === 'custom' ? endMax : null,
    updated_at: new Date().toISOString(),
  };

  if (variantId) {
    const { data: variant, error: ownerError } = await supabase
      .from('seller_product_variants')
      .select('id,product_id')
      .eq('id', variantId)
      .eq('product_id', productId)
      .eq('seller_id', seller.id)
      .maybeSingle();
    if (ownerError || !variant?.id) return json({ error: 'Variation not found for this seller.' }, 404);
    const { data, error } = await supabase
      .from('seller_product_variants')
      .update(commonValues)
      .eq('id', variant.id)
      .eq('seller_id', seller.id)
      .select('*')
      .single();
    if (error) return json({ error: error.message }, 400);
    return json({ updated: true, scope: 'variant', item: data });
  }

  const { data: product, error: ownerError } = await supabase
    .from('seller_products')
    .select('id,sale_channel,status')
    .eq('id', productId)
    .eq('seller_id', seller.id)
    .maybeSingle();
  if (ownerError || !product?.id) return json({ error: 'Product not found for this seller.' }, 404);

  const productValues = {
    ...commonValues,
    hsn_code: clean(input.hsnCode, 12).replace(/\D/g, '') || null,
    brand_name: clean(input.brandName, 160) || null,
    manufacturer_name: clean(input.manufacturerName, 200) || null,
    country_of_origin: clean(input.countryOfOrigin, 120) || 'India',
    sale_channel:
      endUserEnabled && product.sale_channel === 'b2b'
        ? 'both'
        : !endUserEnabled && product.sale_channel === 'retail'
          ? 'b2b'
          : product.sale_channel,
  };
  const { data, error } = await supabase
    .from('seller_products')
    .update(productValues)
    .eq('id', product.id)
    .eq('seller_id', seller.id)
    .select('*')
    .single();
  if (error) return json({ error: error.message }, 400);

  return json({
    updated: true,
    scope: 'product',
    item: data,
    livePublishingAllowed: seller.gstin_status === 'active' || seller.gstin_verified,
    gtinNotice: gtin
      ? 'GTIN check digit is valid. GS1 ownership remains marked format-valid until confirmed through GS1/DataKart or manual review.'
      : 'No GTIN supplied. This is allowed for unbarcoded fabric, but packaged trade items should use an authorised GS1 GTIN.',
    taxNotice: 'GST rate and HSN must match the actual product classification. Buyer GSTIN never removes GST.',
  });
}
