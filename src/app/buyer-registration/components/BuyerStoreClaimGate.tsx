'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import BuyerStoreNameField from './BuyerStoreNameField';

type Store = { id: string; store_name: string; store_handle: string; is_primary: boolean };

type Props = { children: ReactNode };

export default function BuyerStoreClaimGate({ children }: Props) {
  const { user, profile } = useAuth();
  const requestedName = useMemo(
    () => String(user?.user_metadata?.requestedStoreName || '').trim(),
    [user?.user_metadata?.requestedStoreName]
  );
  const [storeName, setStoreName] = useState(requestedName);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState('');

  const refresh = async () => {
    const response = await fetch('/api/buyer/stores', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Store identity could not be loaded.');
    const next = (payload.stores || []) as Store[];
    setStores(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const existing = await refresh();
        if (cancelled || existing.length > 0 || !requestedName) return;

        // Complete the reservation that may have been deferred by email-confirmation
        // signup. DB uniqueness remains authoritative if someone claimed it meantime.
        const response = await fetch('/api/buyer/stores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            storeName: requestedName,
            source: 'onboarding',
            whatsappPhone: profile?.phone ? `91${String(profile.phone).replace(/\D/g, '').slice(-10)}` : undefined,
            primary: true,
          }),
        });
        if (response.ok) await refresh();
        else {
          const payload = await response.json().catch(() => ({}));
          if (!cancelled) setError(payload.error || 'Choose another available store name to continue.');
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Store identity could not be prepared.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // profile.phone is intentionally not a dependency: this gate should not replay
    // a successful store reservation when the profile refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedName, user]);

  const claim = async () => {
    setClaiming(true);
    setError('');
    try {
      const availabilityResponse = await fetch(
        `/api/buyer/stores/availability?name=${encodeURIComponent(storeName.trim())}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const availability = await availabilityResponse.json().catch(() => ({}));
      if (!availabilityResponse.ok || availability.available !== true) {
        throw new Error(availability.message || availability.error || 'That store name is not available.');
      }

      const response = await fetch('/api/buyer/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          storeName,
          source: 'onboarding',
          whatsappPhone: profile?.phone ? `91${String(profile.phone).replace(/\D/g, '').slice(-10)}` : undefined,
          primary: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Store name could not be reserved.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Store name could not be reserved.');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (stores.length > 0) return <>{children}</>;

  return (
    <section className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <div className="rounded-3xl border border-primary/20 bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon name="BuildingStorefrontIcon" size={21} />
          </div>
          <div>
            <p className="text-xs font-800 uppercase tracking-[0.14em] text-primary">Required onboarding step</p>
            <h2 className="mt-1 text-xl font-900 text-foreground">Reserve your FabricTrad store name</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every retail buyer gets a unique public store identity. Two accounts cannot use the same normalized name. Manage your orders and support from your buyer dashboard.
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        <div className="mt-5">
          <BuyerStoreNameField value={storeName} onChange={setStoreName} disabled={claiming} />
        </div>
        <button
          type="button"
          onClick={() => void claim()}
          disabled={claiming || storeName.trim().length < 3}
          className="btn-primary mt-5 w-full py-3 text-sm disabled:opacity-50"
        >
          {claiming ? 'Reserving store name…' : 'Reserve name & continue onboarding'}
        </button>
      </div>
    </section>
  );
}
