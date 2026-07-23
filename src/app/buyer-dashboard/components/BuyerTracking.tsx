import React from 'react';
import Icon from '@/components/ui/AppIcon';

type ShipmentTimelineEvent = {
  event: string;
  time: string;
  done: boolean;
  active?: boolean;
};

type BuyerShipment = {
  orderId: string;
  shipmentId: string;
  awb: string;
  courier: string;
  product: string;
  seller: string;
  status: string;
  statusLabel: string;
  edd: string;
  lastUpdate: string;
  trackingUrl?: string;
  timeline: ShipmentTimelineEvent[];
};

const shipments: BuyerShipment[] = [];

export default function BuyerTracking() {
  return (
    <div>
      <h1 className="text-xl font-800 text-foreground mb-6">Track Shipments</h1>
      <div className="space-y-5">
        {shipments.length === 0 && (
          <div className="bg-card rounded-2xl border border-border px-5 py-12 text-center">
            <Icon name="TruckIcon" size={34} className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-800 text-foreground">No shipments for this account</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tracking details will be visible only for orders placed by this buyer.
            </p>
          </div>
        )}
        {shipments.map((shipment) => (
          <div
            key={shipment.shipmentId}
            className="bg-card rounded-2xl border border-border overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="mono-id">{shipment.orderId}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 font-700 px-2.5 py-0.5 rounded-full">
                      {shipment.statusLabel}
                    </span>
                  </div>
                  <p className="text-sm font-700 text-foreground">{shipment.product}</p>
                  <p className="text-xs text-muted-foreground">{shipment.seller}</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name="TruckIcon" size={14} className="text-muted-foreground" />
                    <span className="text-xs font-600 text-foreground">{shipment.courier}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">AWB: {shipment.awb}</p>
                  <p className="text-xs font-700 text-primary">EDD: {shipment.edd}</p>
                  {shipment.trackingUrl && (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-700 text-secondary hover:underline"
                    >
                      <Icon name="ArrowTopRightOnSquareIcon" size={11} />
                      Seller live tracking
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5">
              <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-4">
                Shipment Timeline
              </p>
              <div className="space-y-0">
                {shipment.timeline.map((timelineEvent, index) => (
                  <div key={`${timelineEvent.event}-${timelineEvent.time}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          timelineEvent.active
                            ? 'tracking-step-active'
                            : timelineEvent.done
                              ? 'tracking-step-done'
                              : 'tracking-step-pending'
                        }`}
                      >
                        {timelineEvent.done && !timelineEvent.active ? (
                          <Icon name="CheckIcon" size={14} />
                        ) : (
                          <span className="text-xs font-700">{index + 1}</span>
                        )}
                      </div>
                      {index < shipment.timeline.length - 1 && (
                        <div
                          className={`w-0.5 h-8 ${timelineEvent.done ? 'bg-success' : 'bg-border'}`}
                        />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <p
                        className={`text-sm font-700 ${timelineEvent.active ? 'text-primary' : timelineEvent.done ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {timelineEvent.event}
                        {timelineEvent.active && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{timelineEvent.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 p-3 bg-muted rounded-xl flex items-center gap-2">
                <Icon name="MapPinIcon" size={14} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Last update: {shipment.lastUpdate}</p>
              </div>

              {shipment.trackingUrl && (
                <div className="mt-3 rounded-xl border border-secondary/20 bg-secondary/5 p-3">
                  <p className="text-xs font-800 text-secondary">Seller-managed delivery</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    This order uses the seller&apos;s own delivery partner instead of Shiprocket. The
                    seller is responsible for maintaining the tracking number, live tracking link,
                    delivery status, and buyer updates.
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
