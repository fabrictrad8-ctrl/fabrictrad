'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AdminPayoutAccounts from './AdminPayoutAccounts';

type Settings = {
  checkedAt: string;
  policies: Record<string, string>;
  payments: { configured: boolean; mode: string };
  payouts: { eligibleSellers: number; missingAccounts: number };
  invoices: { emailConfigured: boolean; awaitingEmail: number; providerAccepted: number };
  whatsapp: { channelConfigured: boolean; callbackSecretConfigured: boolean; audience: string };
  drape: { configured: boolean; full3dReady: boolean };
};
const policyLabels: Record<string, string> = { platform_commission_rate: 'Platform commission', platform_commission_gst_rate: 'GST on commission', payment_processing_rate: 'Processing fee estimate', seller_settlement_delay_hours: 'Settlement delay after delivery (hours)' };

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/settings', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Configuration unavailable.');
      setSettings(data);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Configuration unavailable.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="max-w-5xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-800">Platform configuration</h1><p className="mt-2 text-base text-muted-foreground">Current settings and the setup needed to operate the marketplace.</p></div>
      <button onClick={() => void load()} disabled={loading} className="ft-secondary-action inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-700"><Icon name="ArrowPathIcon" size={18} />{loading ? 'Checking…' : 'Refresh status'}</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    <AdminPayoutAccounts />
    {settings && <>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-800">Payments & seller payouts</h2><p className="mt-3 text-base">Payment credentials: <strong>{settings.payments.configured ? settings.payments.mode.toUpperCase() : 'Missing'}</strong></p><p className="mt-2 text-sm text-muted-foreground">{settings.payouts.eligibleSellers} eligible sellers · {settings.payouts.missingAccounts} without a Razorpay-verified payout bank.</p>{settings.payouts.missingAccounts > 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Complete each seller’s Razorpay linked-account setup before expecting settlement to their bank.</p>}<Link href="/admin-portal?tab=sellers" className="mt-4 inline-flex min-h-11 items-center text-sm font-700 text-primary underline">Review sellers</Link></section>
        <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-800">Invoices & email</h2><p className="mt-3 text-base">Email service: <strong>{settings.invoices.emailConfigured ? 'Key configured' : 'Setup required'}</strong></p><p className="mt-2 text-sm text-muted-foreground">{settings.invoices.awaitingEmail} awaiting email · {settings.invoices.providerAccepted} accepted by the email provider.</p><p className="mt-4 text-sm text-muted-foreground">Provider acceptance does not confirm inbox delivery. Review pending invoices and verify the sending domain with your email provider.</p><Link href="/admin-portal?tab=orders" className="mt-4 inline-flex min-h-11 items-center text-sm font-700 text-primary underline">Review orders and invoice delivery</Link></section>
        <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-800">Seller WhatsApp uploads</h2><p className="mt-3 text-base">Channel: <strong>{settings.whatsapp.channelConfigured ? 'Configured' : 'Setup required'}</strong></p><p className="mt-2 text-sm text-muted-foreground">Callback secret: {settings.whatsapp.callbackSecretConfigured ? 'Configured on the server' : 'Missing'}.</p><p className="mt-4 text-sm text-muted-foreground">Use the same webhook secret on the Gupshup callback and the server, then verify a seller upload. WhatsApp is reserved for sellers; buyer messaging is disabled.</p></section>
        <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-800">Virtual Drape</h2><p className="mt-3 text-base">Image provider: <strong>{settings.drape.configured ? 'Key configured' : 'Setup required'}</strong></p><p className="mt-4 text-sm text-muted-foreground">Generation also requires available provider credits. The current experience produces AI images; live 3D body tracking and a full 3D try-on service are not ready.</p></section>
      </div>
      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-lg font-800">Recorded accounting settings</h2><dl className="mt-4 divide-y divide-border">{Object.entries(settings.policies).map(([key, value]) => <div key={key} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><dt>{policyLabels[key] || key}</dt><dd className="font-700">{key.endsWith('_rate') ? `${Number(value) * 100}%` : value}</dd></div>)}</dl><p className="mt-4 text-sm text-muted-foreground">The seller’s allocation is fixed at 90%. Commission tax and processing costs are accounted for within FabricTrad’s 10%; legacy fee and hold settings below do not add seller deductions or hold new Route transfers. Credentials are managed through the protected deployment configuration. Sellers choose a shipment provider separately for every order and supply its AWB and tracking link.</p></section>
      <p className="text-sm text-muted-foreground">Last checked: {new Date(settings.checkedAt).toLocaleString('en-IN')}</p>
    </>}
  </div>;
}
