'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

export type DeliveryAddressState = {
  /** Formatted single-line address, or null when no complete address exists. */
  formatted: string | null;
  /** False until the check has finished, so callers don't flash a false warning. */
  ready: boolean;
};

/**
 * Mirrors public.buyer_has_shippable_address() and the address resolution in
 * /api/shiprocket/create-order: buyer_profiles.billing_address first, falling
 * back to the user_profiles columns.
 *
 * The database refuses to create an order without a shippable address
 * (errcode FT002) because order creation commits the seller's stock. This hook
 * exists purely so the buyer is told before they try, not to enforce anything —
 * the enforcement is server-side and cannot be bypassed from here.
 */
export function useDeliveryAddress(): DeliveryAddressState {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [formatted, setFormatted] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setFormatted(null);
      setReady(true);
      return;
    }
    let active = true;
    setReady(false);
    void (async () => {
      const [{ data: buyerProfile }, { data: userProfile }] = await Promise.all([
        supabase.from('buyer_profiles').select('billing_address').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_profiles').select('address_line1,city,state,pincode').eq('id', user.id).maybeSingle(),
      ]);
      if (!active) return;
      const billing = (buyerProfile?.billing_address || {}) as Record<string, unknown>;
      const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
      const line1 = str(billing.line1 || billing.address_line1) || str(userProfile?.address_line1);
      const city = str(billing.city) || str(userProfile?.city);
      const state = str(billing.state) || str(userProfile?.state);
      const pin = str(billing.pincode) || str(userProfile?.pincode);
      const complete = line1.length >= 3 && Boolean(city) && Boolean(state) && /^[1-9][0-9]{5}$/.test(pin);
      setFormatted(complete ? [line1, city, state, pin].filter(Boolean).join(', ') : null);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [supabase, user?.id]);

  return { formatted, ready };
}
