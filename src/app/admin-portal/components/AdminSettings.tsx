'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

export default function AdminSettings() {
  const [commissionRate, setCommissionRate] = useState('10');
  const [minPayout, setMinPayout] = useState('1000');
  const [payoutCycle, setPayoutCycle] = useState('biweekly');
  const [autoApprove, setAutoApprove] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-800 text-foreground">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">Marketplace-wide configuration · Super Admin only</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        {/* Commission Settings */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-800 text-foreground text-sm mb-4 flex items-center gap-2">
            <Icon name="ReceiptPercentIcon" size={16} className="text-primary" />
            Commission & Fees
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-700 text-foreground block mb-1.5">Platform Commission Rate (%)</label>
              <input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="input-base px-3 py-2 text-sm rounded-xl w-full"
                min="0" max="30"
              />
              <p className="text-xs text-muted-foreground mt-1">Applied to all seller transactions. Current: {commissionRate}%</p>
            </div>
            <div>
              <label className="text-xs font-700 text-foreground block mb-1.5">Minimum Payout Amount (₹)</label>
              <input
                type="number"
                value={minPayout}
                onChange={(e) => setMinPayout(e.target.value)}
                className="input-base px-3 py-2 text-sm rounded-xl w-full"
              />
            </div>
            <div>
              <label className="text-xs font-700 text-foreground block mb-1.5">Payout Cycle</label>
              <select
                value={payoutCycle}
                onChange={(e) => setPayoutCycle(e.target.value)}
                className="input-base px-3 py-2 text-sm rounded-xl w-full"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly (1st & 15th)</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listing Settings */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-800 text-foreground text-sm mb-4 flex items-center gap-2">
            <Icon name="TagIcon" size={16} className="text-secondary" />
            Listing Controls
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-700 text-foreground">Auto-approve listings for verified sellers</p>
                <p className="text-xs text-muted-foreground">Skip manual review for trusted sellers</p>
              </div>
              <button
                onClick={() => setAutoApprove(!autoApprove)}
                className={`w-11 h-6 rounded-full transition-colors relative ${autoApprove ? 'bg-success' : 'bg-muted border border-border'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${autoApprove ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div>
              <label className="text-xs font-700 text-foreground block mb-1.5">Seller Response Timeout (hours)</label>
              <input type="number" defaultValue="24" className="input-base px-3 py-2 text-sm rounded-xl w-full" />
              <p className="text-xs text-muted-foreground mt-1">Orders auto-cancelled if seller doesn't respond within this time</p>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-800 text-foreground text-sm mb-4 flex items-center gap-2">
            <Icon name="ShieldCheckIcon" size={16} className="text-success" />
            Security & Authentication
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-700 text-foreground">Require OTP for all registrations</p>
                <p className="text-xs text-muted-foreground">Phone OTP verification mandatory</p>
              </div>
              <button
                onClick={() => setOtpEnabled(!otpEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative ${otpEnabled ? 'bg-success' : 'bg-muted border border-border'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${otpEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div>
              <label className="text-xs font-700 text-foreground block mb-1.5">Admin Session Timeout (minutes)</label>
              <input type="number" defaultValue="30" className="input-base px-3 py-2 text-sm rounded-xl w-full" />
            </div>
            <div>
              <label className="text-xs font-700 text-foreground block mb-1.5">Max OTP Attempts</label>
              <input type="number" defaultValue="5" className="input-base px-3 py-2 text-sm rounded-xl w-full" />
            </div>
          </div>
        </div>

        {/* Integration Keys */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-800 text-foreground text-sm mb-4 flex items-center gap-2">
            <Icon name="CogIcon" size={16} className="text-muted-foreground" />
            Integration Status
          </h2>
          <div className="space-y-3">
            {[
              { name: 'Razorpay', status: 'Connected', mode: 'Test Mode', icon: 'CreditCardIcon', color: 'text-success' },
              { name: 'Shiprocket', status: 'Connected', mode: 'Sandbox', icon: 'TruckIcon', color: 'text-success' },
              { name: 'Resend Email', status: 'Connected', mode: 'Live', icon: 'EnvelopeIcon', color: 'text-success' },
              { name: 'SMS OTP', status: 'Configure Required', mode: '—', icon: 'DevicePhoneMobileIcon', color: 'text-warning' },
            ].map((integration) => (
              <div key={integration.name} className="flex items-center justify-between py-2.5 px-3 bg-muted rounded-xl">
                <div className="flex items-center gap-2">
                  <Icon name={integration.icon as 'CreditCardIcon'} size={16} className={integration.color} />
                  <div>
                    <p className="text-sm font-700 text-foreground">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.mode}</p>
                  </div>
                </div>
                <span className={`text-xs font-600 border rounded-full px-2 py-0.5 ${integration.status === 'Connected' ? 'bg-success/10 text-success border-success/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {integration.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className={`btn-primary w-full py-3 text-sm rounded-xl flex items-center justify-center gap-2 transition-all ${saved ? 'bg-success' : ''}`}
        >
          {saved ? (
            <>
              <Icon name="CheckCircleIcon" size={16} />
              Settings Saved!
            </>
          ) : (
            <>
              <Icon name="CloudArrowUpIcon" size={16} />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
