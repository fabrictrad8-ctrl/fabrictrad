import { NextResponse } from 'next/server';
import { MARKETPLACE_PLATFORM_PERCENT, MARKETPLACE_SELLER_PERCENT } from '@/lib/marketplaceSplit';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdministrator } from '@/lib/server/requireAdministrator';
import { getRazorpayCredentials } from '@/lib/razorpayCredentials';
import { INVOICE_EMAIL_REACHED_BUYER } from '@/lib/invoiceEmailStatus';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  if (!await requireAdministrator()) return json({ error: 'Sign in as an administrator using email OTP.' }, 403);
  const admin = createAdminClient();
  const [policies, eligibleSellers, readySellers, invoiceTotal, acceptedInvoices, credentials] = await Promise.all([
    admin.from('platform_policies').select('policy_key,policy_value').in('policy_key', ['platform_commission_rate', 'platform_commission_gst_rate', 'payment_processing_rate', 'seller_settlement_delay_hours']),
    admin.from('seller_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true).eq('settlement_eligible', true),
    admin.from('seller_payout_accounts').select('seller_id,seller_profiles!inner(is_active,settlement_eligible)', { count: 'exact', head: true }).eq('activation_status', 'activated').eq('setup_state', 'submitted').eq('seller_profiles.is_active', true).eq('seller_profiles.settlement_eligible', true),
    admin.from('seller_tax_invoices').select('*', { count: 'exact', head: true }),
    admin.from('seller_tax_invoices').select('*', { count: 'exact', head: true }).in('email_status', [...INVOICE_EMAIL_REACHED_BUYER]),
    getRazorpayCredentials({ allowTestInProduction: true }),
  ]);
  if ([policies, eligibleSellers, readySellers, invoiceTotal, acceptedInvoices].some(result => result.error)) return json({ error: 'Live configuration could not be loaded. Please retry.' }, 503);
  // Production sets SMTP_PASS (the name authEmail.ts and Resend's own SMTP
  // credentials use) and has no RESEND_API_KEY. Reading only SMTP_PASSWORD —
  // a name that exists nowhere — reported email as unconfigured while invoices
  // were sending correctly. Kept in step with emailApiKey() in automaticInvoice.ts.
  const invoiceEmailKey = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)?.trim();
  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim() || invoiceEmailKey?.startsWith('re_'));
  return json({
    checkedAt: new Date().toISOString(),
    policies: Object.fromEntries((policies.data || []).map(row => [row.policy_key, row.policy_value])),
    payments: { configured: Boolean(credentials), mode: credentials?.keyId.startsWith('rzp_live_') ? 'live' : credentials?.keyId.startsWith('rzp_test_') ? 'test' : 'unavailable' },
    payouts: { sellerSharePercent: MARKETPLACE_SELLER_PERCENT, platformSharePercent: MARKETPLACE_PLATFORM_PERCENT, verifiedAccounts: readySellers.count || 0, eligibleSellers: eligibleSellers.count || 0, missingAccounts: Math.max(0, (eligibleSellers.count || 0) - (readySellers.count || 0)) },
    invoices: { emailConfigured, awaitingEmail: Math.max(0, (invoiceTotal.count || 0) - (acceptedInvoices.count || 0)), providerAccepted: acceptedInvoices.count || 0 },
    whatsapp: { channelConfigured: Boolean(process.env.GUPSHUP_API_KEY && process.env.GUPSHUP_SOURCE_NUMBER), callbackSecretConfigured: String(process.env.GUPSHUP_WEBHOOK_SECRET || '').length >= 32, audience: 'sellers_only' },
    drape: { configured: Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY), full3dReady: false },
  });
}
