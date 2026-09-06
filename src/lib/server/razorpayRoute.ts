import { getRazorpayCredentials } from '@/lib/razorpayCredentials';
import { createHmac } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export class RouteSetupError extends Error {
  constructor(message: string, public status = 503, public code = 'SELLER_PAYOUT_UNAVAILABLE') { super(message); }
}

export type RouteProduct = {
  id?: string; account_id?: string; product_name?: string; activation_status?: string;
  active_configuration?: { settlements?: { account_number?: string; ifsc_code?: string; beneficiary_name?: string } };
  requirements?: { field_reference?: string; reason_code?: string; status?: string }[];
};

export async function razorpayRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const credentials = await getRazorpayCredentials();
  if (!credentials) throw new RouteSetupError('Razorpay is not configured. Please contact FabricTrad.', 503, 'RAZORPAY_NOT_CONFIGURED');
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com${path}`, {
      method, headers: { Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new RouteSetupError('Razorpay did not confirm the request. Refresh the payout status before trying again.', 503, 'RAZORPAY_RESULT_UNCERTAIN');
  }
  const result = await response.json().catch(() => null);
  // Provider errors can echo bank/PAN values. Never log or return the raw response.
  if (!response.ok || !result) {
    const rejected = response.status >= 400 && response.status < 500;
    throw new RouteSetupError(
      response.status === 401 || response.status === 403 ? 'Razorpay Route access needs attention from FabricTrad.' : rejected ? 'Razorpay rejected these details. Check the legal name, PAN, business address and bank details.' : 'Razorpay could not confirm this request. Refresh the payout status.',
      rejected ? 422 : 503, rejected ? 'RAZORPAY_DETAILS_REJECTED' : 'RAZORPAY_RESULT_UNCERTAIN'
    );
  }
  return result as T;
}

export const payoutReference = (sellerId: string) => `ft_${sellerId.replace(/-/g, '').slice(0, 17)}`;

export async function bankFingerprint(account: string, ifsc: string) {
  const keys = await getRazorpayCredentials();
  if (!keys) throw new RouteSetupError('Razorpay is not configured.');
  return createHmac('sha256', keys.keySecret).update(`fabrictrad-bank-v1:${ifsc}:${account}`).digest('hex');
}

export function activeRouteProduct(product: RouteProduct, accountId: string, productId: string): boolean {
  const bank = product.active_configuration?.settlements;
  return product.id === productId && product.account_id === accountId && product.product_name === 'route' &&
    product.activation_status === 'activated' && Boolean(bank?.account_number && bank?.ifsc_code && bank?.beneficiary_name) &&
    !(product.requirements || []).some(r => r.status !== 'resolved');
}

export async function refreshPayoutAccount(sellerId: string) {
  const admin = createAdminClient();
  const { data: account, error } = await admin.from('seller_payout_accounts').select('*').eq('seller_id', sellerId).maybeSingle();
  if (error) throw new RouteSetupError('Seller payout status could not be loaded.');
  if (!account?.linked_account_id || !account?.product_id) return { account, ready: false };
  const base = `/v2/accounts/${encodeURIComponent(account.linked_account_id)}`;
  const [product, linkedAccount] = await Promise.all([
    razorpayRequest<RouteProduct>(`${base}/products/${encodeURIComponent(account.product_id)}`),
    razorpayRequest<{ id: string; type: string; status: string }>(base),
  ]);
  if (product.id !== account.product_id || product.account_id !== account.linked_account_id || product.product_name !== 'route') {
    throw new RouteSetupError('Razorpay returned an unexpected payout account.', 503, 'PAYOUT_IDENTITY_MISMATCH');
  }
  const bank = product.active_configuration?.settlements;
  // Activation must refer to the bank submitted by this seller, not a previous settlement account.
  const bankMatches = typeof bank?.account_number === 'string' && Boolean(bank?.ifsc_code) &&
    account.bank_fingerprint === await bankFingerprint(bank.account_number, bank.ifsc_code!);
  const ready = linkedAccount.id === account.linked_account_id && linkedAccount.type === 'route' && linkedAccount.status === 'created' && account.setup_state === 'submitted' && bankMatches && activeRouteProduct(product, account.linked_account_id, account.product_id);
  const patch = {
    activation_status: ready ? 'activated' : (product.activation_status === 'activated' ? 'bank_verification_pending' : product.activation_status || 'pending'),
    requirements: (product.requirements || []).map(r => ({ field: String(r.field_reference || '').slice(0, 180), reason: String(r.reason_code || '').slice(0, 100), status: String(r.status || '').slice(0, 40) })),
    verified_at: ready ? account.verified_at || new Date().toISOString() : null,
    checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const { data: saved, error: saveError } = await admin.from('seller_payout_accounts').update(patch).eq('seller_id', sellerId).eq('linked_account_id', account.linked_account_id).eq('product_id', account.product_id).eq('bank_fingerprint', account.bank_fingerprint).eq('setup_state', account.setup_state).select('seller_id').maybeSingle();
  if (saveError || !saved) throw new RouteSetupError('Payout details changed during verification. Please retry.');
  return { account: { ...account, ...patch }, ready };
}

export async function requireSellerPayout(sellerId: string): Promise<string> {
  const { account, ready } = await refreshPayoutAccount(sellerId);
  if (!ready || !account?.linked_account_id) {
    throw new RouteSetupError('This seller must complete Razorpay bank verification before payment can be accepted. No payment has been taken.', 409, 'SELLER_PAYOUT_NOT_READY');
  }
  return account.linked_account_id as string;
}
