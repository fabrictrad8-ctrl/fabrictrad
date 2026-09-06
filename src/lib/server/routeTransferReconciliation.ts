import { createAdminClient } from '@/lib/supabase/admin';
import { razorpayRequest } from '@/lib/server/razorpayRoute';

type Transfer = { id: string; source: string; recipient: string; amount: number; currency: string; status: string; amount_reversed?: number; on_hold?: boolean | number; settlement_status?: string; recipient_settlement_id?: string | null };

export function transferState(transfer: Transfer) {
  if (Number(transfer.amount_reversed || 0) >= transfer.amount && transfer.amount > 0) return 'reversed';
  if (Number(transfer.amount_reversed || 0) > 0) return 'partially_reversed';
  if (transfer.status === 'failed') return 'failed';
  if (transfer.status === 'processed' && transfer.settlement_status === 'settled' && transfer.recipient_settlement_id) return 'settled';
  if (transfer.on_hold === true || transfer.on_hold === 1) return 'on_hold';
  if (!['created', 'pending', 'processed', 'reversed'].includes(transfer.status)) throw new Error('Unknown Razorpay transfer state.');
  return transfer.status;
}

export async function reconcileRouteTransfer(transferId: string) {
  if (!/^trf_[a-zA-Z0-9]+$/.test(transferId)) throw new Error('Invalid transfer reference.');
  // Read the current entity instead of trusting an old or out-of-order webhook snapshot.
  const checkedAt = new Date().toISOString();
  const transfer = await razorpayRequest<Transfer>(`/v1/transfers/${encodeURIComponent(transferId)}`);
  if (transfer.id !== transferId || !/^(pay|order)_[a-zA-Z0-9]+$/.test(transfer.source)) throw new Error('Transfer identity mismatch.');
  const admin = createAdminClient();
  let sourceOrderId = transfer.source;
  if (transfer.source.startsWith('pay_')) {
    const payment = await razorpayRequest<{ id: string; order_id: string }>(`/v1/payments/${encodeURIComponent(transfer.source)}`);
    if (payment.id !== transfer.source || !/^order_[a-zA-Z0-9]+$/.test(payment.order_id)) throw new Error('Transfer payment identity mismatch.');
    sourceOrderId = payment.order_id;
  }
  for (const [kind, table] of [['catalog', 'catalog_order_payments'], ['bulk', 'bulk_order_payments'], ['bespoke', 'bespoke_payments']] as const) {
    const { data: row, error } = await admin.from(table).select('id,transfer_account_id,transfer_amount_paise,razorpay_payment_id').eq('razorpay_order_id', sourceOrderId).maybeSingle();
    if (error) throw error;
    if (!row) continue;
    if (row.transfer_account_id !== transfer.recipient || Number(row.transfer_amount_paise) !== transfer.amount || transfer.currency !== 'INR') throw new Error('Transfer recipient or amount does not match the saved seller allocation.');
    // A transfer webhook can arrive before capture reconciliation. Return an error
    // so Razorpay retries; never acknowledge an unrecorded seller transfer.
    if (transfer.source.startsWith('pay_') && row.razorpay_payment_id !== transfer.source) throw new Error('Payment capture reconciliation is still pending.');
    const { error: reconcileError } = await admin.rpc('reconcile_marketplace_route_transfer', {
      p_kind: kind, p_payment_id: row.id, p_transfer_id: transfer.id, p_source: transfer.source, p_account: transfer.recipient,
      p_amount: transfer.amount, p_currency: transfer.currency, p_status: transferState(transfer),
      p_reversed: Number(transfer.amount_reversed || 0), p_settlement_id: transfer.recipient_settlement_id || null, p_checked_at: checkedAt,
    });
    if (reconcileError) throw reconcileError;
    return true;
  }
  return false;
}
