'use client';

import { useState } from 'react';
import Script from 'next/script';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

interface RazorpayCheckoutProps {
  amount: number;
  orderId?: string;
  orderType?: 'bulk' | 'catalog';
  onSuccess?: (data: { paymentId: string; orderId: string; status?: string }) => void;
  onError?: (error: Error) => void;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
}

interface RazorpayConstructor {
  new (opts: unknown): {
    on: (event: string, cb: (res: Record<string, unknown>) => void) => void;
    open: () => void;
  };
}

type PaymentOrderResponse = {
  error?: string;
  keyId?: string;
  razorpayOrderId?: string;
  amount?: number;
  amountRupees?: number;
  currency?: string;
  paymentPurpose?: 'deposit' | 'balance' | 'full';
  fullOrderAmount?: number;
  remainingAfterPayment?: number;
};

export function RazorpayCheckout({
  amount,
  orderId,
  orderType = 'bulk',
  onSuccess,
  onError,
  buttonText = 'Pay securely',
  className = '',
  disabled = false,
}: RazorpayCheckoutProps) {
  const { isDemoAccount, user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const handlePayment = async () => {
    if (!scriptLoaded || loading || disabled) return;
    if (isDemoAccount) {
      onError?.(new Error('Demo accounts cannot place real paid orders.'));
      return;
    }
    if (!orderId) {
      onError?.(new Error('A seller-confirmed FabricTrad order is required before payment.'));
      return;
    }

    setLoading(true);
    try {
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orderId, orderType }),
      });
      const orderData = (await orderRes.json().catch(() => ({}))) as PaymentOrderResponse;
      if (
        !orderRes.ok ||
        !orderData.keyId ||
        !orderData.razorpayOrderId ||
        !orderData.amount ||
        !orderData.currency
      ) {
        throw new Error(orderData.error || 'Unable to initialise payment.');
      }

      const serverAmount = Number(orderData.amountRupees || orderData.amount / 100);
      const purpose =
        orderData.paymentPurpose === 'deposit'
          ? 'Deposit'
          : orderData.paymentPurpose === 'balance'
            ? 'Balance payment'
            : 'Order payment';

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'FabricTrad',
        description: `${purpose} · ₹${serverAmount.toLocaleString('en-IN')}`,
        image: '/assets/images/app_logo.png',
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: profile?.full_name || undefined,
          email: user?.email || undefined,
          contact: profile?.phone || undefined,
        },
        handler: async (response: Record<string, string>) => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(response),
            });
            const verifyData = (await verifyRes.json().catch(() => ({}))) as {
              verified?: boolean;
              error?: string;
              paymentId?: string;
              orderId?: string;
              status?: string;
            };
            if (!verifyRes.ok || !verifyData.verified || !verifyData.paymentId || !verifyData.orderId) {
              throw new Error(verifyData.error || 'Payment verification failed.');
            }
            onSuccess?.({
              paymentId: verifyData.paymentId,
              orderId: verifyData.orderId,
              status: verifyData.status,
            });
          } catch (error) {
            onError?.(error instanceof Error ? error : new Error('Payment verification failed.'));
          } finally {
            setLoading(false);
          }
        },
        notes: {
          platform: 'FabricTrad',
          fabrictrad_order_id: orderId,
          fabrictrad_order_type: orderType,
        },
        theme: { color: '#C8600A' },
        modal: {
          ondismiss: () => setLoading(false),
          confirm_close: true,
        },
      };

      const Razorpay = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (!Razorpay) throw new Error('Payment checkout failed to load.');
      const checkout = new Razorpay(options);
      checkout.on('payment.failed', (response: Record<string, unknown>) => {
        const details = response.error as Record<string, string> | undefined;
        onError?.(new Error(details?.description || 'Payment failed. No order was marked paid.'));
        setLoading(false);
      });
      checkout.open();
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Unable to start payment.'));
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => setScriptLoaded(false)}
      />
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading || !scriptLoaded || disabled}
        className={
          className ||
          'btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:opacity-60'
        }
      >
        {loading ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Securing payment…
          </>
        ) : (
          <>
            <Icon name="LockClosedIcon" size={14} />
            {buttonText} · up to ₹{Number(amount || 0).toLocaleString('en-IN')}
          </>
        )}
      </button>
      <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
        <Icon name="ShieldCheckIcon" size={11} className="text-success" />
        {isDemoAccount
          ? 'Demo checkout only · real payment disabled'
          : 'Server-priced Razorpay checkout · UPI/cards/netbanking as enabled · no COD'}
      </p>
    </>
  );
}
