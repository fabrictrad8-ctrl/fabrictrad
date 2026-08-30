'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import {
  openPrintableSellerTaxInvoice,
  type SellerTaxInvoice,
} from '@/lib/sellerTaxInvoice';

type OrderKind = 'catalog' | 'bulk';
type ViewerRole = 'buyer' | 'seller';
type ShipmentMethod = 'shiprocket' | 'third_party';

type PaymentRecord = {
  id: string;
  amount: number;
  captured_amount?: number | null;
  refunded_amount?: number | null;
  currency: string;
  status: string;
  payment_method?: string | null;
  razorpay_payment_id?: string | null;
  captured_at?: string | null;
  failure_reason?: string | null;
};

type ShipmentRecord = {
  id: string;
  courier_type?: string | null;
  courier_name?: string | null;
  awb_number?: string | null;
  tracking_url?: string | null;
  estimated_delivery?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

type Props = {
  orderKind: OrderKind;
  orderId: string;
  viewerRole: ViewerRole;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  amountPaid?: number | null;
  amountRefunded?: number | null;
  buyerId?: string | null;
  sellerId?: string | null;
  onChanged?: () => void | Promise<void>;
};

const money = (value: unknown) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const human = (value?: string | null) =>
  String(value || 'pending')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function OrderLifecyclePanel({
  orderKind,
  orderId,
  viewerRole,
  orderStatus,
  paymentStatus,
  amountPaid,
  amountRefunded,
  buyerId,
  sellerId,
  onChanged,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [invoice, setInvoice] = useState<SellerTaxInvoice | null>(null);
  const [shipment, setShipment] = useState<ShipmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shiprocketConfigured, setShiprocketConfigured] = useState<boolean | null>(null);
  const [shipmentMethod, setShipmentMethod] = useState<ShipmentMethod>('shiprocket');
  const [courierName, setCourierName] = useState('');
  const [awbNumber, setAwbNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const paymentTable = orderKind === 'catalog' ? 'catalog_order_payments' : 'bulk_order_payments';
    const paymentColumn = orderKind === 'catalog' ? 'catalog_order_id' : 'bulk_order_id';
    const shipmentColumn = orderKind === 'catalog' ? 'catalog_order_id' : 'bulk_order_id';

    const [paymentResult, shipmentResult, invoiceResult] = await Promise.all([
      supabase
        .from(paymentTable)
        .select(
          'id,amount,captured_amount,refunded_amount,currency,status,payment_method,razorpay_payment_id,captured_at,failure_reason'
        )
        .eq(paymentColumn, orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('seller_shipments')
        .select('id,courier_type,courier_name,awb_number,tracking_url,estimated_delivery,status,updated_at')
        .eq(shipmentColumn, orderId)
        .maybeSingle(),
      orderKind === 'catalog'
        ? supabase
            .from('seller_tax_invoices')
            .select('*')
            .eq('catalog_order_id', orderId)
            .eq('status', 'issued')
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (!paymentResult.error) setPayment((paymentResult.data || null) as PaymentRecord | null);
    if (!shipmentResult.error) {
      const nextShipment = (shipmentResult.data || null) as ShipmentRecord | null;
      setShipment(nextShipment);
      if (nextShipment) {
        setShipmentMethod(nextShipment.courier_type === 'shiprocket' ? 'shiprocket' : 'third_party');
        setCourierName(nextShipment.courier_name || '');
        setAwbNumber(nextShipment.awb_number || '');
        setTrackingUrl(nextShipment.tracking_url || '');
        setEstimatedDelivery(nextShipment.estimated_delivery || '');
      }
    }
    if (!invoiceResult.error) setInvoice((invoiceResult.data || null) as SellerTaxInvoice | null);
    setLoading(false);
  }, [orderId, orderKind, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (viewerRole !== 'seller' || orderKind !== 'catalog') return;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch('/api/shiprocket/status', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const result = (await response.json().catch(() => ({}))) as { configured?: boolean };
        if (active) setShiprocketConfigured(response.ok && result.configured === true);
      } catch {
        if (active) setShiprocketConfigured(false);
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, [orderKind, viewerRole]);

  useEffect(() => {
    if (!shipment && shiprocketConfigured === false) {
      setShipmentMethod('third_party');
    }
  }, [shipment, shiprocketConfigured]);

  const issueInvoice = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/seller/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ catalogOrderId: orderId }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        invoice?: SellerTaxInvoice;
        error?: string;
      };
      if (!response.ok || !result.invoice) {
        throw new Error(result.error || 'The GST invoice could not be issued.');
      }
      setInvoice(result.invoice);
      toast.success(`GST invoice ${result.invoice.invoice_number} issued.`);
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The GST invoice could not be issued.');
    } finally {
      setBusy(false);
    }
  };

  const bookShiprocket = async () => {
    if (shiprocketConfigured !== true) {
      toast.error('Shiprocket is not connected. Choose your own / third-party courier for this order.');
      setShipmentMethod('third_party');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/shiprocket/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ orderId, orderType: 'catalog' }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        existing?: boolean;
        awb?: string | null;
        courierName?: string | null;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Shiprocket could not create the shipment.');
      }
      toast.success(
        result.existing
          ? 'This order already has a Shiprocket shipment.'
          : result.awb
            ? `Shipment booked. AWB ${result.awb}`
            : 'Shipment booked with Shiprocket. AWB assignment is in progress.'
      );
      await load();
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shipment could not be booked.');
      setShipmentMethod('third_party');
    } finally {
      setBusy(false);
    }
  };

  const saveCatalogShipment = async () => {
    if (!buyerId || !sellerId) return toast.error('Buyer or seller shipment identity is missing.');
    if (!courierName.trim() || !awbNumber.trim()) {
      return toast.error('Courier name and AWB / tracking number are required.');
    }
    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      return toast.error('Tracking URL must start with http:// or https://.');
    }

    setBusy(true);
    try {
      const { error } = await supabase.from('seller_shipments').upsert(
        {
          order_id: orderId,
          catalog_order_id: orderId,
          bulk_order_id: null,
          buyer_id: buyerId,
          seller_id: sellerId,
          courier_type: 'local',
          courier_name: courierName.trim(),
          awb_number: awbNumber.trim(),
          tracking_url: trackingUrl.trim() || null,
          estimated_delivery: estimatedDelivery || null,
          status: 'in_transit',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'catalog_order_id' }
      );
      if (error) throw error;
      toast.success('Third-party courier details saved. The buyer can now track this order.');
      await load();
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shipment details could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const effectivePaymentStatus = paymentStatus || payment?.status || 'unpaid';
  const effectivePaid = Number(amountPaid ?? payment?.captured_amount ?? 0);
  const effectiveRefunded = Number(amountRefunded ?? payment?.refunded_amount ?? 0);
  const canIssueInvoice =
    viewerRole === 'seller' &&
    orderKind === 'catalog' &&
    ['paid', 'fulfilled'].includes(String(orderStatus || '')) &&
    effectivePaymentStatus === 'paid';
  const canAddCatalogShipment =
    viewerRole === 'seller' &&
    orderKind === 'catalog' &&
    ['paid', 'fulfilled'].includes(String(orderStatus || '')) &&
    effectivePaymentStatus === 'paid';

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      <section className="rounded-xl border border-border bg-muted/35 p-3">
        <div className="flex items-center gap-2">
          <Icon name="CreditCardIcon" size={16} className="text-primary" />
          <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Payment</p>
        </div>
        {loading ? (
          <p className="mt-2 text-xs text-muted-foreground">Checking payment…</p>
        ) : (
          <div className="mt-2 space-y-1 text-xs">
            <p className="font-800 text-foreground">{human(effectivePaymentStatus)}</p>
            <p className="text-muted-foreground">Paid: {money(effectivePaid)}</p>
            {effectiveRefunded > 0 && (
              <p className="font-700 text-warning">Refunded: {money(effectiveRefunded)}</p>
            )}
            {payment?.payment_method && (
              <p className="text-muted-foreground">Method: {human(payment.payment_method)}</p>
            )}
            {payment?.razorpay_payment_id && (
              <p className="break-all font-mono text-[10px] text-muted-foreground">
                {payment.razorpay_payment_id}
              </p>
            )}
            {payment?.failure_reason && <p className="text-error">{payment.failure_reason}</p>}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-3">
        <div className="flex items-center gap-2">
          <Icon name="DocumentTextIcon" size={16} className="text-secondary" />
          <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Seller invoice</p>
        </div>
        {invoice ? (
          <div className="mt-2">
            <p className="text-xs font-800 text-foreground">{invoice.invoice_number}</p>
            <button
              type="button"
              onClick={() => {
                try {
                  openPrintableSellerTaxInvoice(invoice);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Invoice could not be opened.');
                }
              }}
              className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-800"
            >
              Print / Save GST invoice
            </button>
          </div>
        ) : canIssueInvoice ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void issueInvoice()}
            className="mt-2 rounded-lg bg-secondary px-3 py-2 text-xs font-800 text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Issue GST invoice'}
          </button>
        ) : (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {orderKind === 'bulk'
              ? 'A verified seller-uploaded invoice will appear after payment.'
              : 'Available after the order is fully paid and the seller issues it.'}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-3">
        <div className="flex items-center gap-2">
          <Icon name="TruckIcon" size={16} className="text-success" />
          <p className="text-xs font-800 uppercase tracking-wide text-muted-foreground">Shipment</p>
        </div>
        {shipment ? (
          <div className="mt-2 space-y-1 text-xs">
            <p className="font-800 text-foreground">{human(shipment.status)}</p>
            <p className="font-700 text-foreground">
              {shipment.courier_type === 'shiprocket' ? 'Shiprocket' : 'Own / third-party courier'}
            </p>
            <p className="text-muted-foreground">
              {shipment.courier_name || (shipment.courier_type === 'shiprocket' ? 'Shiprocket' : 'Courier')} · {shipment.awb_number || 'AWB pending'}
            </p>
            {shipment.estimated_delivery && (
              <p className="text-muted-foreground">ETA: {shipment.estimated_delivery}</p>
            )}
            {shipment.tracking_url && (
              <a
                href={shipment.tracking_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex font-800 text-primary underline"
              >
                Track shipment
              </a>
            )}
            <p className="pt-1 text-[10px] leading-4 text-muted-foreground">
              Shipping method is stored against this order only.
            </p>
          </div>
        ) : canAddCatalogShipment ? (
          <div className="mt-2 space-y-3">
            <div>
              <p className="text-xs font-800 text-foreground">Shipping method for this order</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                Choose independently for this order. Your other orders are not changed.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button
                type="button"
                disabled={busy || shiprocketConfigured === null}
                onClick={() => setShipmentMethod('shiprocket')}
                className={`rounded-lg border p-2.5 text-left transition disabled:opacity-50 ${
                  shipmentMethod === 'shiprocket'
                    ? 'border-success/50 bg-success/10'
                    : 'border-border bg-card hover:border-success/30'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon name="TruckIcon" size={14} className="text-success" />
                  <span className="text-xs font-800">Shiprocket</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                  Auto-book courier, AWB, pickup and tracking.
                </p>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => setShipmentMethod('third_party')}
                className={`rounded-lg border p-2.5 text-left transition disabled:opacity-50 ${
                  shipmentMethod === 'third_party'
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon name="MapPinIcon" size={14} className="text-primary" />
                  <span className="text-xs font-800">Own / third-party courier</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                  Enter the courier, AWB and tracking details yourself.
                </p>
              </button>
            </div>

            {shipmentMethod === 'shiprocket' ? (
              <div className="space-y-2 border-t border-border pt-3">
                {shiprocketConfigured === false ? (
                  <p className="rounded-lg border border-warning/20 bg-warning/10 p-2 text-[11px] leading-4 text-warning">
                    Shiprocket is not connected on this deployment. Choose your own / third-party courier for this order.
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={busy || shiprocketConfigured !== true}
                    onClick={() => void bookShiprocket()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-success px-3 py-2.5 text-xs font-800 text-white disabled:opacity-50"
                  >
                    <Icon name="TruckIcon" size={14} />
                    {busy ? 'Booking shipment…' : 'Book this order with Shiprocket'}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-2 border-t border-border pt-3">
                <input
                  value={courierName}
                  onChange={(event) => setCourierName(event.target.value)}
                  placeholder="Courier / transporter name"
                  className="input-base rounded-lg px-2.5 py-2 text-xs"
                />
                <input
                  value={awbNumber}
                  onChange={(event) => setAwbNumber(event.target.value)}
                  placeholder="AWB / tracking number"
                  className="input-base rounded-lg px-2.5 py-2 text-xs"
                />
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(event) => setTrackingUrl(event.target.value)}
                  placeholder="Tracking URL (optional)"
                  className="input-base rounded-lg px-2.5 py-2 text-xs"
                />
                <input
                  type="date"
                  value={estimatedDelivery}
                  onChange={(event) => setEstimatedDelivery(event.target.value)}
                  className="input-base rounded-lg px-2.5 py-2 text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveCatalogShipment()}
                  className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-800 text-primary disabled:opacity-50"
                >
                  Save third-party shipment & notify buyer
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {viewerRole === 'seller' && orderKind === 'catalog'
              ? 'Shipping becomes available automatically after full payment is captured.'
              : 'Tracking appears after dispatch.'}
          </p>
        )}
      </section>
    </div>
  );
}
