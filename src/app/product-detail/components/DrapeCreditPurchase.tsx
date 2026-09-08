'use client';

import { useState } from 'react';
import Script from 'next/script';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

const CREDITS_PER_PACK = 10;
const RUPEES_PER_PACK = 150;
const PACK_OPTIONS = [1, 3, 5] as const;

interface RazorpayConstructor {
  new (opts: unknown): {
    on: (event: string, cb: (res: Record<string, unknown>) => void) => void;
    open: () => void;
  };
}

type OrderResponse = {
  error?: string;
  orderId?: string;
  keyId?: string;
  amountPaise?: number;
  credits?: number;
  currency?: string;
};

type Balance = { freeTrialsRemaining: number; purchasedCredits: number; totalRemaining: number };

export default function DrapeCreditPurchase({
  onPurchased,
}: {
  onPurchased: (balance: Balance) => void;
}) {
  const { user, profile } = useAuth();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [busyPacks, setBusyPacks] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'info' | 'success'; message: string } | null>(null);

  const buy = async (packs: number) => {
    if (!scriptLoaded || busyPacks !== null) return;
    if (!user) {
      setFeedback({ tone: 'error', message: 'Sign in as a buyer to purchase Virtual Drape credits.' });
      return;
    }
    setFeedback(null);
    setBusyPacks(packs);
    try {
      const orderRes = await fetch('/api/drape/credits/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ packs }),
      });
      const order = (await orderRes.json().catch(() => ({}))) as OrderResponse;
      if (!orderRes.ok || !order.orderId || !order.keyId || !order.amountPaise) {
        throw new Error(order.error || 'Unable to start this purchase.');
      }

      const Razorpay = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (!Razorpay) throw new Error('Secure checkout failed to load. Refresh and retry.');

      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency || 'INR',
        name: 'FabricTrad',
        description: `${order.credits} Virtual Drape credits`,
        order_id: order.orderId,
        prefill: {
          name: profile?.full_name || undefined,
          email: user.email || undefined,
          contact: profile?.phone || undefined,
        },
        theme: { color: '#C8600A' },
        handler: async (response: Record<string, string>) => {
          try {
            setFeedback({ tone: 'info', message: 'Payment received. Adding your credits…' });
            const verifyRes = await fetch('/api/drape/credits/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(response),
            });
            const verify = (await verifyRes.json().catch(() => ({}))) as { ok?: boolean; error?: string; balance?: Balance };
            if (!verifyRes.ok || !verify.ok || !verify.balance) {
              throw new Error(verify.error || 'Payment verification failed.');
            }
            setFeedback({ tone: 'success', message: `${order.credits} credits added to your account.` });
            onPurchased(verify.balance);
          } catch (error) {
            setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Payment verification failed.' });
          } finally {
            setBusyPacks(null);
          }
        },
        modal: {
          ondismiss: () => {
            setBusyPacks(null);
            setFeedback({ tone: 'info', message: 'Checkout closed. No credits were added.' });
          },
          confirm_close: true,
        },
      });
      checkout.on('payment.failed', (response: Record<string, unknown>) => {
        const details = response.error as Record<string, string> | undefined;
        setFeedback({ tone: 'error', message: details?.description || 'Payment failed.' });
        setBusyPacks(null);
      });
      checkout.open();
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to start payment.' });
      setBusyPacks(null);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
      <div className="flex items-center gap-2">
        <Icon name="SparklesIcon" size={16} className="text-primary" />
        <p className="text-sm font-900 text-foreground">Buy more Virtual Drape credits</p>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">₹{RUPEES_PER_PACK} for {CREDITS_PER_PACK} credits · no expiry</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {PACK_OPTIONS.map((packs) => (
          <button
            key={packs}
            type="button"
            disabled={busyPacks !== null || !scriptLoaded}
            onClick={() => void buy(packs)}
            className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-primary/30 bg-card text-center transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyPacks === packs ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            ) : (
              <>
                <span className="text-sm font-900 text-foreground">{packs * CREDITS_PER_PACK} credits</span>
                <span className="text-xs font-700 text-primary">₹{packs * RUPEES_PER_PACK}</span>
              </>
            )}
          </button>
        ))}
      </div>
      {feedback && (
        <p
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
            feedback.tone === 'error'
              ? 'border-error/20 bg-error/5 text-error'
              : feedback.tone === 'success'
                ? 'border-success/20 bg-success/5 text-success'
                : 'border-primary/20 bg-primary/5 text-primary'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
