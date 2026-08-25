import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rupeesToPaise } from '@/lib/razorpayIntegrity';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderType = 'bulk' | 'catalog';
type RequestBody = { orderId?: string; orderType?: OrderType };

class RazorpayOrderError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'RAZORPAY_ORDER_FAILED') {
    super(message);
    this.name = 'RazorpayOrderError';
    this.status = status;
    this.code = code;
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const safeRate = (raw: string | undefined, fallback: number, maximum: number) => {
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) && value >= 0 && value <= maximum ? value : fallback;
};

async function createRazorpayOrder(input: {
  keyId: string;
  keySecret: string;
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
  transferAccount?: string | null;
  transferAmountPaise?: number;
}) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
    throw new RazorpayOrderError(
      'The payment amount must be at least 100 paise.',
      400,
      'AMOUNT_BELOW_MINIMUM'
    );
  }

  const payload: Record<string, unknown> = {
    amount: input.amountPaise,
    currency: 'INR',
    receipt: input.receipt.slice(0, 40),
    notes: input.notes,
  };
  if (input.transferAccount && Number(input.transferAmountPaise || 0) > 0) {
    payload.transfers = [
      {
        account: input.transferAccount,
        amount: input.transferAmountPaise,
        currency: 'INR',
        on_hold: true,
      },
    ];
  }

  let response: Response;
  try {
    response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${input.keyId}:${input.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new RazorpayOrderError(
      error instanceof Error && error.name === 'TimeoutError' ?'Razorpay did not respond in time. Please retry.' :'Razorpay could not be reached. Please retry.',
      500,
      'RAZORPAY_UNREACHABLE'
    );
  }

  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    error?: { code?: string; description?: string };
  };
  if (response.status === 401) {
    throw new RazorpayOrderError(
      'Razorpay authentication failed. The server payment credentials are invalid or were revoked.',
      503,
      'RAZORPAY_AUTH_FAILED'
    );
  }
  if (!response.ok || !result.id) {
    throw new RazorpayOrderError(
      result.error?.description || 'Razorpay could not create the payment order.',
      500,
      result.error?.code || 'RAZORPAY_ORDER_FAILED'
    );
  }
  if (result.currency !== 'INR' || Number(result.amount) !== input.amountPaise) {
    throw new RazorpayOrderError(
      'Razorpay returned an unexpected amount or currency.',
      500,
      'RAZORPAY_ORDER_MISMATCH'
    );
  }
  return result;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);

  const [buyerAccessResult, buyerProfileResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('role,is_active,can_buy')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('buyer_profiles')
      .select('id,is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ]);
  if (buyerAccessResult.error || buyerProfileResult.error) {
    return json({ error: 'Buyer payment access could not be checked.' }, 503);
  }
  const buyerAccess = buyerAccessResult.data;
  if (
    !buyerAccess ||
    buyerAccess.is_active !== true ||
    buyerAccess.role !== 'buyer' ||
    buyerAccess.can_buy === false ||
    !buyerProfileResult.data?.id
  ) {
    return json(
      {
        error: 'Buyer workspace access is required for payment.',
        code: 'BUYER_ACCESS_REQUIRED',
      },
      403
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return json({ error: 'Invalid payment request.' }, 400);
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const orderType: OrderType = body.orderType === 'catalog' ? 'catalog' : 'bulk';
  if (!orderId) return json({ error: 'Order reference is required.' }, 400);

  const credentials = await getRazorpayCredentials();
  if (!credentials) {
    return json(
      { error: 'Payment service is temporarily unavailable.', code: 'PAYMENT_SERVICE_UNAVAILABLE' },
      503
    );
  }
  const { keyId, keySecret } = credentials;

  const admin = createAdminClient();
  const paymentTable = orderType === 'catalog' ? 'catalog_order_payments' : 'bulk_order_payments';
  const orderForeignKey = orderType === 'catalog' ? 'catalog_order_id' : 'bulk_order_id';

  const catalogOrderResult =
    orderType === 'catalog'
      ? await admin
          .from('catalog_order_requests')
          .select(
            'id,buyer_id,seller_id,status,total_amount,payment_terms,deposit_percent,payment_status,amount_paid,amount_refunded,payment_due_at'
          )
          .eq('id', orderId)
          .eq('buyer_id', user.id)
          .maybeSingle()
      : null;
  const bulkOrderResult =
    orderType === 'bulk'
      ? await admin
          .from('bulk_orders')
          .select(
            'id,buyer_id,seller_id,status,net_total,payment_status,amount_paid,amount_refunded'
          )
          .eq('id', orderId)
          .eq('buyer_id', user.id)
          .maybeSingle()
      : null;
  const orderError = catalogOrderResult?.error || bulkOrderResult?.error;
  const order = (catalogOrderResult?.data || bulkOrderResult?.data || null) as Record<
    string,
    unknown
  > | null;
  if (orderError) return json({ error: 'The order could not be loaded.' }, 503);
  if (!order) return json({ error: 'Order not found.' }, 404);

  const status = String(order.status || '');
  const payableStatuses = orderType === 'catalog' ? ['accepted', 'paid'] : ['confirmed', 'paid'];
  if (!payableStatuses.includes(status)) {
    return json({ error: 'This order is not currently ready for payment.' }, 409);
  }
  if (!order.seller_id) {
    return json({ error: 'A seller must confirm the order before payment.' }, 409);
  }

  const totalAmount = roundMoney(
    Number(orderType === 'catalog' ? order.total_amount : order.net_total || 0)
  );
  const amountPaid = roundMoney(Number(order.amount_paid || 0));
  const amountRefunded = roundMoney(Number(order.amount_refunded || 0));
  const netPaid = Math.max(0, roundMoney(amountPaid - amountRefunded));
  const remaining = Math.max(0, roundMoney(totalAmount - netPaid));
  if (!(totalAmount > 0)) return json({ error: 'Order total is invalid.' }, 409);
  if (remaining < 0.01) {
    return json({ error: 'This order is already fully paid.', code: 'ORDER_ALREADY_PAID' }, 409);
  }

  const depositPercent =
    orderType === 'catalog'
      ? Math.max(0, Math.min(100, Number(order.deposit_percent || 0)))
      : 100;
  const firstPayment = netPaid < 0.01;
  const requestedDeposit = firstPayment && depositPercent > 0 && depositPercent < 100;
  const amountDue = roundMoney(
    requestedDeposit
      ? Math.min(remaining, Math.max(0.01, totalAmount * (depositPercent / 100)))
      : remaining
  );
  const amountPaise = rupeesToPaise(amountDue);
  if (amountPaise < 100) {
    return json(
      { error: 'The amount due is below the supported minimum.', code: 'AMOUNT_BELOW_MINIMUM' },
      400
    );
  }

  const { data: seller, error: sellerError } = await admin
    .from('seller_profiles')
    .select(
      'id,is_active,verification_status,gstin_verified,settlement_eligible,razorpay_linked_account_id'
    )
    .eq('id', order.seller_id)
    .maybeSingle();
  if (sellerError) {
    return json({ error: 'Seller payment eligibility could not be checked.' }, 503);
  }
  const sellerEligible =
    seller?.is_active === true &&
    seller?.gstin_verified === true &&
    ['approved', 'verified', 'active'].includes(
      String(seller?.verification_status || '').toLowerCase()
    );
  if (!sellerEligible) {
    return json(
      { error: 'The seller is not currently eligible to receive marketplace payments.' },
      409
    );
  }

  const { data: existing } = await admin
    .from(paymentTable)
    .select('id,razorpay_order_id,amount,currency,status')
    .eq(orderForeignKey, orderId)
    .in('status', ['initiated', 'authorized'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    existing?.razorpay_order_id &&
    Number(existing.amount) === amountDue &&
    existing.currency === 'INR'
  ) {
    return json({
      keyId,
      razorpayOrderId: existing.razorpay_order_id,
      amount: amountPaise,
      amountRupees: amountDue,
      currency: 'INR',
      orderType,
      orderId,
      paymentPurpose: requestedDeposit ? 'deposit' : firstPayment ? 'full' : 'balance',
      fullOrderAmount: totalAmount,
      remainingAfterPayment: roundMoney(remaining - amountDue),
      reused: true,
    });
  }
  if (existing?.id) {
    await admin
      .from(paymentTable)
      .update({
        status: 'failed',
        failure_reason: 'Superseded because the server-calculated amount due changed.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  }

  const commissionRate = safeRate(process.env.PLATFORM_COMMISSION_RATE, 0.1, 0.5);
  const commissionGstRate = safeRate(process.env.PLATFORM_COMMISSION_GST_RATE, 0.18, 0.5);
  const estimatedProcessingRate = safeRate(process.env.RAZORPAY_PROCESSING_RATE, 0.02, 0.1);
  const platformCommission = roundMoney(amountDue * commissionRate);
  const gstOnCommission = roundMoney(platformCommission * commissionGstRate);
  const estimatedProcessingFee = roundMoney(amountDue * estimatedProcessingRate);
  const sellerPayable = Math.max(
    0,
    roundMoney(amountDue - platformCommission - gstOnCommission - estimatedProcessingFee)
  );

  const routeEnabled =
    seller.settlement_eligible === true && Boolean(seller.razorpay_linked_account_id);
  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder({
      keyId,
      keySecret,
      amountPaise,
      receipt: `FT-${orderType}-${orderId}`,
      notes: {
        fabrictrad_order_id: orderId,
        fabrictrad_order_type: orderType,
        buyer_id: user.id,
        seller_id: String(order.seller_id),
        payment_purpose: requestedDeposit ? 'deposit' : firstPayment ? 'full' : 'balance',
      },
      transferAccount: routeEnabled ? seller.razorpay_linked_account_id : null,
      transferAmountPaise: routeEnabled ? rupeesToPaise(sellerPayable) : 0,
    });
  } catch (error) {
    const providerError =
      error instanceof RazorpayOrderError
        ? error
        : new RazorpayOrderError('Payment order creation failed.');
    return json(
      { error: providerError.message, code: providerError.code },
      providerError.status
    );
  }

  const paymentPayload: Record<string, unknown> = {
    [orderForeignKey]: orderId,
    razorpay_order_id: razorpayOrder.id,
    amount: amountDue,
    currency: 'INR',
    status: 'initiated',
    platform_commission: platformCommission,
    razorpay_fee: estimatedProcessingFee,
    gst_on_commission: gstOnCommission,
    seller_payable: sellerPayable,
    transfer_status: routeEnabled ? 'created_on_hold' : 'not_configured',
    updated_at: new Date().toISOString(),
  };
  const { error: insertError } = await admin.from(paymentTable).insert(paymentPayload);
  if (insertError) {
    console.error('Failed to persist Razorpay order', {
      table: paymentTable,
      orderId,
      code: insertError.code,
      message: insertError.message,
    });
    return json({ error: 'The payment order could not be recorded safely. Please retry.' }, 503);
  }

  return json({
    keyId,
    razorpayOrderId: razorpayOrder.id,
    amount: amountPaise,
    amountRupees: amountDue,
    currency: 'INR',
    orderType,
    orderId,
    paymentPurpose: requestedDeposit ? 'deposit' : firstPayment ? 'full' : 'balance',
    fullOrderAmount: totalAmount,
    remainingAfterPayment: roundMoney(remaining - amountDue),
    reused: false,
  });
}
