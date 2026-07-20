'use client';
import { useState } from 'react';
import Script from 'next/script';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

interface RazorpayCheckoutProps {
  amount: number;
  orderId?: string;
  onSuccess?: (data: { paymentId: string; orderId: string }) => void;
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

export function RazorpayCheckout({
  amount,
  orderId,
  onSuccess,
  onError,
  buttonText = 'Pay Now',
  className = '',
  disabled = false,
}: RazorpayCheckoutProps) {
  const { isDemoAccount } = useAuth();
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
      // Amounts and seller payouts are deliberately derived on the server.
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Unable to initialize payment.');
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'FabricTrad',
        description: `B2B Textile Order Payment · ₹${amount.toLocaleString('en-IN')}`,
        image: '/assets/images/app_logo.png',
        order_id: orderData.orderId,
        handler: async (response: Record<string, string>) => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment verification failed.');
            }
            onSuccess?.({ paymentId: verifyData.paymentId, orderId: verifyData.orderId });
          } catch (error) {
            onError?.(error instanceof Error ? error : new Error('Payment verification failed.'));
          } finally {
            setLoading(false);
          }
        },
        notes: { platform: 'FabricTrad', fabrictrad_order_id: orderId },
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
        onError?.(new Error(details?.description || 'Payment failed.'));
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
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setScriptLoaded(true)} />
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading || !scriptLoaded || disabled}
        className={
          className ||
          'btn-primary w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-60'
        }
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Icon name="LockClosedIcon" size={14} />
            {buttonText}
          </>
        )}
      </button>
      <p className="text-xs text-center text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
        <Icon name="ShieldCheckIcon" size={11} className="text-success" />
        {isDemoAccount ? 'Demo checkout only · real payment disabled' : '100% Prepaid · No Cash on Delivery'}
      </p>
    </>
  );
}
