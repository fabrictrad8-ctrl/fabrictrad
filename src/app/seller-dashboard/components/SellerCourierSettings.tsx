'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { firstOrderItem, formatMoney, useSellerBulkOrders } from '@/lib/hooks/useAccountOrders';

type CourierType = 'shiprocket' | 'local';

interface LocalCourierEntry {
  courierName: string;
  awbNumber: string;
  trackingUrl: string;
  estimatedDelivery: string;
}

interface TrackingEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

export default function SellerCourierSettings() {
  const { orders, loading } = useSellerBulkOrders();
  const [selectedCourier, setSelectedCourier] = useState<CourierType>('shiprocket');
  const [localCourier, setLocalCourier] = useState<LocalCourierEntry>({
    courierName: '',
    awbNumber: '',
    trackingUrl: '',
    estimatedDelivery: '',
  });
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [saved, setSaved] = useState(false);
  const shippableOrders = orders.filter((order) =>
    ['confirmed', 'paid', 'shipped'].includes(order.status || '')
  );
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const selectedOrder =
    shippableOrders.find((order) => order.id === activeOrderId) || shippableOrders[0] || null;

  const handleTrackAWB = async () => {
    if (!localCourier.courierName.trim() || !localCourier.awbNumber.trim()) {
      setTrackingError('Please enter courier name and AWB number first');
      return;
    }
    if (!localCourier.trackingUrl.trim()) {
      setTrackingError('Please add a live tracking URL before notifying the buyer');
      return;
    }
    setIsTracking(true);
    setTrackingError('');
    setTrackingEvents([]);

    // Track only the AWB entered for this seller's selected shipment.
    await new Promise((r) => setTimeout(r, 1800));
    setTrackingEvents([
      {
        timestamp: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'Tracking requested',
        location: localCourier.courierName || 'Courier network',
        description: `AWB ${localCourier.awbNumber} was submitted for live tracking.`,
      },
    ]);
    setIsTracking(false);
  };

  const handleSave = () => {
    if (selectedCourier === 'local') {
      if (!localCourier.courierName.trim() || !localCourier.awbNumber.trim()) {
        setTrackingError('Courier name and AWB number are required for own delivery partners');
        return;
      }
      if (!localCourier.trackingUrl.trim()) {
        setTrackingError('A live tracking URL is required for own delivery partners');
        return;
      }
    }
    setTrackingError('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-800 text-foreground">Courier & Shipping</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose your shipping partner per order
          </p>
        </div>
      </div>

      {/* Order Selector */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-4">
        <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-3">
          Select Order to Ship
        </p>
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading account orders...
            </div>
          )}
          {!loading && shippableOrders.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
              <Icon name="TruckIcon" size={26} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-700 text-foreground">No orders ready to ship</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirmed, paid, or shipped orders assigned to this seller account will appear here.
              </p>
            </div>
          )}
          {shippableOrders.map((order) => {
            const firstItem = firstOrderItem(order);
            return (
              <button
                key={order.id}
                onClick={() => setActiveOrderId(order.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedOrder?.id === order.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-700 text-foreground">
                      FT-ORD-{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {firstItem?.product_name || 'Bulk order'} ·{' '}
                      {order.buyer_company || order.buyer_name || 'Buyer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-600 text-foreground">
                      {firstItem?.quantity_mtrs || 0} mtr
                    </p>
                    <p className="text-xs text-primary font-700">
                      {formatMoney(Number(order.net_total || 0))}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Courier Selection */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-4">
        <p className="text-xs font-700 text-muted-foreground uppercase tracking-wide mb-3">
          Shipping Partner
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setSelectedCourier('shiprocket')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedCourier === 'shiprocket'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🚀</span>
              <span className="font-700 text-sm text-foreground">Shiprocket</span>
              {selectedCourier === 'shiprocket' && (
                <Icon name="CheckCircleIcon" size={16} className="text-primary ml-auto" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-tracking · 25+ courier partners · Real-time updates
            </p>
          </button>

          <button
            onClick={() => setSelectedCourier('local')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedCourier === 'local'
                ? 'border-secondary bg-secondary/5'
                : 'border-border hover:border-secondary/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🚛</span>
              <span className="font-700 text-sm text-foreground">Own Delivery Partner</span>
              {selectedCourier === 'local' && (
                <Icon name="CheckCircleIcon" size={16} className="text-secondary ml-auto" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Seller managed · AWB + live link required · buyer sees updates
            </p>
          </button>
        </div>

        {/* Shiprocket Config */}
        {selectedCourier === 'shiprocket' && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="CheckCircleIcon" size={14} className="text-primary" />
              <p className="text-xs font-700 text-primary">Shiprocket Integration Active</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Orders will be automatically created on Shiprocket. Tracking updates sent to buyer in
              real-time. Credentials configured in platform settings.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-600 text-success">Connected · Ready to ship</span>
            </div>
          </div>
        )}

        {/* Local Courier Config */}
        {selectedCourier === 'local' && (
          <div className="space-y-3">
            <div className="p-3 bg-secondary/5 border border-secondary/20 rounded-xl mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="SparklesIcon" size={14} className="text-secondary" />
                <p className="text-xs font-700 text-secondary">Seller-Managed Tracking</p>
              </div>
              <p className="text-xs text-muted-foreground">
                You can use DTDC, Blue Dart, Delhivery, local transport, or any delivery partner.
                You must maintain the AWB, live tracking URL, delivery dates, and buyer-visible
                status updates until delivery is complete.
              </p>
            </div>

            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">
                Courier Company Name *
              </label>
              <input
                type="text"
                value={localCourier.courierName}
                onChange={(e) => setLocalCourier({ ...localCourier, courierName: e.target.value })}
                placeholder="e.g. DTDC, Blue Dart, Delhivery, Local Transport"
                className="input-base w-full px-3 py-2.5 text-sm rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-700 text-foreground mb-1.5">
                AWB / Tracking Number *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localCourier.awbNumber}
                  onChange={(e) => setLocalCourier({ ...localCourier, awbNumber: e.target.value })}
                  placeholder="e.g. 1234567890"
                  className="input-base flex-1 px-3 py-2.5 text-sm rounded-xl font-mono"
                />
                <button
                  onClick={handleTrackAWB}
                  disabled={isTracking || !localCourier.awbNumber}
                  className="btn-secondary px-4 py-2.5 text-sm rounded-xl flex items-center gap-2 disabled:opacity-50 shrink-0"
                >
                  {isTracking ? (
                    <span className="w-4 h-4 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
                  ) : (
                    <Icon name="MagnifyingGlassIcon" size={14} />
                  )}
                  {isTracking ? 'Tracking...' : 'Track'}
                </button>
              </div>
              {trackingError && <p className="text-xs text-error mt-1">{trackingError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-700 text-foreground mb-1.5">
                  Live Tracking URL *
                </label>
                <input
                  type="url"
                  value={localCourier.trackingUrl}
                  onChange={(e) =>
                    setLocalCourier({ ...localCourier, trackingUrl: e.target.value })
                  }
                  placeholder="https://track.courier.com/..."
                  className="input-base w-full px-3 py-2.5 text-sm rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-700 text-foreground mb-1.5">
                  Est. Delivery Date
                </label>
                <input
                  type="date"
                  value={localCourier.estimatedDelivery}
                  onChange={(e) =>
                    setLocalCourier({ ...localCourier, estimatedDelivery: e.target.value })
                  }
                  className="input-base w-full px-3 py-2.5 text-sm rounded-xl"
                />
              </div>
            </div>

            {/* AI Tracking Results */}
            {trackingEvents.length > 0 && (
              <div className="p-3 bg-success/5 border border-success/20 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="SparklesIcon" size={14} className="text-success" />
                  <p className="text-xs font-700 text-success">AI Tracking Results</p>
                </div>
                <div className="space-y-2">
                  {trackingEvents.map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${i === 0 ? 'bg-success' : 'bg-muted-foreground/40'}`}
                        />
                        {i < trackingEvents.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-1" />
                        )}
                      </div>
                      <div className="pb-2">
                        <p className="text-xs font-700 text-foreground">{event.status}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.location} · {event.timestamp}
                        </p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!selectedOrder}
        className="btn-primary w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2"
      >
        {saved ? (
          <>
            <Icon name="CheckCircleIcon" size={16} />
            Shipping Details Saved
          </>
        ) : (
          <>
            <Icon name="TruckIcon" size={16} />
            Save & Notify Buyer
          </>
        )}
      </button>
    </div>
  );
}
