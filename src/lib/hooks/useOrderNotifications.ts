'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';

type OrderStatus = 'confirmed' | 'shipped' | 'delivered';

interface BuyerNotificationPayload {
  orderId: string;
  orderRef: string;
  status: OrderStatus;
  amount?: number;
  buyerEmail?: string;
  buyerName?: string;
}

interface SellerNotificationPayload {
  orderId: string;
  orderRef: string;
  amount?: number;
  sellerEmail?: string;
  sellerName?: string;
}

const STATUS_TOAST_CONFIG: Record<OrderStatus, { icon: string; message: string }> = {
  confirmed: { icon: '✅', message: 'Order confirmed!' },
  shipped: { icon: '🚚', message: 'Order shipped!' },
  delivered: { icon: '📦', message: 'Order delivered!' },
};

export function useOrderNotifications() {
  const notifyBuyerOrderStatus = useCallback(
    async (payload: BuyerNotificationPayload) => {
      const config = STATUS_TOAST_CONFIG[payload.status];
      const amountStr = payload.amount ? ` · ₹${payload.amount.toLocaleString('en-IN')}` : '';

      toast.success(
        `${config.icon} ${config.message} — ${payload.orderRef}${amountStr}`,
        { duration: 5000, position: 'top-right' }
      );

      if (payload.buyerEmail) {
        try {
          await fetch('/api/notifications/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'buyer_order_status', ...payload }),
          });
        } catch {
          // Non-blocking
        }
      }
    },
    []
  );

  const notifySellerNewOrder = useCallback(
    async (payload: SellerNotificationPayload) => {
      const amountStr = payload.amount ? ` · ₹${payload.amount.toLocaleString('en-IN')}` : '';

      toast.success(
        `🛒 New order received! — ${payload.orderRef}${amountStr}`,
        { duration: 7000, position: 'top-right' }
      );

      if (payload.sellerEmail) {
        try {
          await fetch('/api/notifications/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'seller_new_order', ...payload }),
          });
        } catch {
          // Non-blocking
        }
      }
    },
    []
  );

  return { notifyBuyerOrderStatus, notifySellerNewOrder };
}
