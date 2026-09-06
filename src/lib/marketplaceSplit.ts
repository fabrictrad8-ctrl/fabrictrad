/** All-inclusive FabricTrad share. Gateway costs and commission tax belong to the platform. */
export const MARKETPLACE_SHARE_BPS = 1000;
export const MARKETPLACE_SPLIT_VERSION = 'seller_90_platform_10_v1';

export function marketplaceSplit(amountPaise: number) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
    throw new Error('Payment amount must be a safe integer of at least 100 paise.');
  }
  // Nearest paise to 90%; any rounding remainder is retained by the platform.
  const sellerPaise = amountPaise - Math.round(amountPaise / 10);
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
