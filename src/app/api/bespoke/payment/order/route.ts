import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';
import { rupeesToPaise } from '@/lib/razorpayIntegrity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const authorization = (keyId: string, keySecret: string) =>
  `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

type ProviderOrder = {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: { description?: string };
};

async function inspectProviderOrder(
  keyId: string,
  keySecret: string,
  providerOrderId: string
): Promise<ProviderOrder | null> {
  const response = await fetch(
    `https://api.razorpay.com/v1/orders/${encodeURIComponent(providerOrderId)}`,
    {
      headers: { Authorization: authorization(keyId, keySecret), Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    }
  ).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json().catch(() => ({}))) as ProviderOrder;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Authentication required.' }, 401);

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    choice?: 'advance' | 'full';
  };
  const orderId = String(body.orderId || '').trim();
  const choice = body.choice === 'advance' ? 'advance' : 'full';
  if (!orderId) return json({ error: 'Custom order is required.' }, 400);

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from('bespoke_orders')
    .select('id,user_id,stage,quoted_amount,advance_amount,paid_amount,balance_amount,payment_status')
    .eq('id', orderId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (orderError) return json({ error: 'Custom order could not be loaded.' }, 503);
  if (!order) return json({ error: 'Custom order not found.' }, 404);
  if (!['advance_or_full_payment', 'balance_payment'].includes(String(order.stage))) {
    return json({ error: 'This custom order is not ready for payment.' }, 409);
  }

  const quoted = roundMoney(Number(order.quoted_amount || 0));
  const paid = roundMoney(Number(order.paid_amount || 0));
  const remaining = Math.max(0, roundMoney(quoted - paid));
  if (!(quoted > 0) || remaining < 0.01) {
    return json({ error: 'There is no payable balance on this order.' }, 409);
  }

  let due = remaining;
  let purpose: 'advance' | 'full' | 'balance' =
    order.stage === 'balance_payment' ? 'balance' : 'full';
  if (order.stage === 'advance_or_full_payment' && choice === 'advance') {
    const configuredAdvance = roundMoney(Number(order.advance_amount || 0));
    if (!(configuredAdvance > 0) || configuredAdvance >= quoted) {
      return json(
        {
          error:
            'An advance amount has not been configured for this quotation. Pay in full or contact FabricTrad.',
        },
        409
      );
    }
    due = Math.min(remaining, configuredAdvance);
    purpose = 'advance';
  }

  const credentials = await getRazorpayCredentials();
  if (!credentials) return json({ error: 'Payment service is temporarily unavailable.' }, 503);
  const amountPaise = rupeesToPaise(due);
  if (amountPaise < 100) {
    return json({ error: 'Payment amount is below the supported minimum.' }, 400);
  }

  const { data: activePayment } = await admin
    .from('bespoke_payments')
    .select('id,razorpay_order_id,razorpay_payment_id,payment_purpose,amount,currency,status,created_at')
    .eq('bespoke_order_id', orderId)
    .in('status', ['initiated', 'authorized'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activePayment?.id) {
    if (activePayment.status === 'authorized') {
      return json(
        {
          error:
            'Razorpay has authorized the active payment and capture is still pending. FabricTrad will not open a second checkout until that payment is resolved.',
          code: 'PAYMENT_CAPTURE_PENDING',
          razorpayPaymentId: activePayment.razorpay_payment_id || null,
        },
        409
      );
    }

    const sameIntent =
      activePayment.payment_purpose === purpose &&
      activePayment.currency === 'INR' &&
      roundMoney(Number(activePayment.amount)) === due;
    if (!sameIntent) {
      return json(
        {
          error:
            'Another payment session is already active for this custom order. Finish that checkout before changing between advance and full payment.',
          code: 'PAYMENT_SESSION_ACTIVE',
        },
        409
      );
    }

    const providerOrderId = String(activePayment.razorpay_order_id || '');
    if (providerOrderId.startsWith('pending_')) {
      const ageMs = Date.now() - new Date(activePayment.created_at).getTime();
      if (ageMs < 2 * 60 * 1000) {
        return json(
          { error: 'The payment session is being prepared. Retry in a moment.', code: 'PAYMENT_SESSION_PREPARING' },
          409
        );
      }
      await admin
        .from('bespoke_payments')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          provider_status: 'reservation_timeout',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activePayment.id);
    } else {
      const provider = await inspectProviderOrder(
        credentials.keyId,
        credentials.keySecret,
        providerOrderId
      );
      const providerStatus = String(provider?.status || '').toLowerCase();
      if (
        provider?.id === providerOrderId &&
        provider.currency === 'INR' &&
        Number(provider.amount) === amountPaise &&
        ['created', 'attempted'].includes(providerStatus)
      ) {
        await admin
          .from('bespoke_orders')
          .update({
            razorpay_order_id: providerOrderId,
            payment_choice: choice,
            payment_status: 'payment_link_created',
            balance_amount: remaining,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);
        return json({
          keyId: credentials.keyId,
          razorpayOrderId: providerOrderId,
          amount: amountPaise,
          amountRupees: due,
          currency: 'INR',
          orderId,
          purpose,
          remainingBeforePayment: remaining,
          reused: true,
        });
      }
      if (providerStatus === 'paid') {
        return json(
          {
            error:
              'Razorpay already reports the active payment order as paid. Payment reconciliation is in progress; refresh the custom order shortly.',
            code: 'PAYMENT_RECONCILIATION_PENDING',
          },
          409
        );
      }
      await admin
        .from('bespoke_payments')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          provider_status: providerStatus || 'provider_order_unavailable',
          provider_payload: provider || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', activePayment.id);
    }
  }

  const reservationId = `pending_${randomUUID()}`;
  const { data: reservation, error: reservationError } = await admin
    .from('bespoke_payments')
    .insert({
      bespoke_order_id: orderId,
      user_id: auth.user.id,
      razorpay_order_id: reservationId,
      payment_purpose: purpose,
      amount: due,
      currency: 'INR',
      status: 'initiated',
      provider_status: 'reserving',
    })
    .select('id')
    .single();
  if (reservationError || !reservation?.id) {
    if (reservationError?.code === '23505') {
      return json(
        { error: 'A payment session is already active. Retry the existing checkout.', code: 'PAYMENT_SESSION_ACTIVE' },
        409
      );
    }
    return json({ error: 'Payment session could not be reserved.' }, 503);
  }

  const providerResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authorization(credentials.keyId, credentials.keySecret),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: `besp_${orderId.replace(/-/g, '').slice(0, 12)}_${purpose}_${Date.now().toString().slice(-6)}`.slice(0, 40),
      notes: {
        fabrictrad_order_type: 'bespoke',
        fabrictrad_bespoke_order_id: orderId,
        fabrictrad_payment_purpose: purpose,
        fabrictrad_user_id: auth.user.id,
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);

  const provider = providerResponse
    ? ((await providerResponse.json().catch(() => ({}))) as ProviderOrder)
    : null;
  if (
    !providerResponse?.ok ||
    !provider?.id ||
    provider.amount !== amountPaise ||
    provider.currency !== 'INR'
  ) {
    await admin
      .from('bespoke_payments')
      .update({
        status: 'failed',
        failed_at: new Date().toISOString(),
        provider_status: providerResponse ? `provider_${providerResponse.status}` : 'provider_unreachable',
        provider_payload: provider || {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservation.id);
    return json(
      { error: provider?.error?.description || 'Razorpay could not create this payment.' },
      503
    );
  }

  const now = new Date().toISOString();
  const { error: ledgerError } = await admin
    .from('bespoke_payments')
    .update({
      razorpay_order_id: provider.id,
      provider_status: provider.status || 'created',
      provider_payload: provider,
      updated_at: now,
    })
    .eq('id', reservation.id);
  if (ledgerError) {
    return json(
      { error: 'Razorpay created the payment, but FabricTrad could not persist the provider reference.' },
      500
    );
  }

  const { error: saveError } = await admin
    .from('bespoke_orders')
    .update({
      razorpay_order_id: provider.id,
      payment_choice: choice,
      payment_status: 'payment_link_created',
      balance_amount: remaining,
      updated_at: now,
    })
    .eq('id', orderId);
  if (saveError) {
    return json(
      { error: 'Payment was created but could not be attached to the custom order.' },
      500
    );
  }

  return json({
    keyId: credentials.keyId,
    razorpayOrderId: provider.id,
    amount: amountPaise,
    amountRupees: due,
    currency: 'INR',
    orderId,
    purpose,
    remainingBeforePayment: remaining,
    reused: false,
  });
}
