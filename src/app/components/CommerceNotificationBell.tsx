'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

export default function CommerceNotificationBell({
  mode,
  onClick,
  label = 'Open notifications',
}: {
  mode: 'buyer' | 'seller';
  onClick: () => void;
  label?: string;
}) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setUnread(0);
      return;
    }
    const { count, error } = await supabase
      .from('commerce_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('audience', mode)
      .eq('is_read', false);
    if (!error) setUnread(Number(count || 0));
  }, [mode, supabase, user?.id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        window.setTimeout(() => void refresh(), 500);
      }}
      className="ft-icon-button relative"
      aria-label={unread ? `${label}, ${unread} unread` : label}
    >
      <Icon name={unread ? 'BellAlertIcon' : 'BellIcon'} size={18} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-900 leading-none text-white ring-2 ring-card">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
