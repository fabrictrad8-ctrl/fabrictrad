/**
 * One source of truth for what a seller_tax_invoices.email_status means.
 *
 * The states fall into three groups:
 *
 *   pending | sending | failed | not_configured
 *     FabricTrad-side. The worker cron (retryUndeliveredInvoiceEmails) sweeps
 *     pending, failed and not_configured, so these are all recoverable.
 *
 *   sent
 *     Resend accepted the message. This is the weakest form of success: it
 *     says nothing about whether the buyer's mail server took it.
 *
 *   delivered | bounced | complained
 *     From Resend delivery webhooks, and terminal. 'delivered' is the only
 *     status that actually proves the buyer received their GST document.
 *
 * Why this file exists: 'delivered' is strictly *better* news than 'sent', but
 * every reader used to test `email_status === 'sent'` literally. The moment a
 * webhook upgraded a row from sent to delivered, a successful delivery started
 * rendering as "pending" in the buyer and seller dashboards and started
 * counting as a problem in the admin tile — exactly backwards. Any new state
 * must be classified here, once, rather than in each consumer.
 */

/** Statuses meaning the document reached, or was accepted for, the buyer. */
export const INVOICE_EMAIL_REACHED_BUYER = ['sent', 'delivered'] as const;

/** Statuses meaning delivery will not happen without human intervention. */
export const INVOICE_EMAIL_FAILED = ['failed', 'bounced', 'complained'] as const;

/**
 * True when the buyer has their invoice, or the provider has accepted it for
 * delivery. Use this instead of comparing against 'sent'.
 */
export function invoiceEmailReachedBuyer(status: string | null | undefined): boolean {
  return status === 'sent' || status === 'delivered';
}

/**
 * True when delivery has definitively failed. A bounce needs a corrected
 * address and a complaint must never be resent, so neither is retried.
 */
export function invoiceEmailFailed(status: string | null | undefined): boolean {
  return status === 'failed' || status === 'bounced' || status === 'complained';
}

/** Short human label for an invoice email status. */
export function invoiceEmailLabel(status: string | null | undefined): string {
  switch (status) {
    case 'delivered':
      return 'Email delivered';
    case 'sent':
      return 'Email submitted';
    case 'sending':
      return 'Sending email';
    case 'bounced':
      return 'Email bounced';
    case 'complained':
      return 'Marked as spam';
    case 'failed':
      return 'Email retry needed';
    case 'not_configured':
      return 'Email not configured';
    default:
      return 'Email queued';
  }
}
