'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type Frequency = 'instant' | 'daily' | 'off';
type Category = 'orders' | 'disputes' | 'payouts' | 'marketing' | 'security';
type Setting = { id: string; topic: string; description: string; category: Category; critical: boolean; sms: boolean; email: boolean; inApp: boolean; frequency: Frequency };

const buyerDefaults: Setting[] = [
  { id: 'order-confirmed', topic: 'Order confirmations', description: 'Seller acceptance, payment and order status changes', category: 'orders', critical: true, sms: true, email: true, inApp: true, frequency: 'instant' },
  { id: 'order-shipped', topic: 'Shipment tracking', description: 'Dispatch, tracking and delivery updates', category: 'orders', critical: false, sms: true, email: true, inApp: true, frequency: 'instant' },
  { id: 'dispute-update', topic: 'Disputes and exchanges', description: 'Replies and decisions on support requests', category: 'disputes', critical: true, sms: false, email: true, inApp: true, frequency: 'instant' },
  { id: 'promotions', topic: 'Offers and new arrivals', description: 'Relevant marketplace promotions', category: 'marketing', critical: false, sms: false, email: false, inApp: true, frequency: 'daily' },
  { id: 'account-security', topic: 'Security alerts', description: 'Sign-ins and important account changes', category: 'security', critical: true, sms: true, email: true, inApp: true, frequency: 'instant' },
];
const sellerDefaults: Setting[] = [
  { id: 'new-order', topic: 'New buyer orders', description: 'Immediate notification for order requests', category: 'orders', critical: true, sms: true, email: true, inApp: true, frequency: 'instant' },
  { id: 'payment-received', topic: 'Payments received', description: 'Buyer payment confirmations', category: 'orders', critical: true, sms: true, email: true, inApp: true, frequency: 'instant' },
  { id: 'low-stock', topic: 'Low stock alerts', description: 'Listings at or below the configured threshold', category: 'orders', critical: false, sms: false, email: true, inApp: true, frequency: 'daily' },
  { id: 'payout-processed', topic: 'Payout updates', description: 'Scheduled and completed settlement notifications', category: 'payouts', critical: true, sms: true, email: true, inApp: true, frequency: 'instant' },
  { id: 'dispute-raised', topic: 'Buyer disputes', description: 'New disputes, exchanges and support replies', category: 'disputes', critical: true, sms: true, email: true, inApp: true, frequency: 'instant' },
  { id: 'account-security', topic: 'Security alerts', description: 'Sign-ins and important account changes', category: 'security', critical: true, sms: true, email: true, inApp: true, frequency: 'instant' },
];

export default function NotificationPreferences({ mode }: { mode: 'buyer' | 'seller' }) {
  const defaults = useMemo(() => mode === 'buyer' ? buyerDefaults : sellerDefaults, [mode]);
  const { user, profile, isDemoAccount } = useAuth();
  const [settings, setSettings] = useState(defaults);
  const [digestTime, setDigestTime] = useState('08:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<'all' | Category>('all');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      if (!user?.id || isDemoAccount) {
        const stored = window.localStorage.getItem(`fabrictrad:notifications:${mode}:${user?.id || 'demo'}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (active && Array.isArray(parsed.settings)) setSettings(parsed.settings);
            if (active && parsed.digestTime) setDigestTime(parsed.digestTime);
          } catch {}
        }
        if (active) setLoading(false);
        return;
      }
      const supabase = createClient();
      const [{ data: rows }, { data: userProfile }] = await Promise.all([
        supabase.from('notification_preferences').select('*').eq('user_id', user.id),
        supabase.from('user_profiles').select('notification_digest_time,notification_timezone').eq('id', user.id).maybeSingle(),
      ]);
      if (!active) return;
      const byId = new Map((rows || []).map((row) => [row.topic_id, row]));
      setSettings(defaults.map((item) => {
        const saved = byId.get(item.id);
        return saved ? { ...item, sms: !!saved.sms_enabled, email: !!saved.email_enabled, inApp: !!saved.in_app_enabled, frequency: saved.frequency as Frequency } : item;
      }));
      setDigestTime(String(userProfile?.notification_digest_time || '08:00').slice(0, 5));
      setTimezone(userProfile?.notification_timezone || 'Asia/Kolkata');
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [defaults, isDemoAccount, mode, user?.id]);

  const toggle = (id: string, channel: 'sms' | 'email' | 'inApp') => {
    setSettings((current) => current.map((item) => item.id === id ? { ...item, [channel]: !item[channel] } : item));
  };

  const save = async () => {
    if (!user?.id) return toast.error('Sign in to save notification preferences.');
    setSaving(true);
    try {
      if (isDemoAccount) {
        window.localStorage.setItem(`fabrictrad:notifications:${mode}:${user.id}`, JSON.stringify({ settings, digestTime, timezone }));
      } else {
        const supabase = createClient();
        const { error: preferenceError } = await supabase.from('notification_preferences').upsert(settings.map((item) => ({ user_id: user.id, topic_id: item.id, topic_label: item.topic, category: item.category, is_critical: item.critical, sms_enabled: item.sms, email_enabled: item.email, in_app_enabled: item.inApp, frequency: item.frequency, updated_at: new Date().toISOString() })), { onConflict: 'user_id,topic_id' });
        if (preferenceError) throw preferenceError;
        const { error: profileError } = await supabase.from('user_profiles').update({ notification_digest_time: digestTime, notification_timezone: timezone, updated_at: new Date().toISOString() }).eq('id', user.id);
        if (profileError) throw profileError;
      }
      toast.success('Notification preferences saved.');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save preferences.');
    } finally { setSaving(false); }
  };

  const visible = category === 'all' ? settings : settings.filter((item) => item.category === category);
  const categories = ['all', ...new Set(settings.map((item) => item.category))] as const;

  return <div className="max-w-5xl">
    <div className="mb-6"><h1 className="text-xl font-800 text-foreground">Notification Preferences</h1><p className="mt-1 text-xs text-muted-foreground">Choose what FabricTrad sends and where it appears.</p></div>
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-700 capitalize ${category === item ? 'bg-primary text-white' : 'border border-border bg-card text-muted-foreground'}`}>{item}</button>)}</div>
    {loading ? <div className="rounded-2xl border border-border bg-card py-16 text-center"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : <div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="hidden grid-cols-[1fr_90px_90px_90px_130px] border-b border-border bg-muted px-4 py-3 text-xs font-800 text-muted-foreground sm:grid"><span>Notification</span><span className="text-center">SMS</span><span className="text-center">Email</span><span className="text-center">In-app</span><span className="text-center">Frequency</span></div>{visible.map((item) => <div key={item.id} className="grid gap-3 border-b border-border px-4 py-4 last:border-0 sm:grid-cols-[1fr_90px_90px_90px_130px] sm:items-center"><div><div className="flex items-center gap-2"><p className="text-sm font-800 text-foreground">{item.topic}</p>{item.critical && <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-800 text-error">Required</span>}</div><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div>{(['sms','email','inApp'] as const).map((channel) => <button key={channel} type="button" onClick={() => toggle(item.id, channel)} disabled={item.critical && channel === 'inApp'} className={`mx-auto flex h-6 w-11 rounded-full p-0.5 transition-colors disabled:opacity-60 ${item[channel] ? 'justify-end bg-primary' : 'justify-start bg-muted-foreground/30'}`} aria-pressed={item[channel]} aria-label={`${channel} for ${item.topic}`}><span className="h-5 w-5 rounded-full bg-white shadow" /></button>)}<select value={item.frequency} disabled={item.critical} onChange={(event) => setSettings((current) => current.map((entry) => entry.id === item.id ? { ...entry, frequency: event.target.value as Frequency } : entry))} className="input-base rounded-xl px-2 py-2 text-xs"><option value="instant">Instant</option><option value="daily">Daily digest</option>{!item.critical && <option value="off">Off</option>}</select></div>)}</div>}
    <div className="mt-5 rounded-2xl border border-border bg-card p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-800"><Icon name="ClockIcon" size={16} className="text-secondary" />Daily digest schedule</h2><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-700">Digest time<input type="time" value={digestTime} onChange={(event) => setDigestTime(event.target.value)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm" /></label><label className="text-xs font-700">Timezone<select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm"><option value="Asia/Kolkata">India Standard Time (UTC+5:30)</option></select></label></div></div>
    <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:opacity-50"><Icon name={saving ? 'ArrowPathIcon' : 'CloudArrowUpIcon'} size={16} className={saving ? 'animate-spin' : ''} />{saving ? 'Saving…' : 'Save Notification Preferences'}</button>
  </div>;
}
