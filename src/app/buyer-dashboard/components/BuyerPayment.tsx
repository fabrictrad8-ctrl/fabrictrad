'use client';

import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface RazorpayConstructor {
  new (opts: unknown): {
    on: (event: string, cb: (res: Record<string, unknown>) => void) => void;
    open: () => void;
  };
}

type OrderSummary = {
  id: string;
  ref: string;
  orderType: 'bulk' | 'catalog';
  productName: string;
  quantity: number;
  unit: string;
  productAmount: number;
  shippingAmount: number;
  gstAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
  paymentStatus: string;
  sellerName: string;
};

type PaymentState = 'idle' | 'loading' | 'processing' | 'success' | 'error';

type InvoiceRecord = {
  id: string;
  orderId: string;
  orderRef: string;
  paymentId: string;
  amount: number;
  paidAt: string;
  buyerName: string;
  sellerName: string;
  productName: string;
};

const money = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

function generateInvoicePDF(invoice: InvoiceRecord) {
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - ${invoice.orderRef}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .logo { font-size: 22px; font-weight: 800; color: #008060; }
        .invoice-title { font-size: 28px; font-weight: 700; color: #111; }
        .meta { margin-bottom: 24px; }
        .meta p { margin: 4px 0; font-size: 14px; color: #444; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { background: #f5f5f5; padding: 10px 14px; text-align: left; font-size: 13px; border-bottom: 2px solid #ddd; }
        td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #eee; }
        .total-row td { font-weight: 700; font-size: 15px; background: #f9f9f9; }
        .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }
        .badge { display: inline-block; background: #e6f4f0; color: #008060; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">FabricTrad</div>
        <div>
          <div class="invoice-title">TAX INVOICE</div>
          <p style="font-size:13px;color:#666;margin:4px 0">${invoice.orderRef}</p>
          <span class="badge">PAID</span>
        </div>
      </div>
      <div class="meta">
        <p><strong>Invoice Date:</strong> ${new Date(invoice.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <p><strong>Payment ID:</strong> ${invoice.paymentId}</p>
        <p><strong>Buyer:</strong> ${invoice.buyerName}</p>
        <p><strong>Seller:</strong> ${invoice.sellerName}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${invoice.productName}</td>
            <td style="text-align:right">${money(invoice.amount * 0.82)}</td>
          </tr>
          <tr>
            <td>Shipping & Handling</td>
            <td style="text-align:right">${money(invoice.amount * 0.05)}</td>
          </tr>
          <tr>
            <td>GST (18%)</td>
            <td style="text-align:right">${money(invoice.amount * 0.13)}</td>
          </tr>
          <tr class="total-row">
            <td>Total Amount Paid</td>
            <td style="text-align:right">${money(invoice.amount)}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer">
        <p>FabricTrad B2B Marketplace · This is a computer-generated invoice</p>
        <p>For support: support@fabrictrad.com</p>
      </div>
    </body>
    </html>
  `;
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
      URL.revokeObjectURL(url);
    };
  }
}

export default function BuyerPayment() {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [paymentError, setPaymentError] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<InvoiceRecord | null>(null);
  const [saveCard, setSaveCard] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [catalogRes, bulkRes] = await Promise.all([
        supabase
          .from('catalog_order_requests')
          .select('id,status,payment_status,total_amount,amount_paid,created_at,seller_products(name,price_per_unit,unit),seller_profiles(business_name)')
          .eq('buyer_id', user.id)
          .in('status', ['accepted', 'paid', 'shipped', 'delivered'])
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('bulk_orders')
          .select('id,status,payment_status,net_total,gross_total,gst_total,amount_paid,created_at,seller_profiles(business_name)')
          .eq('buyer_id', user.id)
          .in('status', ['confirmed', 'paid', 'shipped', 'delivered'])
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const catalogOrders: OrderSummary[] = ((catalogRes.data || []) as unknown as Record<string, unknown>[]).map((o) => {
        const product = (o.seller_products as Record<string, unknown> | null) || {};
        const seller = (o.seller_profiles as Record<string, unknown> | null) || {};
        const total = Number(o.total_amount || 0);
        const productAmt = Math.round(total * 0.82);
        const shipping = Math.round(total * 0.05);
        const gst = total - productAmt - shipping;
        return {
          id: String(o.id),
          ref: `FT-CAT-${String(o.id).slice(0, 8).toUpperCase()}`,
          orderType: 'catalog',
          productName: String(product.name || 'Fabric Order'),
          quantity: 0,
          unit: String(product.unit || 'mtr'),
          productAmount: productAmt,
          shippingAmount: shipping,
          gstAmount: gst,
          totalAmount: total,
          amountPaid: Number(o.amount_paid || 0),
          status: String(o.status || ''),
          paymentStatus: String(o.payment_status || 'unpaid'),
          sellerName: String(seller.business_name || 'Seller'),
        };
      });

      const bulkOrders: OrderSummary[] = ((bulkRes.data || []) as unknown as Record<string, unknown>[]).map((o) => {
        const seller = (o.seller_profiles as Record<string, unknown> | null) || {};
        const total = Number(o.net_total || 0);
        const gross = Number(o.gross_total || total * 0.87);
        const gst = Number(o.gst_total || total - gross);
        const shipping = Math.round(total * 0.05);
        return {
          id: String(o.id),
          ref: `FT-BULK-${String(o.id).slice(0, 8).toUpperCase()}`,
          orderType: 'bulk',
          productName: 'Bulk Fabric Order',
          quantity: 0,
          unit: 'mtr',
          productAmount: gross - shipping,
          shippingAmount: shipping,
          gstAmount: gst,
          totalAmount: total,
          amountPaid: Number(o.amount_paid || 0),
          status: String(o.status || ''),
          paymentStatus: String(o.payment_status || 'unpaid'),
          sellerName: String(seller.business_name || 'Seller'),
        };
      });

      setOrders([...catalogOrders, ...bulkOrders]);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const handlePay = async (order: OrderSummary) => {
    if (!scriptLoaded) {
      setPaymentError('Payment checkout is still loading. Please wait a moment.');
      return;
    }
    setPaymentState('loading');
    setPaymentError('');
    try {
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orderId: order.id, orderType: order.orderType }),
      });
      const orderData = await orderRes.json() as {
        error?: string; keyId?: string; razorpayOrderId?: string;
        amount?: number; currency?: string; amountRupees?: number;
      };
      if (!orderRes.ok || !orderData.keyId || !orderData.razorpayOrderId) {
        throw new Error(orderData.error || 'Unable to initialise payment.');
      }

      const Razorpay = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (!Razorpay) throw new Error('Payment checkout failed to load. Please refresh and retry.');

      setPaymentState('processing');
      const checkout = new Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'FabricTrad',
        description: `Order ${order.ref}`,
        image: '/assets/images/app_logo.png',
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: profile?.full_name || undefined,
          email: user?.email || undefined,
          contact: profile?.phone || undefined,
        },
        config: saveCard ? { display: { preferences: { show_default_blocks: true } } } : undefined,
        handler: async (response: Record<string, string>) => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json() as {
              verified?: boolean; error?: string; paymentId?: string; orderId?: string;
            };
            if (!verifyRes.ok || !verifyData.verified) {
              throw new Error(verifyData.error || 'Payment verification failed.');
            }
            setCompletedInvoice({
              id: verifyData.paymentId || '',
              orderId: order.id,
              orderRef: order.ref,
              paymentId: verifyData.paymentId || '',
              amount: order.totalAmount,
              paidAt: new Date().toISOString(),
              buyerName: profile?.full_name || user?.email || 'Buyer',
              sellerName: order.sellerName,
              productName: order.productName,
            });
            setPaymentState('success');
            setSelectedOrder(null);
            void loadOrders();
          } catch (err) {
            setPaymentError(err instanceof Error ? err.message : 'Payment verification failed.');
            setPaymentState('error');
          }
        },
        notes: { platform: 'FabricTrad', fabrictrad_order_id: order.id },
        theme: { color: '#C8600A' },
        modal: {
          ondismiss: () => setPaymentState('idle'),
          confirm_close: true,
        },
      });
      checkout.on('payment.failed', (res: Record<string, unknown>) => {
        const details = res.error as Record<string, string> | undefined;
        setPaymentError(details?.description || 'Payment failed.');
        setPaymentState('error');
      });
      checkout.open();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Unable to start payment.');
      setPaymentState('error');
    }
  };

  const payableOrders = orders.filter((o) => o.paymentStatus !== 'paid' && o.totalAmount > 0 && o.amountPaid < o.totalAmount);
  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid' || o.amountPaid >= o.totalAmount);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#008060] border-t-transparent" />
          <p className="text-sm text-gray-500">Loading payment details…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-700 text-gray-900">Payments</h1>
          <p className="mt-1 text-sm text-gray-500">Pay for confirmed orders and download invoices</p>
        </div>

        {/* Success / Invoice Download */}
        {completedInvoice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Icon name="CheckCircleIcon" size={22} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-700 text-emerald-800">Payment Successful!</h3>
                <p className="mt-0.5 text-sm text-emerald-700">
                  {completedInvoice.orderRef} · {money(completedInvoice.amount)} paid
                </p>
                <p className="mt-0.5 text-xs text-emerald-600">Payment ID: {completedInvoice.paymentId}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => generateInvoicePDF(completedInvoice)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-600 text-white hover:bg-emerald-700"
                  >
                    <Icon name="ArrowDownTrayIcon" size={14} />
                    Download Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletedInvoice(null)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-600 text-emerald-700 hover:bg-emerald-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Error */}
        {paymentState === 'error' && paymentError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <Icon name="ExclamationCircleIcon" size={16} className="shrink-0" />
              {paymentError}
            </div>
          </div>
        )}

        {/* Orders Awaiting Payment */}
        {payableOrders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-700 text-gray-800">Orders Awaiting Payment</h2>
            {payableOrders.map((order) => {
              const remaining = order.totalAmount - order.amountPaid;
              const isSelected = selectedOrder?.id === order.id;
              return (
                <div key={order.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-700 text-gray-900">{order.ref}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-600 ${
                            order.orderType === 'catalog' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {order.orderType === 'catalog' ? 'Catalogue' : 'Bulk'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{order.productName}</p>
                        <p className="mt-0.5 text-xs text-gray-400">Seller: {order.sellerName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-700 text-gray-900">{money(remaining)}</p>
                        {order.amountPaid > 0 && (
                          <p className="text-xs text-gray-400">{money(order.amountPaid)} already paid</p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedOrder(isSelected ? null : order)}
                      className="mt-4 w-full rounded-lg bg-[#008060] px-4 py-2.5 text-sm font-600 text-white hover:bg-[#006b52] transition disabled:opacity-60"
                      disabled={paymentState === 'processing' || paymentState === 'loading'}
                    >
                      {isSelected ? 'Hide Payment Details' : 'Pay Now'}
                    </button>
                  </div>

                  {/* Expanded Payment Panel */}
                  {isSelected && (
                    <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-4">
                      {/* Order Breakdown */}
                      <div>
                        <h4 className="mb-3 text-sm font-700 text-gray-700">Order Total Breakdown</h4>
                        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Product amount</span>
                            <span className="font-600 text-gray-900">{money(order.productAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Shipping & handling</span>
                            <span className="font-600 text-gray-900">{money(order.shippingAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">GST (18%)</span>
                            <span className="font-600 text-gray-900">{money(order.gstAmount)}</span>
                          </div>
                          {order.amountPaid > 0 && (
                            <div className="flex justify-between text-sm text-emerald-600">
                              <span>Amount already paid</span>
                              <span className="font-600">− {money(order.amountPaid)}</span>
                            </div>
                          )}
                          <div className="border-t border-gray-200 pt-2 flex justify-between">
                            <span className="font-700 text-gray-900">Amount due now</span>
                            <span className="font-700 text-gray-900 text-base">{money(remaining)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Save Card Option */}
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveCard}
                          onChange={(e) => setSaveCard(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-[#008060] focus:ring-[#008060]"
                        />
                        <span className="text-sm text-gray-700">Save card for faster future payments</span>
                      </label>

                      {/* Test Card Info */}
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-600 text-amber-700 mb-1">Test Mode — Use test card:</p>
                        <p className="text-xs text-amber-600 font-mono">4100 2800 0000 1007 · Expiry: 12/35 · CVV: 123</p>
                      </div>

                      {/* Pay Button */}
                      <button
                        type="button"
                        onClick={() => void handlePay(order)}
                        disabled={paymentState === 'processing' || paymentState === 'loading' || !scriptLoaded}
                        className="w-full rounded-xl bg-[#C8600A] py-3 text-sm font-700 text-white hover:bg-[#b05509] transition disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {paymentState === 'loading' || paymentState === 'processing' ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            {paymentState === 'loading' ? 'Preparing checkout…' : 'Processing payment…'}
                          </>
                        ) : (
                          <>
                            <Icon name="LockClosedIcon" size={14} />
                            Pay {money(remaining)} securely via Razorpay
                          </>
                        )}
                      </button>
                      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                        <Icon name="ShieldCheckIcon" size={11} className="text-emerald-500" />
                        Secured by Razorpay · UPI, Cards, Net Banking
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Paid Orders with Invoice Download */}
        {paidOrders.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-700 text-gray-800">Paid Orders</h2>
            {paidOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-700 text-gray-900">{order.ref}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-600 text-emerald-700">
                      <Icon name="CheckCircleIcon" size={10} />
                      Paid
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{order.productName} · {order.sellerName}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-700 text-gray-900">{money(order.totalAmount)}</span>
                  <button
                    type="button"
                    onClick={() => generateInvoicePDF({
                      id: order.id,
                      orderId: order.id,
                      orderRef: order.ref,
                      paymentId: `rzp_${order.id.slice(0, 8)}`,
                      amount: order.totalAmount,
                      paidAt: new Date().toISOString(),
                      buyerName: profile?.full_name || user?.email || 'Buyer',
                      sellerName: order.sellerName,
                      productName: order.productName,
                    })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-600 text-gray-700 hover:bg-gray-50"
                  >
                    <Icon name="ArrowDownTrayIcon" size={12} />
                    Invoice
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {orders.length === 0 && (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <Icon name="CreditCardIcon" size={36} className="text-gray-300 mb-3" />
            <p className="text-sm font-600 text-gray-500">No orders ready for payment</p>
            <p className="mt-1 text-xs text-gray-400">Confirmed orders will appear here</p>
          </div>
        )}
      </div>
    </>
  );
}
