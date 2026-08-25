import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isConfiguredAdminEmail } from '@/lib/adminAccess';
import { rupeesToPaise } from '@/lib/razorpayIntegrity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PaymentKind = 'catalog' | 'bulk';
type PaymentRow = Record<string, unknown> & { id: string };

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const numberValue = (value: unknown) => Number(value || 0);
const roundMoney = (value: number) => Math.round(value * 100) / 100;

async function requireAdministrator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isConfiguredAdminEmail(user.email)) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active')
    .eq('id', user.id)
    .maybeSingle();
  const authorised =
    profile?.is_active === true &&
    (profile.role === 'super_admin' || profile.role === 'admin_staff');
  return authorised ? user : null;
}

async function loadPayments(admin: ReturnType<typeof createAdminClient>) {
  const paymentSelect =
    'id,razorpay_order_id,razorpay_payment_id,amount,captured_amount,refunded_amount,currency,status,platform_commission,razorpay_fee,razorpay_fee_actual,razorpay_tax_actual,gst_on_commission,seller_payable,razorpay_transfer_id,transfer_status,payment_method,failure_reason,captured_at,created_at,updated_at,refund_requested_amount,refund_status,last_refund_request_id,refund_reason,last_webhook_event,last_webhook_at';
  const [catalogResult, bulkResult] = await Promise.all([
    admin
      .from('catalog_order_payments')
      .select(`catalog_order_id,${paymentSelect}`)
      .order('created_at', { ascending: false })
      .limit(250),
    admin
      .from('bulk_order_payments')
      .select(`bulk_order_id,${paymentSelect}`)
      .order('created_at', { ascending: false })
      .limit(250),
  ]);
  const queryError = catalogResult.error || bulkResult.error;
  if (queryError) throw queryError;

  const catalogPayments = (catalogResult.data || []) as PaymentRow[];
  const bulkPayments = (bulkResult.data || []) as PaymentRow[];
  const catalogIds = catalogPayments.map((row) => String(row.catalog_order_id));
  const bulkIds = bulkPayments.map((row) => String(row.bulk_order_id));

  const [catalogOrdersResult, bulkOrdersResult] = await Promise.all([
    catalogIds.length
      ? admin
          .from('catalog_order_requests')
          .select('id,buyer_id,seller_id,status,payment_status,total_amount,created_at')
          .in('id', catalogIds)
      : Promise.resolve({ data: [], error: null }),
    bulkIds.length
      ? admin
          .from('bulk_orders')
          .select(
            'id,buyer_id,seller_id,status,payment_status,net_total,buyer_name,buyer_email,buyer_company,created_at'
          )
          .in('id', bulkIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (catalogOrdersResult.error || bulkOrdersResult.error) {
    throw catalogOrdersResult.error || bulkOrdersResult.error;
  }

  const catalogOrders = new Map(
    (catalogOrdersResult.data || []).map((order) => [String(order.id), order])
  );
  const bulkOrders = new Map((bulkOrdersResult.data || []).map((order) => [String(order.id), order]));
  const buyerIds = new Set<string>();
  const sellerIds = new Set<string>();
  [...catalogOrders.values(), ...bulkOrders.values()].forEach((order) => {
    if (order.buyer_id) buyerIds.add(String(order.buyer_id));
    if (order.seller_id) sellerIds.add(String(order.seller_id));
  });

  const [buyersResult, sellersResult] = await Promise.all([
    buyerIds.size
      ? admin
          .from('user_profiles')
          .select('id,full_name,email,business_name')
          .in('id', [...buyerIds])
      : Promise.resolve({ data: [], error: null }),
    sellerIds.size
      ? admin
          .from('seller_profiles')
          .select('id,user_id,legal_business_name,display_name,gstin')
          .in('id', [...sellerIds])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (buyersResult.error || sellersResult.error) throw buyersResult.error || sellersResult.error;

  const buyers = new Map((buyersResult.data || []).map((profile) => [String(profile.id), profile]));
  const sellers = new Map((sellersResult.data || []).map((profile) => [String(profile.id), profile]));

  const normalize = (row: PaymentRow, kind: PaymentKind) => {
    const orderId = String(kind === 'catalog' ? row.catalog_order_id : row.bulk_order_id);
    const order = kind === 'catalog' ? catalogOrders.get(orderId) : bulkOrders.get(orderId);
    const buyer = order?.buyer_id ? buyers.get(String(order.buyer_id)) : null;
    const seller = order?.seller_id ? sellers.get(String(order.seller_id)) : null;
    const bulkOrder = kind === 'bulk'
      ? (order as { buyer_company?: string | null; buyer_name?: string | null; buyer_email?: string | null } | undefined)
      : undefined;
    const captured = numberValue(row.captured_amount ?? row.amount);
    const refunded = numberValue(row.refunded_amount);
    const requestedRefund = numberValue(row.refund_requested_amount);
    return {
      id: row.id,
      kind,
      orderId,
      orderReference: `${kind === 'catalog' ? 'FT-CAT' : 'FT-BULK'}-${orderId.slice(0, 8).toUpperCase()}`,
      orderStatus: order?.status || 'unknown',
      orderPaymentStatus: order?.payment_status || 'unknown',
      buyer: {
        id: order?.buyer_id || null,
        name:
          buyer?.business_name ||
          buyer?.full_name ||
          bulkOrder?.buyer_company ||
          bulkOrder?.buyer_name ||
          'Buyer account',
        email: buyer?.email || bulkOrder?.buyer_email || null,
      },
      seller: {
        id: order?.seller_id || null,
        name: seller?.display_name || seller?.legal_business_name || 'Seller account',
        gstin: seller?.gstin || null,
      },
      amount: numberValue(row.amount),
      capturedAmount: captured,
      refundedAmount: refunded,
      refundableAmount: Math.max(0, roundMoney(captured - refunded - requestedRefund)),
      refundRequestedAmount: requestedRefund,
      refundStatus: row.refund_status || 'none',
      refundRequestId: row.last_refund_request_id || null,
      refundReason: row.refund_reason || null,
      currency: row.currency || 'INR',
      status: row.status || 'initiated',
      paymentMethod: row.payment_method || null,
      razorpayOrderId: row.razorpay_order_id || null,
      razorpayPaymentId: row.razorpay_payment_id || null,
      platformCommission: numberValue(row.platform_commission),
      estimatedProcessingFee: numberValue(row.razorpay_fee),
      actualProcessingFee: numberValue(row.razorpay_fee_actual),
      actualProcessingTax: numberValue(row.razorpay_tax_actual),
      gstOnCommission: numberValue(row.gst_on_commission),
      sellerPayable: numberValue(row.seller_payable),
      transferId: row.razorpay_transfer_id || null,
      transferStatus: row.transfer_status || 'not_configured',
      failureReason: row.failure_reason || null,
      capturedAt: row.captured_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastWebhookEvent: row.last_webhook_event || null,
      lastWebhookAt: row.last_webhook_at || null,
    };
  };

  return [
    ...catalogPayments.map((row) => normalize(row, 'catalog')),
    ...bulkPayments.map((row) => normalize(row, 'bulk')),
  ].sort(
    (a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
  );
}

export async function GET() {
  const administrator = await requireAdministrator();
  if (!administrator) return json({ error: 'Administrator access required.' }, 403);
  try {
    const payments = await loadPayments(createAdminClient());
    return json({ generatedAt: new Date().toISOString(), payments });
  } catch (error) {
    console.error('Admin payment ledger failed:', error);
    return json({ error: 'The live marketplace payment ledger could not be loaded.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  const administrator = await requireAdministrator();
  if (!administrator) return json({ error: 'Administrator access required.' }, 403);

  let body: { kind?: unknown; paymentId?: unknown; amount?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid refund request.' }, 400);
  }
  const kind: PaymentKind | null = body.kind === 'catalog' || body.kind === 'bulk' ? body.kind : null;
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : '';
  const amount = roundMoney(Number(body.amount));
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!kind || !paymentId || !Number.isFinite(amount) || amount < 1 || !reason) {
    return json({ error: 'Order kind, payment, refund amount and reason are required.' }, 400);
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    return json({ error: 'Refund service is temporarily unavailable.' }, 503);
  }

  const requestKey = crypto
    .createHash('sha256')
    .update(`${kind}|${paymentId}|${amount.toFixed(2)}`)
    .digest('hex')
    .slice(0, 32);
  const admin = createAdminClient();
  const { data: locked, error: lockError } = await admin.rpc('begin_marketplace_refund', {
    p_order_kind: kind,
    p_payment_id: paymentId,
    p_amount: amount,
    p_reason: reason,
    p_request_key: requestKey,
  });
  if (lockError || !locked) {
    const message = lockError?.message || 'The refund request could not be reserved.';
    return json({ error: message }, /already|exceeds|captured|fully/i.test(message) ? 409 : 400);
  }

  const refundRequest = locked as {
    razorpayPaymentId: string;
    amount: number;
    requestKey: string;
    reused?: boolean;
  };
  const receipt = `FT_RF_${kind}_${paymentId.replaceAll('-', '').slice(0, 12)}_${requestKey.slice(0, 8)}`;
  try {
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        refundRequest.razorpayPaymentId
      )}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'X-Refund-Idempotency': requestKey,
        },
        body: JSON.stringify({
          amount: rupeesToPaise(refundRequest.amount),
          speed: 'normal',
          receipt,
          notes: {
            fabrictrad_payment_id: paymentId,
            fabrictrad_order_kind: kind,
            authorised_by: administrator.id,
            reason: reason.slice(0, 480),
          },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      }
    );
    const result = (await response.json().catch(() => ({}))) as {
      id?: string;
      status?: 'pending' | 'processed' | 'failed';
      amount?: number;
      payment_id?: string;
      error?: { description?: string };
    };
    if (!response.ok || !result.id) {
      throw new Error(result.error?.description || 'Razorpay rejected the refund request.');
    }
    if (
      result.payment_id !== refundRequest.razorpayPaymentId ||
      Number(result.amount) !== rupeesToPaise(refundRequest.amount)
    ) {
      throw new Error('Razorpay returned a different payment or refund amount.');
    }

    const outcome = result.status === 'failed' ? 'failed' : result.status === 'processed' ? 'processed' : 'requested';
    await admin.rpc('finish_marketplace_refund_request', {
      p_order_kind: kind,
      p_payment_id: paymentId,
      p_request_key: requestKey,
      p_refund_id: result.id,
      p_outcome: outcome,
      p_error: result.status === 'failed' ? 'Razorpay reported refund failure.' : null,
    });

    return json(
      {
        refundId: result.id,
        status: result.status || 'pending',
        amount: refundRequest.amount,
        message:
          result.status === 'processed' ?'Refund processed. The signed webhook will reconcile the final ledger.' :'Refund requested. Final status will be confirmed by Razorpay webhook.',
      },
      202
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refund initiation failed.';
    await admin.rpc('finish_marketplace_refund_request', {
      p_order_kind: kind,
      p_payment_id: paymentId,
      p_request_key: requestKey,
      p_refund_id: null,
      p_outcome: 'failed',
      p_error: message,
    });
    return json({ error: message }, 502);
  }
}
