export type IndiaGstResolutionInput = {
  hsnCode?: string | null;
  unitPrice?: number | null;
  storedRate?: number | null;
};

export const APPAREL_GST_THRESHOLD_INR = 2500;

export const normalizeHsn = (value: unknown) =>
  String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 8);

export const validateHsn = (value: unknown) => {
  const hsn = normalizeHsn(value);
  return hsn.length === 4 || hsn.length === 6 || hsn.length === 8;
};

export const describeHsn = (value: unknown) => {
  const hsn = normalizeHsn(value);
  if (!hsn) return '';
  if (hsn.startsWith('62032990')) {
    return "Men's/boys' woven ensembles — other textile materials (including linen where applicable)";
  }
  if (hsn.startsWith('620323')) return "Men's/boys' woven ensembles — synthetic fibres";
  if (hsn.startsWith('620322')) return "Men's/boys' woven ensembles — cotton";
  if (hsn.startsWith('6203')) {
    return "Men's/boys' woven suits, ensembles, jackets, trousers and related garments";
  }
  if (hsn.startsWith('6103')) {
    return "Men's/boys' knitted or crocheted suits, ensembles, jackets and trousers";
  }
  if (hsn.startsWith('5208')) {
    return 'Woven cotton fabric, at least 85% cotton, not exceeding 200 g/m²';
  }
  if (hsn.startsWith('5209')) {
    return 'Woven cotton fabric, at least 85% cotton, exceeding 200 g/m²';
  }
  if (hsn.startsWith('5407')) return 'Woven fabrics of synthetic filament yarn';
  if (hsn.startsWith('6307')) return 'Other made-up textile articles';
  if (hsn.startsWith('61')) return 'Knitted or crocheted apparel and clothing accessories';
  if (hsn.startsWith('62')) return 'Woven / non-knitted apparel and clothing accessories';
  if (hsn.startsWith('63')) return 'Other made-up textile articles';
  return '';
};

export const resolveIndiaGstRate = ({
  hsnCode,
  unitPrice,
  storedRate,
}: IndiaGstResolutionInput): number => {
  const hsn = normalizeHsn(hsnCode);
  const price = Number(unitPrice ?? 0);
  const fallback = Math.max(0, Number(storedRate ?? 0));

  if (!hsn) return fallback;

  if (hsn.startsWith('61') || hsn.startsWith('62')) {
    return price <= APPAREL_GST_THRESHOLD_INR ? 5 : 18;
  }

  if (hsn.startsWith('6309') || hsn.startsWith('6310')) return 5;
  if (hsn.startsWith('63053200') || hsn.startsWith('63053300')) return 18;
  if (hsn.startsWith('63')) {
    return price <= APPAREL_GST_THRESHOLD_INR ? 5 : 18;
  }

  if (hsn.startsWith('60')) return 5;

  return fallback;
};

export const indiaGstRuleText = (hsnCode: unknown, unitPrice: number) => {
  const hsn = normalizeHsn(hsnCode);
  if (hsn.startsWith('61') || hsn.startsWith('62') || hsn.startsWith('63')) {
    return unitPrice <= APPAREL_GST_THRESHOLD_INR
      ? 'Current apparel/made-up rule: 5% at transaction value up to ₹2,500 per piece.'
      : 'Current apparel/made-up rule: 18% above ₹2,500 transaction value per piece.';
  }
  return '';
};
