'use client';
import { useState } from 'react';
import Script from 'next/script';
import Icon from '@/components/ui/AppIcon';

interface RazorpayCheckoutProps {
  amount: number;
  orderId?: string;
  sellerLinkedAccountId?: string;
  sellerAmount?: number;
  onSuccess?: (data: { paymentId: string; orderId: string }) => void;
  onError?: (error: Error) => void;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
}

export function RazorpayCheckout({
  amount,
  orderId,
  sellerLinkedAccountId,
  sellerAmount,
  onSuccess,
  onError,
  buttonText = 'Pay Now',
  className = '',
  disabled = false,
}: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const handlePayment = async () => {
    if (!scriptLoaded || loading || disabled) return;
    setLoading(true);

    try {
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          receipt: orderId || `FT-ORD-${Date.now()}`,
          orderId,
          sellerLinkedAccountId,
          sellerAmount,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderData.success) throw new Error(orderData.error);

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'FabricTrad',
        description: 'B2B Textile Order Payment',
        image: '/assets/images/app_logo.png',
        order_id: orderData.orderId,
        handler: async (response: Record<string, string>) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            onSuccess?.({ paymentId: verifyData.paymentId, orderId: verifyData.orderId });
          } else {
            onError?.(new Error(verifyData.error));
          }
          setLoading(false);
        },
        prefill: {},
        notes: {
          platform: 'FabricTrad',
          order_id: orderId || '',
        },
        theme: { color: '#C8600A' },
        modal: {
          ondismiss: () => setLoading(false),
          confirm_close: true,
        },
      };

      const razorpay = new (window as unknown as { Razorpay: new (opts: unknown) => { on: (event: string, cb: (res: Record<string, unknown>) => void) => void; open: () => void } }).Razorpay(options);
      razorpay.on('payment.failed', (res: Record<string, unknown>) => {
        const errDesc = (res?.error as Record<string, string>)?.description || 'Payment failed';
        onError?.(new Error(errDesc));
        setLoading(false);
      });
      razorpay.open();
    } catch (error) {
      onError?.(error as Error);
      setLoading(false);
    }
  };

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />
      <button
        onClick={handlePayment}
        disabled={loading || !scriptLoaded || disabled}
        className={className || 'btn-primary w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-60'}
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
      {/* No COD notice */}
      <p className="text-xs text-center text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
        <Icon name="ShieldCheckIcon" size={11} className="text-success" />
        100% Prepaid · No Cash on Delivery
      </p>
    </>
  );
}
