import crypto from 'node:crypto';

export type RazorpayPaymentEntity = {
  id: string;
  entity?: string;
  amount: number;
  amount_refunded?: number;
  currency: string;
  status: string;
  order_id: string | null;
  method?: string | null;
  captured?: boolean;
  fee?: number | null;
  tax?: number | null;
  error_code?: string | null;
  error_description?: string | null;
};

export const rupeesToPaise = (value: number) => Math.round(value * 100);
export const paiseToRupees = (value?: number | null) => Math.round(Number(value || 0)) / 100;

export function verifyCheckoutSignature(input: {
  storedOrderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}) {
  const expected = crypto
    .createHmac('sha256', input.keySecret)
    .update(`${input.storedOrderId}|${input.paymentId}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(input.signature);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export async function fetchRazorpayPayment(input: {
  paymentId: string;
  keyId: string;
  keySecret: string;
}) {
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${input.keyId}:${input.keySecret}`).toString('base64')}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  );

  const payload = (await response.json().catch(() => ({}))) as Partial<RazorpayPaymentEntity> & {
    error?: { description?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.description || 'Razorpay could not confirm this payment.');
  }
  return payload as RazorpayPaymentEntity;
}

export function assertRazorpayPaymentMatches(input: {
  payment: RazorpayPaymentEntity;
  expectedPaymentId?: string | null;
  expectedOrderId: string;
  expectedAmountRupees: number;
  expectedCurrency?: string;
}) {
  const expectedCurrency = input.expectedCurrency || 'INR';
  if (input.expectedPaymentId && input.payment.id !== input.expectedPaymentId) {
    throw new Error('Razorpay returned a different payment reference.');
  }
  if (input.payment.order_id !== input.expectedOrderId) {
    throw new Error('Payment does not belong to the stored Razorpay order.');
  }
  if (input.payment.currency !== expectedCurrency) {
    throw new Error('Payment currency does not match the FabricTrad order.');
  }
  if (Number(input.payment.amount) !== rupeesToPaise(input.expectedAmountRupees)) {
    throw new Error('Payment amount does not match the FabricTrad amount due.');
  }
  if (!['authorized', 'captured'].includes(input.payment.status)) {
    throw new Error(`Razorpay payment is ${input.payment.status || 'not authorised'}.`);
  }
}
