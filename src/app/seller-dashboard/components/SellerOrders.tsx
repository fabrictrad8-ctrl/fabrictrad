'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import {
  firstOrderItem,
  formatMoney,
  formatOrderDate,
  type AccountBulkOrder,
  useSellerBulkOrders,
} from '@/lib/hooks/useAccountOrders';

type OrderTab = 'pending' | 'active' | 'shipping' | 'completed' | 'cancelled';
type DeliveryDraft = {
  partner: 'shiprocket' | 'own';
  courierName: string;
  awbNumber: string;
  trackingUrl: string;
  estimatedDelivery: string;
  saved: boolean;
};

const emptyDelivery: DeliveryDraft = {
  partner: 'shiprocket',
  courierName: '',
  awbNumber: '',
  trackingUrl: '',
  estimatedDelivery: '',
  saved: false,
};

const tabs: { key: OrderTab; label: string; statuses: string[] }[] = [
  { key: 'pending', label: 'Pending', statuses: ['draft', 'quote_sent'] },
  { key: 'active', label: 'Accepted & Paid', statuses: ['confirmed', 'paid'] },
  { key: 'shipping', label: 'Shipped', statuses: ['shipped'] },
  { key: 'completed', label: 'Delivered', statuses: ['delivered'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled', 'rejected', 'refunded'] },
];

function orderCode(order: AccountBulkOrder) {
  return `FT-BULK-${order.id.slice(0, 8).toUpperCase()}`;
}

export default function SellerOrders() {
  const { orders, loading, error, refresh, updateOrder } = useSellerBulkOrders();
  const [tab, setTab] = useState<OrderTab>('pending');
  const [delivery, setDelivery] = useState<Record<string, DeliveryDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleOrders = useMemo(() => {
    const statuses = tabs.find((item) => item.key === tab)?.statuses || [];
    return orders.filter((order) => statuses.includes(order.status || 'draft'));
  }, [orders, tab]);

  const runOrderAction = async (order: AccountBulkOrder, patch: { status?: string; notes?: string }, success: string) => {
    setBusyId(order.id);
    try {
      await updateOrder(order.id, patch);
      toast.success(success);
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Order update failed.');
    } finally {
      setBusyId(null);
    }
  };

  const sendCounterOffer = async (order: AccountBulkOrder) => {
    const item = firstOrderItem(order);
    const requested = Number(item?.quantity_mtrs || 0);
    const answer = window.prompt(`Counter quantity in metres${requested ? ` (maximum ${requested})` : ''}:`);
    if (!answer) return;
    const quantity = Number(answer);
    if (!Number.isFinite(quantity) || quantity < 1 || (requested > 0 && quantity > requested)) {
      toast.error('Enter a valid counter quantity.');
      return;
    }
    const note = window.prompt('Optional reason or dispatch note:')?.trim();
    await runOrderAction(
      order,
      { notes: `Seller counter offer: ${quantity} metres.${note ? ` ${note}` : ''}` },
      'Counter offer saved for buyer review.'
    );
  };

  const rejectOrder = async (order: AccountBulkOrder) => {
    const reason = window.prompt('Reason for rejecting this order:')?.trim();
    if (!reason) return;
    if (!window.confirm(`Reject ${orderCode(order)}?`)) return;
    await runOrderAction(order, { status: 'cancelled', notes: `Rejected by seller: ${reason}` }, 'Order rejected and buyer status updated.');
  };

  const updateDelivery = (orderId: string, patch: Partial<DeliveryDraft>) => {
    setDelivery((current) => ({
      ...current,
      [orderId]: { ...(current[orderId] || emptyDelivery), ...patch, saved: false },
    }));
  };

  const saveDelivery = async (order: AccountBulkOrder) => {
    const draft = delivery[order.id] || emptyDelivery;
    if (draft.partner === 'own' && (!draft.courierName.trim() || !draft.awbNumber.trim())) {
      toast.error('Courier name and AWB/tracking number are required.');
      return;
    }
    if (draft.partner === 'own' && (!order.seller_id || !order.buyer_id)) {
      toast.error('Seller or buyer shipment details are missing.');
      return;
    }
    setBusyId(order.id);
    try {
      if (draft.partner === 'own') {
        const supabase = createClient();
        const { error: shipmentError } = await supabase.from('seller_shipments').upsert(
          {
            order_id: order.id,
            seller_id: order.seller_id,
            buyer_id: order.buyer_id,
            courier_type: 'local',
            courier_name: draft.courierName.trim(),
            awb_number: draft.awbNumber.trim(),
            tracking_url: draft.trackingUrl.trim() || null,
            estimated_delivery: draft.estimatedDelivery || null,
            status: order.status === 'shipped' ? 'in_transit' : 'pending',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'order_id' }
        );
        if (shipmentError) throw shipmentError;
      }
      setDelivery((current) => ({ ...current, [order.id]: { ...draft, saved: true } }));
      toast.success('Delivery details saved.');
    } catch (deliveryError) {
      toast.error(deliveryError instanceof Error ? deliveryError.message : 'Could not save delivery details.');
    } finally {
      setBusyId(null);
    }
  };

  const markShipped = async (order: AccountBulkOrder) => {
    const draft = delivery[order.id] || emptyDelivery;
    if (!draft.saved) {
      toast.error('Save delivery details before marking the order shipped.');
      return;
    }
    setBusyId(order.id);
    try {
      if (draft.partner === 'shiprocket') {
        const response = await fetch('/api/shiprocket/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Shiprocket booking failed.');
      }
      await updateOrder(order.id, { status: 'shipped' });
      toast.success(draft.partner === 'shiprocket' ? 'Shiprocket pickup created and order marked shipped.' : 'Order marked shipped.');
    } catch (shippingError) {
      toast.error(shippingError instanceof Error ? shippingError.message : 'Could not ship order.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-xl font-800 text-foreground">Order Queue</h1><p className="mt-1 text-xs text-muted-foreground">Accept, counter, reject, fulfil and track buyer orders.</p></div>
        <button type="button" onClick={() => void refresh()} className="btn-secondary flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-xs"><Icon name="ArrowPathIcon" size={15} />Refresh</button>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => {
          const count = orders.filter((order) => item.statuses.includes(order.status || 'draft')).length;
          return <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-700 ${tab === item.key ? 'bg-secondary text-white' : 'border border-border bg-card text-muted-foreground hover:text-foreground'}`}>{item.label} <span className="ml-1 opacity-80">{count}</span></button>;
        })}
      </div>

      {error && <div className="mb-4 rounded-xl border border-error/20 bg-error/5 p-3 text-xs text-error">{error}</div>}
      {loading && <div className="rounded-2xl border border-border bg-card py-16 text-center"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" /></div>}
      {!loading && visibleOrders.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center"><Icon name="ClipboardDocumentListIcon" size={34} className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm font-800 text-foreground">No {tabs.find((item) => item.key === tab)?.label.toLowerCase()} orders</p></div>}

      <div className="space-y-4">
        {!loading && visibleOrders.map((order) => {
          const item = firstOrderItem(order);
          const draft = delivery[order.id] || emptyDelivery;
          const isBusy = busyId === order.id;
          return <article key={order.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-xs font-800 text-primary">{orderCode(order)}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-800 uppercase text-muted-foreground">{String(order.status || 'draft').replaceAll('_', ' ')}</span></div><h2 className="mt-2 text-base font-800 text-foreground">{item?.product_name || 'Bulk fabric order'}</h2><p className="mt-1 text-xs text-muted-foreground">{order.buyer_company || order.buyer_name || 'Buyer account'} · {formatOrderDate(order.created_at)}</p></div>
              <div className="sm:text-right"><p className="text-lg font-800 text-secondary">{formatMoney(order.net_total)}</p><p className="text-xs text-muted-foreground">{Number(item?.quantity_mtrs || 0).toLocaleString('en-IN')} mtrs</p></div>
            </div>
            {order.notes && <div className="mt-4 rounded-xl bg-muted p-3 text-xs leading-5 text-muted-foreground"><span className="font-800 text-foreground">Order note:</span> {order.notes}</div>}

            {['draft', 'quote_sent'].includes(order.status || 'draft') && <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4"><button type="button" disabled={isBusy} onClick={() => void runOrderAction(order, { status: 'confirmed' }, 'Order accepted. Buyer can proceed to payment.')} className="flex items-center gap-1.5 rounded-xl bg-success px-4 py-2 text-xs font-800 text-white disabled:opacity-50"><Icon name="CheckIcon" size={14} />Accept</button><button type="button" disabled={isBusy} onClick={() => void sendCounterOffer(order)} className="btn-secondary rounded-xl px-4 py-2 text-xs disabled:opacity-50">Counter Offer</button><button type="button" disabled={isBusy} onClick={() => void rejectOrder(order)} className="rounded-xl border border-error/20 bg-error/10 px-4 py-2 text-xs font-800 text-error disabled:opacity-50">Reject</button></div>}

            {['confirmed', 'paid'].includes(order.status || '') && <div className="mt-5 border-t border-border pt-4"><h3 className="mb-3 text-xs font-800 uppercase tracking-wide text-muted-foreground">Delivery setup</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-700 text-foreground">Delivery Partner<select value={draft.partner} onChange={(event) => updateDelivery(order.id, { partner: event.target.value as DeliveryDraft['partner'] })} className="input-base mt-1 w-full rounded-xl px-3 py-2.5 text-sm"><option value="shiprocket">Shiprocket</option><option value="own">Own Courier</option></select></label>{draft.partner === 'own' && <><label className="text-xs font-700 text-foreground">Courier Name<input value={draft.courierName} onChange={(event) => updateDelivery(order.id, { courierName: event.target.value })} className="input-base mt-1 w-full rounded-xl px-3 py-2.5 text-sm" /></label><label className="text-xs font-700 text-foreground">AWB / Tracking Number<input value={draft.awbNumber} onChange={(event) => updateDelivery(order.id, { awbNumber: event.target.value })} className="input-base mt-1 w-full rounded-xl px-3 py-2.5 text-sm" /></label><label className="text-xs font-700 text-foreground">Tracking URL<input type="url" value={draft.trackingUrl} onChange={(event) => updateDelivery(order.id, { trackingUrl: event.target.value })} className="input-base mt-1 w-full rounded-xl px-3 py-2.5 text-sm" /></label></>}<label className="text-xs font-700 text-foreground">Estimated Delivery<input type="date" value={draft.estimatedDelivery} onChange={(event) => updateDelivery(order.id, { estimatedDelivery: event.target.value })} className="input-base mt-1 w-full rounded-xl px-3 py-2.5 text-sm" /></label></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={isBusy} onClick={() => void saveDelivery(order)} className="btn-secondary rounded-xl px-4 py-2 text-xs disabled:opacity-50">{draft.saved ? 'Delivery Saved' : 'Save Delivery'}</button><button type="button" disabled={isBusy || !draft.saved} onClick={() => void markShipped(order)} className="btn-primary rounded-xl px-4 py-2 text-xs disabled:opacity-50">Mark Shipped</button></div></div>}
          </article>;
        })}
      </div>
    </div>
  );
}
