'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import CommerceNotificationFeed from '@/app/components/CommerceNotificationFeed';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type Frequency = 'instant' | 'daily' | 'off';
type Category = 'orders' | 'disputes' | 'payouts' | 'marketing' | 'security';
type Channel = 'sms' | 'email' | 'inApp';
type Setting = {
  id: string;
  topic: string;
  description: string;
  category: Category;
  critical: boolean;
  requiredChannels: Channel[];
  sms: boolean;
  email: boolean;
  inApp: boolean;
  frequency: Frequency;
};

const buyerDefaults: Setting[] = [
  {
    id: 'order-confirmed',
    topic: 'Order updates',
    description: 'Confirmation, seller acceptance, payment, cancellation and order-status changes',
    category: 'orders',
    critical: true,
    requiredChannels: ['inApp'],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'order-shipped',
    topic: 'Delivery and tracking',
    description: 'Dispatch, tracking, delivery attempts and delivered status',
    category: 'orders',
    critical: false,
    requiredChannels: [],
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'dispute-update',
    topic: 'Returns, exchanges and disputes',
    description: 'Support replies, return decisions, exchange updates and dispute resolutions',
    category: 'disputes',
    critical: true,
    requiredChannels: ['inApp'],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'promotions',
    topic: 'Offers and new arrivals',
    description: 'Optional marketplace promotions and product recommendations',
    category: 'marketing',
    critical: false,
    requiredChannels: [],
    sms: false,
    email: false,
    inApp: false,
    frequency: 'off',
  },
  {
    id: 'account-security',
    topic: 'Security alerts',
    description: 'New sign-ins and important account or authentication changes',
    category: 'security',
    critical: true,
    requiredChannels: ['email', 'inApp'],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
];

const sellerDefaults: Setting[] = [
  {
    id: 'new-order',
    topic: 'New orders',
    description: 'New buyer order requests that need seller action',
    category: 'orders',
    critical: true,
    requiredChannels: ['email', 'inApp'],
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'order-changed',
    topic: 'Order changes and cancellations',
    description: 'Buyer changes, cancellations and time-sensitive order status updates',
    category: 'orders',
    critical: true,
    requiredChannels: ['inApp'],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'payment-received',
    topic: 'Payments received',
    description: 'Verified buyer payment confirmations for accepted orders',
    category: 'payouts',
    critical: true,
    requiredChannels: ['email', 'inApp'],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'low-stock',
    topic: 'Low stock',
    description: 'Products or variants at or below the configured stock threshold',
    category: 'orders',
    critical: false,
    requiredChannels: [],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'daily',
  },
  {
    id: 'shipping-exception',
    topic: 'Shipping exceptions',
    description: 'Pickup failures, courier exceptions and delivery problems requiring attention',
    category: 'orders',
    critical: true,
    requiredChannels: ['inApp'],
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'payout-processed',
    topic: 'Payout and settlement updates',
    description: 'Settlement scheduled, processed, failed or placed on hold',
    category: 'payouts',
    critical: true,
    requiredChannels: ['email', 'inApp'],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'dispute-raised',
    topic: 'Returns and disputes',
    description: 'New buyer disputes, return requests and resolution replies',
    category: 'disputes',
    critical: true,
    requiredChannels: ['email', 'inApp'],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'account-security',
    topic: 'Security alerts',
    description: 'New sign-ins and important account, bank or authentication changes',
    category: 'security',
    critical: true,
    requiredChannels: ['email', 'inApp'],
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
];

const enforceRequiredChannels = (setting: Setting): Setting => {
  const next = { ...setting };
  setting.requiredChannels.forEach((channel) => {
    next[channel] = true;
  });
  if (setting.critical) next.frequency = 'instant';
  return next;
};

const requiredLabel = (channels: Channel[]) => {
  if (!channels.length) return '';
  return channels
    .map((channel) => (channel === 'inApp' ? 'in-app' : channel.toUpperCase()))
    .join(' + ');
};

export default function NotificationPreferences({ mode }: { mode: 'buyer' | 'seller' }) {
  const defaults = useMemo(() => (mode === 'buyer' ? buyerDefaults : sellerDefaults), [mode]);
  const { user, isDemoAccount } = useAuth();
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
        const stored = window.localStorage.getItem(
          `fabrictrad:notifications:${mode}:${user?.id || 'demo'}`
        );
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (active && Array.isArray(parsed.settings)) {
              const byId = new Map(parsed.settings.map((entry: Setting) => [entry.id, entry]));
              setSettings(
                defaults.map((item) =>
                  enforceRequiredChannels({ ...item, ...(byId.get(item.id) || {}) })
                )
              );
            }
            if (active && parsed.digestTime) setDigestTime(parsed.digestTime);
            if (active && parsed.timezone) setTimezone(parsed.timezone);
          } catch {}
        } else if (active) {
          setSettings(defaults.map(enforceRequiredChannels));
        }
        if (active) setLoading(false);
        return;
      }

      const supabase = createClient();
      const [notifResult, profileResult] = await Promise.all([
        supabase.from('notification_preferences').select('*').eq('user_id', user.id),
        supabase
          .from('user_profiles')
          .select('notification_digest_time,notification_timezone')
          .eq('id', user.id)
          .maybeSingle(),
      ]);
      const rows = notifResult.data;
      const userProfile = profileResult.data;
      if (!active) return;

      const byId = new Map((rows || []).map((row) => [row.topic_id, row]));
      setSettings(
        defaults.map((item) => {
          const saved = byId.get(item.id);
          const merged = saved
            ? {
                ...item,
                sms: !!saved.sms_enabled,
                email: !!saved.email_enabled,
                inApp: !!saved.in_app_enabled,
                frequency: saved.frequency as Frequency,
              }
            : item;
          return enforceRequiredChannels(merged);
        })
      );
      setDigestTime(String(userProfile?.notification_digest_time || '08:00').slice(0, 5));
      setTimezone(userProfile?.notification_timezone || 'Asia/Kolkata');
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [defaults, isDemoAccount, mode, user?.id]);

  const toggle = (id: string, channel: Channel) => {
    setSettings((current) =>
      current.map((item) => {
        if (item.id !== id || item.requiredChannels.includes(channel)) return item;
        return { ...item, [channel]: !item[channel] };
      })
    );
  };

  const updateFrequency = (id: string, frequency: Frequency) => {
    setSettings((current) =>
      current.map((item) => {
        if (item.id !== id || item.critical) return item;
        return {
          ...item,
          frequency,
          ...(frequency === 'off' ? { sms: false, email: false, inApp: false } : {}),
        };
      })
    );
  };

  const save = async () => {
    if (!user?.id) return toast.error('Sign in to save notification preferences.');
    setSaving(true);
    try {
      const safeSettings = settings.map(enforceRequiredChannels);
      setSettings(safeSettings);
      if (isDemoAccount) {
        window.localStorage.setItem(
          `fabrictrad:notifications:${mode}:${user.id}`,
          JSON.stringify({ settings: safeSettings, digestTime, timezone })
        );
      } else {
        const supabase = createClient();
        const { error: preferenceError } = await supabase
          .from('notification_preferences')
          .upsert(
            safeSettings.map((item) => ({
              user_id: user.id,
              topic_id: item.id,
              topic_label: item.topic,
              category: item.category,
              is_critical: item.critical,
              sms_enabled: item.sms,
              email_enabled: item.email,
              in_app_enabled: item.inApp,
              frequency: item.frequency,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'user_id,topic_id' }
          );
        if (preferenceError) throw preferenceError;

        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            notification_digest_time: digestTime,
            notification_timezone: timezone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        if (profileError) throw profileError;
      }
      toast.success('Notification preferences saved.');
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : 'Could not save preferences.'
      );
    } finally {
      setSaving(false);
    }
  };

  const visible = category === 'all' ? settings : settings.filter((item) => item.category === category);
  const categories = ['all', ...new Set(settings.map((item) => item.category))] as Array<'all' | Category>;
  const hasDailyDigest = settings.some((item) => item.frequency === 'daily');

  return (
    <div className="max-w-5xl">
      <CommerceNotificationFeed mode={mode} />

      <div className="mb-6">
        <p className="ft-route-kicker">Delivery preferences</p>
        <h1 className="mt-1 text-xl font-800 text-foreground">
          {mode === 'seller' ? 'Seller notifications' : 'Buyer notifications'}
        </h1>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
          {mode === 'seller' ?'Keep time-sensitive order, payment, payout, shipping and dispute alerts visible while choosing where optional alerts are delivered.' :'Keep essential order, dispute and security updates visible while choosing how optional delivery and marketing alerts reach you.'}
        </p>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Essential channels are locked on so an account cannot accidentally miss a transaction or security event. SMS is optional unless explicitly enabled.
        </p>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-700 capitalize ${
              category === item
                ? 'bg-primary text-white' :'border border-border bg-card text-muted-foreground'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center">
          <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[1fr_90px_90px_90px_130px] border-b border-border bg-muted px-4 py-3 text-xs font-800 text-muted-foreground sm:grid">
            <span>Notification</span>
            <span className="text-center">SMS</span>
            <span className="text-center">Email</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Frequency</span>
          </div>
          {visible.map((item) => (
            <div
              key={item.id}
              className="grid gap-3 border-b border-border px-4 py-4 last:border-0 sm:grid-cols-[1fr_90px_90px_90px_130px] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-800 text-foreground">{item.topic}</p>
                  {item.critical && (
                    <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-800 text-error">
                      Essential
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                {!!item.requiredChannels.length && (
                  <p className="mt-1 text-[10px] font-750 text-muted-foreground">
                    Always on: {requiredLabel(item.requiredChannels)}
                  </p>
                )}
              </div>
              {(['sms', 'email', 'inApp'] as const).map((channel) => {
                const locked = item.requiredChannels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => toggle(item.id, channel)}
                    disabled={locked}
                    title={locked ? 'Required for essential account or transaction updates' : undefined}
                    className={`mx-auto flex h-6 w-11 rounded-full p-0.5 transition-colors disabled:cursor-not-allowed ${
                      item[channel] ? 'justify-end bg-primary' : 'justify-start bg-muted-foreground/30'
                    } ${locked ? 'ring-2 ring-primary/15' : ''}`}
                    aria-pressed={item[channel]}
                    aria-label={`${channel} for ${item.topic}${locked ? ' (required)' : ''}`}
                  >
                    <span className="h-5 w-5 rounded-full bg-white shadow" />
                  </button>
                );
              })}
              <select
                value={item.frequency}
                disabled={item.critical}
                onChange={(event) => updateFrequency(item.id, event.target.value as Frequency)}
                className="input-base rounded-xl px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="instant">Instant</option>
                <option value="daily">Daily digest</option>
                {!item.critical && <option value="off">Off</option>}
              </select>
            </div>
          ))}
        </div>
      )}

      {hasDailyDigest && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-800">
            <Icon name="ClockIcon" size={16} className="text-secondary" /> Daily digest schedule
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-700">
              Digest time
              <input
                type="time"
                value={digestTime}
                onChange={(event) => setDigestTime(event.target.value)}
                className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-700">
              Timezone
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="input-base mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="Asia/Kolkata">India Standard Time (UTC+5:30)</option>
              </select>
            </label>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:opacity-50"
      >
        <Icon
          name={saving ? 'ArrowPathIcon' : 'CloudArrowUpIcon'}
          size={16}
          className={saving ? 'animate-spin' : ''}
        />
        {saving ? 'Saving…' : 'Save notification preferences'}
      </button>
    </div>
  );
}
