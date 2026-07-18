'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface NotificationSetting {
  id: string;
  topic: string;
  description: string;
  category: 'orders' | 'disputes' | 'payouts' | 'marketing' | 'security';
  critical: boolean;
  sms: boolean;
  email: boolean;
  inApp: boolean;
  frequency: 'instant' | 'daily' | 'off';
}

const buyerDefaults: NotificationSetting[] = [
  {
    id: 'order-placed',
    topic: 'Order Placed',
    description: 'Confirmation when your order is placed',
    category: 'orders',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'order-confirmed',
    topic: 'Seller Confirmed',
    description: 'When seller accepts your order',
    category: 'orders',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'payment-success',
    topic: 'Payment Successful',
    description: 'Payment confirmation and receipt',
    category: 'orders',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'order-shipped',
    topic: 'Order Shipped',
    description: 'Tracking details when order is dispatched',
    category: 'orders',
    critical: false,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'order-delivered',
    topic: 'Order Delivered',
    description: 'Delivery confirmation',
    category: 'orders',
    critical: false,
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'dispute-update',
    topic: 'Dispute Updates',
    description: 'Status changes on your disputes',
    category: 'disputes',
    critical: true,
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'exchange-approved',
    topic: 'Exchange Approved',
    description: 'When exchange request is approved',
    category: 'disputes',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'promotions',
    topic: 'Promotions & Offers',
    description: 'Deals, discounts, and new arrivals',
    category: 'marketing',
    critical: false,
    sms: false,
    email: false,
    inApp: true,
    frequency: 'daily',
  },
];

const sellerDefaults: NotificationSetting[] = [
  {
    id: 'new-order',
    topic: 'New Order Received',
    description: 'Immediate alert for new orders',
    category: 'orders',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'order-timeout',
    topic: 'Order Response Timeout',
    description: 'Warning before order auto-cancels',
    category: 'orders',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'payment-received',
    topic: 'Payment Received',
    description: 'When buyer completes payment',
    category: 'orders',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'payout-processed',
    topic: 'Payout Processed',
    description: 'When your payout is transferred',
    category: 'payouts',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'payout-scheduled',
    topic: 'Payout Scheduled',
    description: 'Upcoming payout reminders',
    category: 'payouts',
    critical: false,
    sms: false,
    email: true,
    inApp: true,
    frequency: 'daily',
  },
  {
    id: 'dispute-raised',
    topic: 'Dispute Raised',
    description: 'When buyer raises a dispute',
    category: 'disputes',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'listing-approved',
    topic: 'Listing Approved',
    description: 'When your product listing goes live',
    category: 'orders',
    critical: false,
    sms: false,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
  {
    id: 'low-stock',
    topic: 'Low Stock Alert',
    description: 'When inventory falls below threshold',
    category: 'orders',
    critical: false,
    sms: false,
    email: true,
    inApp: true,
    frequency: 'daily',
  },
  {
    id: 'account-security',
    topic: 'Security Alerts',
    description: 'Login attempts and account changes',
    category: 'security',
    critical: true,
    sms: true,
    email: true,
    inApp: true,
    frequency: 'instant',
  },
];

const categoryColors: Record<string, string> = {
  orders: 'text-primary bg-primary/10',
  disputes: 'text-error bg-error/10',
  payouts: 'text-success bg-success/10',
  marketing: 'text-purple-600 bg-purple-50',
  security: 'text-warning bg-amber-50',
};

interface Props {
  mode: 'buyer' | 'seller';
}

export default function NotificationPreferences({ mode }: Props) {
  const defaults = mode === 'buyer' ? buyerDefaults : sellerDefaults;
  const [settings, setSettings] = useState<NotificationSetting[]>(defaults);
  const [globalSms, setGlobalSms] = useState(true);
  const [globalEmail, setGlobalEmail] = useState(true);
  const [globalInApp, setGlobalInApp] = useState(true);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(defaults.map((s) => s.category)))];

  const toggle = (id: string, channel: 'sms' | 'email' | 'inApp') => {
    setSettings((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.critical && channel !== 'inApp') return s; // can't disable critical SMS/email
        return { ...s, [channel]: !s[channel] };
      })
    );
  };

  const setFrequency = (id: string, freq: 'instant' | 'daily' | 'off') => {
    setSettings((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.critical && freq === 'off') return s;
        return { ...s, frequency: freq };
      })
    );
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const filtered =
    activeCategory === 'all' ? settings : settings.filter((s) => s.category === activeCategory);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-800 text-foreground">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Control how and when you receive notifications
        </p>
      </div>

      {/* Global Channel Toggles */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-5">
        <h3 className="font-800 text-foreground text-sm mb-4 flex items-center gap-2">
          <Icon name="BellIcon" size={16} className="text-primary" />
          Notification Channels
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              key: 'sms',
              label: 'SMS',
              desc: 'Text messages to your phone',
              icon: 'DevicePhoneMobileIcon',
              state: globalSms,
              set: setGlobalSms,
            },
            {
              key: 'email',
              label: 'Email',
              desc: 'Notifications to your email',
              icon: 'EnvelopeIcon',
              state: globalEmail,
              set: setGlobalEmail,
            },
            {
              key: 'inApp',
              label: 'In-App',
              desc: 'Push & in-app notifications',
              icon: 'BellIcon',
              state: globalInApp,
              set: setGlobalInApp,
            },
          ].map((ch) => (
            <div
              key={ch.key}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${ch.state ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${ch.state ? 'bg-primary/10' : 'bg-muted'}`}
                >
                  <Icon
                    name={ch.icon as 'BellIcon'}
                    size={16}
                    className={ch.state ? 'text-primary' : 'text-muted-foreground'}
                  />
                </div>
                <div>
                  <p className="text-sm font-700 text-foreground">{ch.label}</p>
                  <p className="text-xs text-muted-foreground">{ch.desc}</p>
                </div>
              </div>
              <button
                onClick={() => ch.set(!ch.state)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${ch.state ? 'bg-primary' : 'bg-muted border border-border'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ch.state ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <Icon name="ExclamationTriangleIcon" size={14} className="text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            <span className="font-700">Critical alerts</span> (payments, security, disputes) cannot
            be fully disabled to ensure you never miss important updates.
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-thin pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-600 capitalize transition-all ${
              activeCategory === cat
                ? 'bg-secondary text-white'
                : 'bg-card border border-border text-muted-foreground hover:border-secondary'
            }`}
          >
            {cat === 'all' ? 'All Topics' : cat}
          </button>
        ))}
      </div>

      {/* Notification Settings Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground">
                  Topic
                </th>
                <th className="text-center px-3 py-3 text-xs font-700 text-muted-foreground">
                  SMS
                </th>
                <th className="text-center px-3 py-3 text-xs font-700 text-muted-foreground">
                  Email
                </th>
                <th className="text-center px-3 py-3 text-xs font-700 text-muted-foreground">
                  In-App
                </th>
                <th className="text-center px-4 py-3 text-xs font-700 text-muted-foreground">
                  Frequency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((setting) => (
                <tr key={setting.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-xs font-700 text-foreground">{setting.topic}</p>
                          {setting.critical && (
                            <span className="text-xs bg-error/10 text-error px-1.5 py-0.5 rounded font-600">
                              Critical
                            </span>
                          )}
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-600 capitalize ${categoryColors[setting.category]}`}
                          >
                            {setting.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{setting.description}</p>
                      </div>
                    </div>
                  </td>
                  {(['sms', 'email', 'inApp'] as const).map((ch) => (
                    <td key={ch} className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggle(setting.id, ch)}
                        disabled={setting.critical && ch !== 'inApp'}
                        className={`w-9 h-5 rounded-full transition-colors relative mx-auto block disabled:opacity-40 disabled:cursor-not-allowed ${
                          setting[ch] ? 'bg-primary' : 'bg-muted border border-border'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${setting[ch] ? 'translate-x-4' : 'translate-x-0.5'}`}
                        />
                      </button>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <select
                      value={setting.frequency}
                      onChange={(e) =>
                        setFrequency(setting.id, e.target.value as 'instant' | 'daily' | 'off')
                      }
                      disabled={setting.critical}
                      className="input-base px-2 py-1 text-xs rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="instant">Instant</option>
                      <option value="daily">Daily Digest</option>
                      {!setting.critical && <option value="off">Off</option>}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digest Schedule */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-5">
        <h3 className="font-800 text-foreground text-sm mb-4 flex items-center gap-2">
          <Icon name="ClockIcon" size={16} className="text-secondary" />
          Daily Digest Schedule
        </h3>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-xs font-700 text-foreground block mb-1.5">Digest Time</label>
            <select className="input-base px-3 py-2 text-sm rounded-xl">
              <option>8:00 AM</option>
              <option>9:00 AM</option>
              <option>12:00 PM</option>
              <option>6:00 PM</option>
              <option>9:00 PM</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-700 text-foreground block mb-1.5">Timezone</label>
            <select className="input-base px-3 py-2 text-sm rounded-xl">
              <option>IST (UTC+5:30)</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`btn-primary w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2 transition-all ${saved ? 'bg-success' : ''}`}
      >
        {saved ? (
          <>
            <Icon name="CheckCircleIcon" size={16} />
            Preferences Saved!
          </>
        ) : (
          <>
            <Icon name="CloudArrowUpIcon" size={16} />
            Save Notification Preferences
          </>
        )}
      </button>
    </div>
  );
}
