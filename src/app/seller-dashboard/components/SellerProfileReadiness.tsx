'use client';

import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

export default function SellerProfileReadiness() {
  const { profile, isDemoAccount } = useAuth();
  const checks = [
    { label: 'Business name', complete: Boolean(profile?.business_name?.trim()) },
    { label: 'Verified phone', complete: Boolean(profile?.phone && profile.phone_verified) },
    { label: 'GSTIN', complete: Boolean(profile?.gstin?.trim()) },
    { label: 'Pickup city', complete: Boolean(profile?.city?.trim()) },
    { label: 'Pickup address', complete: Boolean(profile?.address_line1?.trim() && profile?.pincode?.trim()) },
  ];
  const completed = checks.filter((item) => item.complete).length;
  const percent = Math.round((completed / checks.length) * 100);

  if (percent === 100 && !isDemoAccount) return null;

  return (
    <section className="mb-5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon name="IdentificationIcon" size={18} className="text-primary" />
            <p className="text-sm font-800 text-foreground">
              {isDemoAccount ? 'Demo seller workspace' : `Business profile ${percent}% complete`}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isDemoAccount
              ? 'Use the demo to explore the interface. A real seller profile is needed for publishing, orders and saved uploads.'
              : 'Complete these details so buyers can trust the listing and delivery information is ready.'}
          </p>
          {!isDemoAccount && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {checks.map((item) => (
              <span
                key={item.label}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-700 ${
                  item.complete
                    ? 'bg-success/10 text-success'
                    : 'border border-border bg-card text-muted-foreground'
                }`}
              >
                <Icon name={item.complete ? 'CheckCircleIcon' : 'MinusCircleIcon'} size={13} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <Link
          href="/profile"
          className="btn-secondary inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs"
        >
          <Icon name="PencilSquareIcon" size={15} /> Complete profile
        </Link>
      </div>
    </section>
  );
}
