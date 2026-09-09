/** All-inclusive FabricTrad share. Gateway costs and commission tax belong to the platform. */
export const MARKETPLACE_SHARE_BPS = 1000;
export const MARKETPLACE_SPLIT_VERSION = 'seller_90_platform_10_v1';

/**
 * Percentages for display, derived from the same constant the money is split by,
 * so a change to the share cannot leave the seller and admin screens quoting a
 * rate nobody is actually charged. Do not hardcode these in a route.
 */
export const MARKETPLACE_PLATFORM_PERCENT = MARKETPLACE_SHARE_BPS / 100;
export const MARKETPLACE_SELLER_PERCENT = 100 - MARKETPLACE_PLATFORM_PERCENT;

export function marketplaceSplit(amountPaise: number) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    throw new Error('Payment amount must be a safe integer of at least 100 paise.');
  }
  // Nearest paise to the platform share; any rounding remainder stays with the
  // platform. Derived from MARKETPLACE_SHARE_BPS rather than a separate literal
  // so the split and the advertised percentages cannot drift apart. At the
  // current 1000 bps this is identical to the previous amountPaise / 10.
  const sellerPaise = amountPaise - Math.round((amountPaise * MARKETPLACE_SHARE_BPS) / 10000);
  return { amountPaise, sellerPaise, platformPaise: amountPaise - sellerPaise };
}

export function marketplaceTransfer(amountPaise: number, accountId: string) {
  if (!/^acc_[a-zA-Z0-9]+$/.test(accountId)) throw new Error('A verified seller payout account is required.');
  return { account: accountId, amount: marketplaceSplit(amountPaise).sellerPaise, currency: 'INR', on_hold: false };
}

export function validMarketplaceTransfers(value: unknown, amountPaise: number, accountId: string): boolean {
  const collection = value as { items?: unknown[] } | null;
  const transfers = Array.isArray(value) ? value : collection?.items;
  if (!Array.isArray(transfers) || transfers.length !== 1) return false;
  const transfer = transfers[0] as Record<string, unknown>;
  return (transfer.account || transfer.recipient) === accountId &&
    Number(transfer.amount) === marketplaceSplit(amountPaise).sellerPaise &&
    transfer.currency === 'INR' && (transfer.on_hold === false || transfer.on_hold === 0) &&
    !['failed', 'reversed'].includes(String(transfer.status || '')) && Number(transfer.amount_reversed || 0) === 0;
}
