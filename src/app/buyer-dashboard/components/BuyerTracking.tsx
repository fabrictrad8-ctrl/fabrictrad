import React from 'react';
import Icon from '@/components/ui/AppIcon';

const shipments = [
  {
    orderId: 'FT-ORD-004489',
    shipmentId: 'FT-SHP-003201',
    awb: 'SR24071600421',
    courier: 'Shiprocket Express',
    product: 'Georgette Embroidered Fabric · 50 mtrs',
    seller: 'Jaipur Crafts Emporium',
    status: 'in_transit',
    statusLabel: 'In Transit',
    edd: '19 Jul 2026',
    lastUpdate: 'Mumbai Hub · 14 Jul 2026, 09:30 AM',
    timeline: [
      { event: 'Order Confirmed', time: '14 Jul, 08:00 AM', done: true },
      { event: 'Seller Processing', time: '14 Jul, 09:00 AM', done: true },
      { event: 'Picked Up', time: '14 Jul, 11:30 AM', done: true },
      { event: 'In Transit', time: '14 Jul, 02:00 PM', done: true, active: true },
      { event: 'Out for Delivery', time: 'Estimated 19 Jul', done: false },
      { event: 'Delivered', time: 'Estimated 19 Jul', done: false },
    ],
  },
  {
    orderId: 'FT-ORD-004521',
    shipmentId: 'FT-SHP-003250',
    awb: 'SR24071800532',
    courier: 'Delhivery',
    product: 'Pure Dyeable Soft Nett Fabric · 200 mtrs',
    seller: 'Surat Textile Mills Pvt Ltd',
    status: 'ready',
    statusLabel: 'Ready for Pickup',
    edd: '21 Jul 2026',
    lastUpdate: 'Surat Warehouse · 17 Jul 2026, 03:00 PM',
    timeline: [
      { event: 'Order Confirmed', time: '16 Jul, 10:00 AM', done: true },
      { event: 'Seller Processing', time: '17 Jul, 02:00 PM', done: true },
      { event: 'Ready for Pickup', time: '17 Jul, 03:00 PM', done: true, active: true },
      { event: 'Picked Up', time: 'Estimated 18 Jul', done: false },
      { event: 'In Transit', time: 'Estimated 18 Jul', done: false },
      { event: 'Delivered', time: 'Estimated 21 Jul', done: false },
    ],
  },
];

export default function BuyerTracking() {
  return (
    <div>
      <h1 className="text-xl font-800 text-foreground mb-6">Track Shipments</h1>
      <div className="space-y-5">
        {shipments?.map((shipment) => (
          <div key={shipment?.shipmentId} className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="mono-id">{shipment?.orderId}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 font-700 px-2.5 py-0.5 rounded-full">{shipment?.statusLabel}</span>
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
              <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-4">Shipment Timeline</p>
              <div className="space-y-0">
                {shipment?.timeline?.map((event, i) => (
                  <div key={event?.event} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        event?.active ? 'tracking-step-active' :
                        event?.done ? 'tracking-step-done': 'tracking-step-pending'
                      }`}>
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
                      <p className={`text-sm font-700 ${event?.active ? 'text-primary' : event?.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {event?.event}
                        {event?.active && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Current</span>}
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