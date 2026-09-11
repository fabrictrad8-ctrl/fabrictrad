export const PAYOUT_BUSINESS_TYPES = ['proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited'] as const;
export type SellerPayoutInput = {
  businessType: string; contactName: string; contactPan: string;
  street: string; city: string; state: string; pincode: string;
  registeredStreet: string; registeredCity: string; registeredState: string; registeredPincode: string;
  accountName: string; accountNumber: string; confirmAccountNumber: string; ifsc: string; termsAccepted: boolean;
};

export function validateSellerPayout(body: Record<string, unknown>): SellerPayoutInput {
  const field = (name: string, maximum = 100) => typeof body[name] === 'string' ? body[name].trim().slice(0, maximum + 1) : '';
  const result: SellerPayoutInput = {
    businessType: field('businessType', 30), contactName: field('contactName'), contactPan: field('contactPan', 10).toUpperCase(),
    street: field('street'), city: field('city'), state: field('state', 32).toUpperCase(), pincode: field('pincode', 6),
    registeredStreet: field('registeredStreet'), registeredCity: field('registeredCity'), registeredState: field('registeredState', 32).toUpperCase(), registeredPincode: field('registeredPincode', 6),
    accountName: field('accountName'), accountNumber: field('accountNumber', 35), confirmAccountNumber: field('confirmAccountNumber', 35), ifsc: field('ifsc', 11).toUpperCase(), termsAccepted: body.termsAccepted === true,
  };
  if (!PAYOUT_BUSINESS_TYPES.some(t => t === result.businessType)) throw new Error('Select your registered legal business type.');
  // The fourth character of a PAN is the holder type: P for an individual, F for
  // a firm or LLP, C for a company. Razorpay needs the authorised person's own
  // PAN, not the business's, so this deliberately demands P. The old message just
  // called the PAN invalid, which reads as "you typed it wrong" when the actual
  // problem is usually that the business's PAN was entered instead.
  if (!/^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/.test(result.contactPan)) {
    throw new Error(
      'Enter the authorised person’s own PAN, not the business’s. An individual PAN has P as its fourth character, for example ABCPZ1234K.'
    );
  }
  if (!/^[0-9]{5,35}$/.test(result.accountNumber) || result.accountNumber !== result.confirmAccountNumber) {
    // "Masked account numbers cannot be used" was true but unexplained, and read
    // as though something had been deleted. FabricTrad only ever stores the last
    // four digits, so the full number genuinely cannot be recovered and has to be
    // typed once more here before it goes to Razorpay.
    throw new Error(
      'Both account numbers must match and be digits only. FabricTrad stores just the last four digits of your bank number, so the full number cannot be recovered from registration and has to be entered here.'
    );
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(result.ifsc)) throw new Error('Enter a valid 11-character IFSC.');
  for (const key of ['contactName', 'accountName', 'street', 'city', 'state', 'registeredStreet', 'registeredCity', 'registeredState'] as const) {
    if (result[key].length < 2 || result[key].length > (key.endsWith('State') || key === 'state' ? 32 : 100) || /[<>\r\n]/.test(result[key])) throw new Error('Complete the legal names and both addresses using valid text.');
  }
  if (result.contactName.length < 4) throw new Error('Enter the representative’s full name as on their PAN.');
  if (!/^[1-9][0-9]{5}$/.test(result.pincode) || !/^[1-9][0-9]{5}$/.test(result.registeredPincode)) throw new Error('Enter valid six-digit postal codes for both addresses.');
  if (!result.termsAccepted) throw new Error('Accept the payout terms and confirm you are authorised for this business.');
  return result;
}
