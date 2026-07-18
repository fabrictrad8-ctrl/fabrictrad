import React from 'react';
import Icon from '@/components/ui/AppIcon';

const shipments: {
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
  timeline: { event: string; time: string; done: boolean; active?: boolean }[];
}[] = [];

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
        {shipments?.map((shipment) => (
          <div
            key={shipment?.shipmentId}
            className="bg-card rounded-2xl border border-border overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="mono-id">{shipment?.orderId}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 font-700 px-2.5 py-0.5 rounded-full">
                      {shipment?.statusLabel}
                    </span>
                  </div>
                  <p className="text-sm font-700 text-foreground">{shipment?.product}</p>
                  <p className="text-xs text-muted-foreground">{shipment?.seller}</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name="TruckIcon" size={14} className="text-muted-foreground" />
                    <span className="text-xs font-600 text-foreground">{shipment?.courier}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">AWB: {shipment?.awb}</p>
                  <p className="text-xs font-700 text-primary">EDD: {shipment?.edd}</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-5">
              <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-4">
                Shipment Timeline
              </p>
              <div className="space-y-0">
                {shipment?.timeline?.map((event, i) => (
                  <div key={event?.event} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          event?.active
                            ? 'tracking-step-active'
                            : event?.done
                              ? 'tracking-step-done'
                              : 'tracking-step-pending'
                        }`}
                      >
                        {event?.done && !event?.active ? (
                          <Icon name="CheckIcon" size={14} />
                        ) : (
                          <span className="text-xs font-700">{i + 1}</span>
                        )}
                      </div>
                      {i < shipment?.timeline?.length - 1 && (
                        <div className={`w-0.5 h-8 ${event?.done ? 'bg-success' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <p
                        className={`text-sm font-700 ${event?.active ? 'text-primary' : event?.done ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {event?.event}
                        {event?.active && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{event?.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 p-3 bg-muted rounded-xl flex items-center gap-2">
                <Icon name="MapPinIcon" size={14} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Last update: {shipment?.lastUpdate}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
