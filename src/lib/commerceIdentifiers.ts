const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export type GstinStatus =
  | 'format_valid'
  | 'pending_provider'
  | 'active'
  | 'inactive'
  | 'cancelled'
  | 'invalid'
  | 'manual_review';

export type GstinVerificationResult = {
  gstin: string;
  formatValid: boolean;
  checksumValid: boolean;
  status: GstinStatus;
  legalName: string | null;
  tradeName: string | null;
  stateCode: string | null;
  taxpayerType: string | null;
  registrationDate: string | null;
  cancellationDate: string | null;
  principalPlace: string | null;
  provider: string;
  providerReference: string | null;
  checkedAt: string;
  message: string;
};

export const normalizeGstin = (value: unknown) =>
  (typeof value === 'string' ? value : '').replace(/\s+/g, '').toUpperCase().slice(0, 15);

export const validateGstinFormat = (value: unknown) =>
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizeGstin(value));

export function validateGstinChecksum(value: unknown) {
  const gstin = normalizeGstin(value);
  if (!validateGstinFormat(gstin)) return false;

  let factor = 2;
  let total = 0;
  for (let index = gstin.length - 2; index >= 0; index -= 1) {
    const codePoint = GSTIN_ALPHABET.indexOf(gstin[index]);
    if (codePoint < 0) return false;
    const product = factor * codePoint;
    total += Math.floor(product / 36) + (product % 36);
    factor = factor === 2 ? 1 : 2;
  }
  const expected = GSTIN_ALPHABET[(36 - (total % 36)) % 36];
  return expected === gstin[gstin.length - 1];
}

export const gstinStateCode = (value: unknown) => {
  const gstin = normalizeGstin(value);
  return /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : null;
};

export const panFromGstin = (value: unknown) => {
  const gstin = normalizeGstin(value);
  return validateGstinFormat(gstin) ? gstin.slice(2, 12) : '';
};

export const normalizeGtin = (value: unknown) =>
  (typeof value === 'string' ? value : '').replace(/\D/g, '').slice(0, 14);

export function validateGtin(value: unknown) {
  const gtin = normalizeGtin(value);
  if (![8, 12, 13, 14].includes(gtin.length)) return false;
  const body = gtin.slice(0, -1);
  let total = 0;
  let positionFromRight = 1;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    total += Number(body[index]) * (positionFromRight % 2 === 1 ? 3 : 1);
    positionFromRight += 1;
  }
  const expected = (10 - (total % 10)) % 10;
  return expected === Number(gtin.at(-1));
}

export const gtinType = (value: unknown) => {
  const gtin = normalizeGtin(value);
  return validateGtin(gtin) ? `GTIN-${gtin.length}` : null;
};

export const normalizePan = (value: unknown) =>
  (typeof value === 'string' ? value : '').replace(/\s+/g, '').toUpperCase().slice(0, 10);

export const validatePan = (value: unknown) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizePan(value));

export const lastFour = (value: unknown) => {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : '';
  return normalized.slice(-4) || null;
};
