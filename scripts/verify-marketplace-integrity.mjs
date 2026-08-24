import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

const read = (relative) => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing required file: ${relative}`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
};
const requireText = (relative, needle) => {
  const content = read(relative);
  if (!content.includes(needle)) failures.push(`${relative} must contain: ${needle}`);
};
const requireCount = (relative, needle, minimum) => {
  const content = read(relative);
  const count = content.split(needle).length - 1;
  if (count < minimum) failures.push(`${relative} must contain ${needle} at least ${minimum} times (found ${count})`);
};
const forbidText = (relative, needle) => {
  const content = read(relative);
  if (content.includes(needle)) failures.push(`${relative} must not contain: ${needle}`);
};

const requiredFiles = [
  'src/lib/razorpayIntegrity.ts',
  'src/lib/sellerTaxInvoice.ts',
  'src/components/commerce/OrderLifecyclePanel.tsx',
  'src/app/components/CommerceNotificationFeed.tsx',
  'src/app/product-detail/components/ProductOrderStatusCard.tsx',
  'src/app/api/razorpay/order/route.ts',
  'src/app/api/razorpay/verify/route.ts',
  'src/app/api/razorpay/webhook/route.ts',
  'src/app/api/shiprocket/create-order/route.ts',
  'src/app/api/shiprocket/webhook/route.ts',
  'src/app/api/admin/payments/route.ts',
  'src/app/api/admin/disputes/route.ts',
  'src/app/api/seller/invoices/route.ts',
  'src/app/admin-portal/components/AdminPayments.tsx',
  'src/app/admin-portal/components/AdminDisputes.tsx',
  'src/app/buyer-dashboard/components/DisputeMessaging.tsx',
  'supabase/migrations/20260803052000_marketplace_payment_invoice_shipping_integrity.sql',
  'supabase/migrations/20260803061000_marketplace_payment_attempt_uniqueness.sql',
  'supabase/migrations/20260803062500_shipment_upsert_constraints.sql',
  'supabase/migrations/20260803065000_payment_refund_operations.sql',
  'supabase/migrations/20260803070000_refund_locking_and_dispute_security.sql',
  'supabase/migrations/20260803073000_real_dispute_evidence_and_returns.sql',
];
requiredFiles.forEach(read);

// Server-authoritative catalogue pricing and tax.
requireText('src/app/product-detail/components/ProductInfo.tsx', "rpc('submit_catalog_order_request'");
requireText('src/app/product-detail/components/ProductInfo.tsx', 'Server-calculated GST');
forbidText('src/app/product-detail/components/ProductInfo.tsx', "from('catalog_order_requests').insert");
forbidText('src/app/product-detail/components/ProductInfo.tsx', 'GST (5%)');

// Razorpay orders, signatures, amounts, capture, refunds and idempotency.
requireText('src/app/api/razorpay/order/route.ts', 'amountPaise');
requireText('src/app/api/razorpay/order/route.ts', 'AMOUNT_BELOW_MINIMUM');
requireText('src/app/api/razorpay/order/route.ts', 'RAZORPAY_AUTH_FAILED');
requireText('src/app/api/razorpay/verify/route.ts', 'verifyCheckoutSignature');
requireText('src/app/api/razorpay/verify/route.ts', 'assertRazorpayPaymentMatches');
requireText('src/components/RazorpayCheckout.tsx', 'checkout.razorpay.com/v1/checkout.js');
requireText('src/components/RazorpayCheckout.tsx', "checkout.on('payment.failed'");
requireText('src/components/RazorpayCheckout.tsx', 'ondismiss');
requireText('src/app/api/razorpay/webhook/route.ts', "eventType === 'refund.created'");
requireText('src/app/api/razorpay/webhook/route.ts', "eventType === 'refund.processed'");
requireText('src/app/api/razorpay/webhook/route.ts', "eventType === 'refund.failed'");
requireText('src/app/api/razorpay/webhook/route.ts', 'webhook_dead_letter_queue');
requireText('src/app/api/admin/payments/route.ts', 'X-Refund-Idempotency');
requireText('supabase/migrations/20260803061000_marketplace_payment_attempt_uniqueness.sql', 'one_active_attempt');
requireText('supabase/migrations/20260803070000_refund_locking_and_dispute_security.sql', 'begin_marketplace_refund');

// Seller-issued GST invoices, buyer visibility and paid-only fulfilment.
requireText('src/app/api/seller/invoices/route.ts', 'issue_catalog_tax_invoice');
requireText('src/lib/sellerTaxInvoice.ts', 'GST TAX INVOICE');
requireText('src/components/commerce/OrderLifecyclePanel.tsx', 'seller_tax_invoices');
requireText('src/components/commerce/OrderLifecyclePanel.tsx', "orderType: 'catalog'");
requireText('src/app/seller-dashboard/components/SellerCatalogOrders.tsx', "payment_status !== 'paid'");
requireText('src/app/seller-dashboard/components/SellerOrders.tsx', "order.payment_status !== 'paid'");

// Shiprocket must support both real order types, and neither branch can ship before capture.
const shiprocketRoute = 'src/app/api/shiprocket/create-order/route.ts';
requireText(shiprocketRoute, "type OrderType = 'bulk' | 'catalog'");
requireText(shiprocketRoute, "const orderType: OrderType = input.orderType === 'catalog' ? 'catalog' : 'bulk'");
requireText(shiprocketRoute, "from('catalog_order_requests')");
requireText(shiprocketRoute, "from('bulk_orders')");
requireCount(shiprocketRoute, "order.status !== 'paid' || order.payment_status !== 'paid'", 2);
requireText(shiprocketRoute, 'Only fully captured paid orders can be shipped.');
requireText(shiprocketRoute, "catalog_order_id: orderType === 'catalog'");
requireText(shiprocketRoute, "bulk_order_id: orderType === 'bulk'");
requireText(shiprocketRoute, ".upsert(shipment, { onConflict: shipmentKey })");
requireText(shiprocketRoute, "url.searchParams.set('cod', '0')");
requireText(shiprocketRoute, "request_pickup: true");
requireText(shiprocketRoute, "vendor_details");
requireText('src/app/api/shiprocket/webhook/route.ts', 'shipment.catalog_order_id');
requireText('src/app/api/shiprocket/webhook/route.ts', "status === 'delivered'");
requireText('supabase/migrations/20260803062500_shipment_upsert_constraints.sql', 'seller_shipments_bulk_order_id_key');

// Accepted orders must expose payment without forcing a buyer to rediscover the dashboard route.
requireText('src/app/product-detail/page.tsx', '<ProductOrderStatusCard />');
requireText('src/app/product-detail/components/ProductOrderStatusCard.tsx', '<RazorpayCheckout');
requireText('src/app/product-detail/components/ProductOrderStatusCard.tsx', "order.status === 'accepted'");
requireText('src/app/buyer-dashboard/components/BuyerCatalogOrders.tsx', '<RazorpayCheckout');

// Actionable notifications are backed by real persisted commerce notifications.
requireText('src/app/components/CommerceNotificationFeed.tsx', "from('commerce_notifications')");
requireText('src/app/components/CommerceNotificationFeed.tsx', "rpc('seller_decide_catalog_order'");
requireText('src/app/components/CommerceNotificationFeed.tsx', '<RazorpayCheckout');
requireText('src/app/components/NotificationPreferences.tsx', '<CommerceNotificationFeed mode={mode} />');
requireText('supabase/migrations/20260822154500_commerce_notifications_and_order_actions.sql', 'commerce_notifications');

// Private, real disputes and administrator-only resolution.
requireText('src/app/buyer-dashboard/components/DisputeMessaging.tsx', "from('disputes')");
requireText('src/app/buyer-dashboard/components/DisputeMessaging.tsx', "from('dispute_messages')");
requireText('src/app/buyer-dashboard/components/DisputeMessaging.tsx', "from('dispute-evidence')");
forbidText('src/app/buyer-dashboard/components/DisputeMessaging.tsx', 'initialDisputes');
requireText('src/app/api/admin/disputes/route.ts', "action === 'message'");
requireText('src/app/api/admin/disputes/route.ts', "action === 'status'");
requireText('src/app/admin-portal/components/AdminPortalLayout.tsx', "key: 'disputes'");
requireText('src/app/admin-portal/components/AdminPortalLayout.tsx', "activeTab === 'disputes'");
requireText('src/app/admin-portal/components/AdminPortalLayout.tsx', '<AdminDisputes />');
requireText('src/app/admin-portal/components/AdminCommandSearch.tsx', "id: 'nav-disputes'");
requireText('supabase/migrations/20260803070000_refund_locking_and_dispute_security.sql', 'disputes_admin_manage');
requireText('supabase/migrations/20260803073000_real_dispute_evidence_and_returns.sql', 'dispute-evidence');

// Purchase records and document lifecycle appear in both account roles.
requireText('src/app/buyer-dashboard/components/BuyerCatalogOrders.tsx', 'OrderLifecyclePanel');
requireText('src/app/seller-dashboard/components/SellerCatalogOrders.tsx', 'OrderLifecyclePanel');
requireText('src/app/buyer-dashboard/components/BuyerOrders.tsx', 'OrderLifecyclePanel');
requireText('src/app/seller-dashboard/components/SellerOrders.tsx', 'OrderLifecyclePanel');
requireText('src/lib/hooks/useAccountOrders.ts', 'payment_status');
requireText('src/lib/hooks/useAccountOrders.ts', 'amount_refunded');

// Operational exports cannot execute spreadsheet formulas or inject HTML.
requireText('src/lib/exportUtils.ts', 'spreadsheetSafe');
requireText('src/lib/exportUtils.ts', 'escapeHtml');
requireText('src/lib/exportUtils.ts', "/^[=+\\-@\\t\\r]/");

// Sensitive legacy access is removed.
requireText(
  'supabase/migrations/20260803052000_marketplace_payment_invoice_shipping_integrity.sql',
  'DROP POLICY IF EXISTS "Public read shipments by order"'
);
requireText(
  'supabase/migrations/20260803052000_marketplace_payment_invoice_shipping_integrity.sql',
  'REVOKE EXECUTE ON FUNCTION public.check_identity_conflict'
);
forbidText('src/app/admin-portal/components/AdminPayments.tsx', 'initialPayments');
forbidText('src/app/admin-portal/components/AdminPayments.tsx', 'payment.amount * 0.1');

if (failures.length) {
  console.error(`Marketplace integrity verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Marketplace integrity verification passed (${requiredFiles.length} required files checked).`);
