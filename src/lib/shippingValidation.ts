export const MANUAL_SHIPMENT_STATUSES = ['pending', 'in_transit', 'out_for_delivery', 'delivered'] as const;

export function validTrackingUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password &&
      host.includes('.') && !host.endsWith('.local') && !host.endsWith('.localhost') &&
      !/^\d+(?:\.\d+){3}$/.test(host) && !host.includes(':');
  } catch {
    return false;
  }
}

export function validateManualShipment(body: Record<string, unknown>) {
  if (!['catalog', 'bulk'].includes(String(body.orderType))) return 'Choose a valid order type.';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.orderId || ''))) return 'Choose a valid order.';
  if (typeof body.courierName !== 'string' || !body.courierName.trim() || body.courierName.length > 160) return 'Enter the courier name (up to 160 characters).';
  if (typeof body.awbNumber !== 'string' || !body.awbNumber.trim() || body.awbNumber.length > 160) return 'Enter the AWB / tracking number (up to 160 characters).';
  if (!validTrackingUrl(body.trackingUrl)) return 'A valid HTTPS shipment-tracking link is required.';
  if (!MANUAL_SHIPMENT_STATUSES.includes(body.status as typeof MANUAL_SHIPMENT_STATUSES[number])) return 'Choose a valid shipment status.';
  if (body.estimatedDelivery) {
    const date = String(body.estimatedDelivery);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return 'Enter a valid estimated delivery date.';
  }
  return null;
}
