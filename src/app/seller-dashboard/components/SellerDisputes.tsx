'use client';
import React from 'react';
import Icon from '@/components/ui/AppIcon';
import DisputeMessaging from '@/app/buyer-dashboard/components/DisputeMessaging';

export default function SellerDisputes() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-800 text-foreground">Buyer Disputes &amp; Messages</h1>
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Icon name="ExclamationTriangleIcon" size={14} className="text-warning" />
          <p className="text-xs text-warning font-600">
            Exchanges only for damage with unboxing video · No Returns · No COD
          </p>
        </div>
      </div>
      <DisputeMessaging mode="seller" />
    </div>
  );
}
