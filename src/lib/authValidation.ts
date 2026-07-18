export type IdentityRole = 'buyer' | 'seller';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeIndianPhone(phone: string) {
  return phone.replace(/\D/g, '').slice(0, 10);
}

export function validateIndianPhone(phone: string): { valid: boolean; message: string } {
  const cleaned = normalizeIndianPhone(phone);

  if (cleaned.length !== 10) {
    return { valid: false, message: 'Phone number must be exactly 10 digits' };
  }

  if (!/^[6-9]/.test(cleaned)) {
    return { valid: false, message: 'Indian mobile numbers must start with 6, 7, 8, or 9' };
  }

  if (/^(\d)\1{9}$/.test(cleaned)) {
    return { valid: false, message: 'Please enter a valid phone number' };
  }

  return { valid: true, message: '' };
}
