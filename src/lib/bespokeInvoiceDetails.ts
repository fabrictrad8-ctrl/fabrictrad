export type BespokeInvoiceDetails = {
  description: string;
  hsnCode: string;
  gstRate: number;
  supplyType: 'goods' | 'services';
};

/** The seller/admin supplies classification; never infer a tax rate from the price. */
export function parseBespokeInvoiceDetails(value: unknown): BespokeInvoiceDetails | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  const hsnCode = typeof data.hsnCode === 'string' ? data.hsnCode.trim() : '';
  const gstRate = data.gstRate;
  if (description.length < 3 || description.length > 500 || !/^(?:\d{4}|\d{6}|\d{8})$/.test(hsnCode)) return null;
  if (typeof gstRate !== 'number' || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100 || Math.abs(gstRate * 100 - Math.round(gstRate * 100)) > 0.00001) return null;
  if (data.supplyType !== 'goods' && data.supplyType !== 'services') return null;
  return { description, hsnCode, gstRate, supplyType: data.supplyType };
}
