import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';
import { razorpayRequest, refreshPayoutAccount, RouteSetupError, type RouteProduct } from '@/lib/server/razorpayRoute';

export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  if (!await requireAdministrator()) return json({ error: 'Admin email OTP sign-in required.' }, 403);
  const admin = createAdminClient();
  const [sellers, accounts] = await Promise.all([
    admin.from('seller_profiles').select('id,display_name,legal_business_name,is_active,verification_status').order('created_at', { ascending: false }).limit(1000),
    admin.from('seller_payout_accounts').select('seller_id,linked_account_id,stakeholder_id,product_id,activation_status,setup_state,bank_last4,bank_ifsc,beneficiary_name,requirements,last_error_code,checked_at,verified_at').limit(1000),
  ]);
  if (sellers.error || accounts.error) return json({ error: 'Seller payouts could not be loaded.' }, 503);
  const byId = new Map((accounts.data || []).map(row => [row.seller_id, row]));
  return json({ sellers: (sellers.data || []).map(s => ({ sellerId: s.id, name: s.display_name || s.legal_business_name, isActive: s.is_active, sellerStatus: s.verification_status, account: byId.get(s.id) || null })) });
}

export async function POST(request: NextRequest) {
  if (!await requireAdministrator()) return json({ error: 'Admin email OTP sign-in required.' }, 403);
  const body = await request.json().catch(() => ({}));
  const sellerId = String(body.sellerId || '');
  if (!/^[0-9a-f-]{36}$/i.test(sellerId)) return json({ error: 'Valid seller reference required.' }, 400);
  try {
    if (body.action === 'recover') {
      const admin = createAdminClient();
      const { data: saved, error } = await admin.from('seller_payout_accounts').select('*').eq('seller_id', sellerId).maybeSingle();
      if (error || !saved) return json({ error: 'The seller must begin payout setup first.' }, 409);
      if (saved.activation_status === 'activated' || (saved.lock_expires_at && new Date(saved.lock_expires_at).getTime() > Date.now())) return json({ error: 'An active or in-progress account cannot be relinked.' }, 409);
      const accountId = String(body.linkedAccountId || saved.linked_account_id || '');
      if (!/^acc_[a-zA-Z0-9]+$/.test(accountId)) return json({ error: 'Linked account reference required.' }, 400);
      const linked = await razorpayRequest<{ id: string; type: string; notes?: { fabrictrad_seller_id?: string } }>(`/v2/accounts/${accountId}`);
      // Recovery cannot attach an arbitrary seller's bank, even from an admin form.
      if (linked.id !== accountId || linked.type !== 'route' || linked.notes?.fabrictrad_seller_id !== sellerId) return json({ error: 'Razorpay does not identify this account as belonging to the selected FabricTrad seller.' }, 409);
      const stakeholderId = String(body.stakeholderId || saved.stakeholder_id || '');
      const productId = String(body.productId || saved.product_id || '');
      if (stakeholderId) {
        if (!/^sth_[a-zA-Z0-9]+$/.test(stakeholderId)) return json({ error: 'Invalid stakeholder reference.' }, 400);
        const stakeholder = await razorpayRequest<{ id: string }>(`/v2/accounts/${accountId}/stakeholders/${stakeholderId}`);
        if (stakeholder.id !== stakeholderId) return json({ error: 'Representative does not belong to this account.' }, 409);
      }
      if (productId) {
        if (!/^acc_prd_[a-zA-Z0-9]+$/.test(productId)) return json({ error: 'Invalid Route product reference.' }, 400);
        const product = await razorpayRequest<RouteProduct>(`/v2/accounts/${accountId}/products/${productId}`);
        if (product.account_id !== accountId || product.product_name !== 'route' || product.id !== productId) return json({ error: 'Route product does not belong to this seller.' }, 409);
      }
      if (saved.setup_state === 'creating_stakeholder' && !stakeholderId || saved.setup_state === 'creating_product' && !productId) return json({ error: 'Provide the resource created by the interrupted request. Do not create a duplicate.' }, 409);
      const { data: updated, error: saveError } = await admin.from('seller_payout_accounts').update({ linked_account_id: accountId, stakeholder_id: stakeholderId || null, product_id: productId || null, setup_state: 'draft', activation_status: 'pending', verified_at: null, last_error_code: null, updated_at: new Date().toISOString() }).eq('seller_id', sellerId).eq('updated_at', saved.updated_at).select('seller_id').maybeSingle();
      if (saveError || !updated) return json({ error: 'Payout setup changed. Refresh and try again.' }, 409);
      return json({ recovered: true, message: 'References verified with Razorpay. The seller must resubmit bank details to complete setup.' });
    }
    const { ready } = await refreshPayoutAccount(sellerId);
    return json({ ready });
  } catch (error) {
    return json({ error: error instanceof RouteSetupError ? error.message : 'Razorpay payout verification failed.' }, error instanceof RouteSetupError ? error.status : 503);
  }
}
