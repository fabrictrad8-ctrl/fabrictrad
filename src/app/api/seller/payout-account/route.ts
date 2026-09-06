import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateSellerPayout } from '@/lib/sellerPayoutValidation';
import { readLimitedBody, BodyLimitError } from '@/lib/limitedBody';
import { bankFingerprint, razorpayRequest, refreshPayoutAccount, RouteSetupError, type RouteProduct } from '@/lib/server/razorpayRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function sellerAccess() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new RouteSetupError('Sign in to manage seller payouts.', 401, 'AUTHENTICATION_REQUIRED');
  const { data: profile, error } = await client.from('user_profiles').select('role,is_active,phone').eq('id', user.id).maybeSingle();
  if (error) throw new RouteSetupError('Account access could not be checked.');
  if (profile?.role !== 'seller' || profile.is_active !== true) throw new RouteSetupError('Seller access is required.', 403, 'SELLER_ACCESS_REQUIRED');
  const admin = createAdminClient();
  const { data: seller, error: sellerError } = await admin.from('seller_profiles').select('id,user_id,legal_business_name,gstin,gstin_verified,pan,contact_phone,razorpay_linked_account_id').eq('user_id', user.id).maybeSingle();
  if (sellerError || !seller) throw new RouteSetupError('Seller profile could not be loaded.');
  return { admin, seller, user, phone: profile.phone };
}

function publicAccount(account: Record<string, unknown> | null) {
  if (!account) return null;
  return { connected: Boolean(account.linked_account_id), activationStatus: account.activation_status, setupState: account.setup_state, bankLast4: account.bank_last4, bankIfsc: account.bank_ifsc, bankName: account.beneficiary_name, requirements: account.requirements || [], checkedAt: account.checked_at, verifiedAt: account.verified_at, lastError: account.last_error_code };
}

const fail = (error: unknown) => error instanceof RouteSetupError ? json({ error: error.message, code: error.code }, error.status) : json({ error: 'Payout setup could not be completed. Your full bank number has not been saved by FabricTrad.' }, 503);

export async function GET() {
  try {
    const { seller } = await sellerAccess();
    const { account, ready } = await refreshPayoutAccount(seller.id);
    return json({ account: publicAccount(account), ready, sellerSharePercent: 90, platformSharePercent: 10 });
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  let release: (() => Promise<unknown>) | undefined;
  try {
    const { admin, seller, user, phone: profilePhone } = await sellerAccess();
    if (seller.gstin_verified !== true) throw new RouteSetupError('Complete GST verification before connecting your bank account.', 409, 'GST_VERIFICATION_REQUIRED');
    if (!user.email) throw new RouteSetupError('A verified business email is required.', 409);
    if (Number(request.headers.get('content-length') || 0) > 12000) return json({ error: 'Request too large.' }, 413);
    let raw: string;
    try { raw = new TextDecoder().decode(await readLimitedBody(request.body, 12000)); }
    catch (error) { if (error instanceof BodyLimitError) return json({ error: 'Request too large.' }, 413); throw error; }
    let input;
    try { input = validateSellerPayout(JSON.parse(raw)); } catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid payout details.' }, 400); }
    const { error: insertError } = await admin.from('seller_payout_accounts').upsert({ seller_id: seller.id }, { onConflict: 'seller_id', ignoreDuplicates: true });
    if (insertError) throw new RouteSetupError('Payout setup is not available yet.');
    const token = randomUUID();
    const now = new Date().toISOString();
    const { data: row, error: lockError } = await admin.from('seller_payout_accounts')
      .update({ lock_token: token, lock_expires_at: new Date(Date.now() + 180000).toISOString(), updated_at: now })
      .eq('seller_id', seller.id).or(`lock_expires_at.is.null,lock_expires_at.lt.${now}`).select('*').maybeSingle();
    if (lockError) throw new RouteSetupError('Payout setup could not be reserved.');
    if (!row) throw new RouteSetupError('A payout request is already in progress. Refresh shortly.', 409, 'PAYOUT_SETUP_BUSY');
    release = async () => admin.from('seller_payout_accounts').update({ lock_token: null, lock_expires_at: null }).eq('seller_id', seller.id).eq('lock_token', token);
    if (row.activation_status === 'activated') throw new RouteSetupError('Your payout bank is already active. Contact FabricTrad to securely change an active bank account.', 409, 'PAYOUT_ALREADY_ACTIVE');
    if (String(row.setup_state).startsWith('creating_') || row.setup_state === 'needs_reconciliation') throw new RouteSetupError('A previous Razorpay request needs reconciliation by FabricTrad before setup can resume.', 409, 'PAYOUT_RECONCILIATION_REQUIRED');
    if (!row.linked_account_id && seller.razorpay_linked_account_id) throw new RouteSetupError('Your existing linked account must be verified by FabricTrad before it can be reused.', 409, 'PAYOUT_RECONCILIATION_REQUIRED');
    const save = async (values: Record<string, unknown>) => {
      const { data, error } = await admin.from('seller_payout_accounts').update({ ...values, updated_at: new Date().toISOString() }).eq('seller_id', seller.id).eq('lock_token', token).select('seller_id').maybeSingle();
      if (error || !data) throw new RouteSetupError('Payout setup could not be recorded safely.', 503, 'PAYOUT_PERSISTENCE_FAILED');
      Object.assign(row, values);
    };
    const createResource = async <T,>(stage: string, path: string, body: unknown): Promise<T> => {
      await save({ setup_state: `creating_${stage}`, activation_status: 'pending', verified_at: null, last_error_code: null });
      try { return await razorpayRequest<T>(path, 'POST', body); }
      catch (error) {
        await save({ setup_state: error instanceof RouteSetupError && error.code === 'RAZORPAY_DETAILS_REJECTED' ? 'draft' : `creating_${stage}`, last_error_code: error instanceof RouteSetupError ? error.code : 'PAYOUT_RESULT_UNCERTAIN' });
        throw error;
      }
    };
    const notes = { fabrictrad_seller_id: seller.id, fabrictrad_user_id: user.id };
    const phone = String(seller.contact_phone || profilePhone || user.phone || '').replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) throw new RouteSetupError('Add a valid business contact phone to your seller profile.', 400, 'PHONE_REQUIRED');
    if (!row.linked_account_id) {
      const account = await createResource<{ id?: string; type?: string }>('account', '/v2/accounts', {
        type: 'route', email: user.email, phone, business_type: input.businessType, legal_business_name: seller.legal_business_name, contact_name: input.contactName,
        profile: { category: 'ecommerce', subcategory: 'fashion_and_lifestyle', business_model: 'Sale of textiles and fabrics through FabricTrad', addresses: { registered: { street1: input.registeredStreet, street2: '', city: input.registeredCity, state: input.registeredState, postal_code: input.registeredPincode, country: 'IN' } } },
        legal_info: { gst: seller.gstin, ...(seller.pan ? { pan: seller.pan } : {}) }, notes,
      });
      if (!account.id || account.type !== 'route') throw new RouteSetupError('Razorpay did not confirm a linked account.', 503, 'PAYOUT_RESULT_UNCERTAIN');
      await save({ linked_account_id: account.id, business_type: input.businessType, setup_state: 'draft' });
    }
    const base = `/v2/accounts/${encodeURIComponent(row.linked_account_id)}`;
    const stakeholderBody = { name: input.contactName, email: user.email, addresses: { residential: { street: input.street, city: input.city, state: input.state, postal_code: input.pincode, country: 'IN' } }, kyc: { pan: input.contactPan }, notes };
    if (!row.stakeholder_id) {
      const stakeholder = await createResource<{ id?: string }>('stakeholder', `${base}/stakeholders`, stakeholderBody);
      if (!stakeholder.id) throw new RouteSetupError('Razorpay did not confirm the representative.', 503, 'PAYOUT_RESULT_UNCERTAIN');
      await save({ stakeholder_id: stakeholder.id, setup_state: 'draft' });
    } else {
      await razorpayRequest(`${base}/stakeholders/${encodeURIComponent(row.stakeholder_id)}`, 'PATCH', stakeholderBody);
    }
    if (!row.product_id) {
      const product = await createResource<RouteProduct>('product', `${base}/products`, { product_name: 'route', tnc_accepted: true });
      if (!product.id || product.account_id !== row.linked_account_id || product.product_name !== 'route') throw new RouteSetupError('Razorpay did not confirm Route configuration.', 503, 'PAYOUT_RESULT_UNCERTAIN');
      await save({ product_id: product.id, setup_state: 'draft' });
    }
    // The complete account number and PAN are sent only to Razorpay and never stored or logged here.
    await save({ setup_state: 'bank_submitting', activation_status: 'pending', verified_at: null, bank_last4: input.accountNumber.slice(-4), bank_ifsc: input.ifsc, bank_fingerprint: await bankFingerprint(input.accountNumber, input.ifsc), beneficiary_name: input.accountName, terms_accepted_at: now });
    await razorpayRequest(`${base}/products/${encodeURIComponent(row.product_id)}`, 'PATCH', { settlements: { account_number: input.accountNumber, ifsc_code: input.ifsc, beneficiary_name: input.accountName }, tnc_accepted: true });
    await save({ setup_state: 'submitted', last_error_code: null });
    const { error: syncError } = await admin.from('seller_profiles').update({ razorpay_linked_account_id: row.linked_account_id }).eq('id', seller.id);
    if (syncError) throw new RouteSetupError('Payout details were submitted; the seller profile needs refresh.');
    const { account, ready } = await refreshPayoutAccount(seller.id);
    return json({ account: publicAccount(account), ready, message: ready ? 'Razorpay has activated this payout bank.' : 'Submitted to Razorpay. Checkout remains unavailable until verification is complete.' });
  } catch (error) { return fail(error); }
  finally { if (release) await release(); }
}
