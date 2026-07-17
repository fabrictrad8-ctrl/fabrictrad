import React from 'react';
import Icon from '@/components/ui/AppIcon';

const activities = [
  {
    id: 1, time: '17 Jul 2026, 11:45 AM', type: 'payment',
    icon: 'CreditCardIcon', iconBg: 'bg-success/10', iconColor: 'text-success',
    title: 'Payment Confirmed',
    desc: 'Buyer Mehta Garments paid ₹2,52,000 for order FT-ORD-005892',
    meta: 'Razorpay · pay_QR1234567890 · IP: 103.21.xx.xx',
  },
  {
    id: 2, time: '17 Jul 2026, 11:30 AM', type: 'seller',
    icon: 'BuildingStorefrontIcon', iconBg: 'bg-amber-50', iconColor: 'text-warning',
    title: 'New Seller Application',
    desc: 'Mumbai Fabric Zone (Sunita Kapoor) submitted verification documents',
    meta: 'FT-SLR-002398 · GSTIN: 27DDDMF3456X4Z8 · Documents: 5 uploaded',
  },
  {
    id: 3, time: '17 Jul 2026, 11:00 AM', type: 'order',
    icon: 'ShoppingBagIcon', iconBg: 'bg-primary/10', iconColor: 'text-primary',
    title: 'Order Request Submitted',
    desc: 'Patel Textiles requested 100 mtrs Organza Sequence Fabric from Surat Textile Mills',
    meta: 'FT-ORD-005901 · ₹98,000 · Seller response window: 10 mins',
  },
  {
    id: 4, time: '17 Jul 2026, 10:45 AM', type: 'listing',
    icon: 'TagIcon', iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
    title: 'Product Listing Submitted',
    desc: 'Surat Textile Mills submitted "Pure Dyeable Soft Nett Fabric" for review',
    meta: 'Via WhatsApp AI Upload · Price: ₹840/mtr · Category: Net & Embroidered',
  },
  {
    id: 5, time: '17 Jul 2026, 10:14 AM', type: 'shipment',
    icon: 'TruckIcon', iconBg: 'bg-purple-50', iconColor: 'text-purple-600',
    title: 'Shipment Created on Shiprocket',
    desc: 'FT-SHP-003250 created for order FT-ORD-004521 · AWB: SR24071800532',
    meta: 'Courier: Delhivery · Pickup: Surat · Delivery: Mumbai · EDD: 21 Jul',
  },
  {
    id: 6, time: '17 Jul 2026, 09:30 AM', type: 'seller',
    icon: 'CheckCircleIcon', iconBg: 'bg-success/10', iconColor: 'text-success',
    title: 'Seller Approved',
    desc: 'Varanasi Silk Traders (Deepak Mishra) approved by Admin Staff Priya',
    meta: 'FT-SLR-002341 · Previous: pending_review → New: verified · Notes: All documents verified',
  },
  {
    id: 7, time: '17 Jul 2026, 09:00 AM', type: 'discount',
    icon: 'ReceiptPercentIcon', iconBg: 'bg-primary/10', iconColor: 'text-primary',
    title: 'Discount Campaign Created',
    desc: 'Independence Day Flash Sale (15%) created by Super Admin',
    meta: 'FT-DSC-000045 · Active: 14-15 Aug 2026 · Budget: FabricTrad-funded · Max: 200 uses',
  },
  {
    id: 8, time: '16 Jul 2026, 06:45 PM', type: 'payment',
    icon: 'ExclamationCircleIcon', iconBg: 'bg-error/10', iconColor: 'text-error',
    title: 'Razorpay Payment Failed',
    desc: 'Payment failed for order FT-ORD-005780 by Kapoor Exports',
    meta: 'Amount: ₹1,28,000 · Reason: Card declined · Razorpay order: order_QR9876',
  },
];

export default function AdminActivityFeed() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-800 text-foreground">Activity Feed</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Live updates
        </div>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="bg-card rounded-2xl border border-border p-4 flex gap-4">
            <div className={`w-10 h-10 rounded-xl ${activity.iconBg} flex items-center justify-center shrink-0`}>
              <Icon name={activity.icon as 'TruckIcon'} size={18} className={activity.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-700 text-foreground">{activity.title}</p>
                <span className="text-xs text-muted-foreground shrink-0">{activity.time}</span>
              </div>
              <p className="text-xs text-foreground mt-0.5 leading-relaxed">{activity.desc}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono leading-relaxed">{activity.meta}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button className="btn-secondary px-6 py-2.5 text-sm rounded-xl">
          Load More Activity
        </button>
      </div>
    </div>
  );
}