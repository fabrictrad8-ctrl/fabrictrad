import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return json({ error: 'Sign in required.' }, 401);

  const [profileResult, buyerResult, sellerResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('role,can_buy,can_sell,is_active')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('buyer_profiles')
      .select('buyer_type,is_active,business_kyc_status,gstin_verified,gstin_status')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('seller_profiles')
      .select('is_active,verification_status,gstin_verified,gstin_status,settlement_eligible')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  const buyer = buyerResult.data;
  const seller = sellerResult.data;

  if (!profile) return json({ error: 'Account profile is not ready.' }, 404);

  const primarySeller = profile.role === 'seller';
  const canBuy = Boolean(!primarySeller && (profile.can_buy ?? profile.role === 'buyer'));
  const canSell = Boolean(profile.can_sell || primarySeller);

  const personalBuyer = buyer?.buyer_type === 'end_user';
  const buyerKycApproved = ['approved', 'verified', 'not_required'].includes(
    String(buyer?.business_kyc_status || '')
  );
  const buyerActive = Boolean(canBuy && profile.is_active && buyer?.is_active === true);
  const buyerVerified = Boolean(
    buyerActive && (personalBuyer || buyerKycApproved || buyer?.gstin_verified === true)
  );

  const sellerVerified = Boolean(
    canSell &&
      seller?.is_active !== false &&
      seller?.verification_status === 'verified' &&
      seller?.gstin_verified === true
  );

  const buyerLabel = !canBuy
    ? primarySeller
      ? 'Seller account · buyer workspace unavailable' :'Not enabled'
    : !buyerActive
      ? 'Buyer access inactive'
      : personalBuyer || buyer?.business_kyc_status === 'not_required' ?'Active · no business KYC required'
        : buyerVerified
          ? 'Buyer verified'
          : buyer?.business_kyc_status === 'pending' ?'Business verification under review' :'Complete buyer verification';

  const sellerLabel = !canSell
    ? 'Selling not activated'
    : sellerVerified
      ? 'Verified seller'
      : seller?.verification_status === 'manual_review' ?'Seller verification under review' :'Complete seller verification';

  const verificationSummary = primarySeller
    ? sellerLabel
    : canBuy && canSell
      ? `Buyer ${buyerVerified ? 'active' : 'setup pending'} · Seller ${sellerVerified ? 'verified' : 'review pending'}`
      : canSell
        ? sellerLabel
        : buyerLabel;

  return json({
    primaryRole: profile.role,
    canBuy,
    canSell,
    buyer: {
      active: buyerActive,
      verified: buyerVerified,
      type: canBuy ? buyer?.buyer_type || null : null,
      label: buyerLabel,
      needsAction: canBuy && !buyerVerified,
    },
    seller: {
      active: Boolean(canSell && seller?.is_active !== false),
      verified: sellerVerified,
      label: sellerLabel,
      needsAction: canSell && !sellerVerified,
    },
    verificationSummary,
  });
}
