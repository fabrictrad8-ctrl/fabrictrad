'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type Announcement = {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
};

const TICKER_HEIGHT = '36px';
const dismissedKey = (id: string) => `fabrictrad:ticker-dismissed:${id}`;

export default function SitewideAnnouncementTicker() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('site_announcements')
        .select('id,message,link_url,link_label')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mounted || error || !data) return;
      setAnnouncement(data);
      try {
        setDismissed(window.sessionStorage.getItem(dismissedKey(data.id)) === '1');
      } catch {
        setDismissed(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const visible = !!announcement && !dismissed;

  useEffect(() => {
    const root = document.documentElement;
    if (visible) {
      root.style.setProperty('--ft-ticker-h', TICKER_HEIGHT);
      root.classList.add('ft-ticker-active');
    } else {
      root.style.setProperty('--ft-ticker-h', '0px');
      root.classList.remove('ft-ticker-active');
    }
    return () => {
      root.style.setProperty('--ft-ticker-h', '0px');
      root.classList.remove('ft-ticker-active');
    };
  }, [visible]);

  if (!visible || !announcement) return null;

  const close = () => {
    try {
      window.sessionStorage.setItem(dismissedKey(announcement.id), '1');
    } catch {
      /* sessionStorage unavailable — the ticker just won't remember dismissal */
    }
    setDismissed(true);
  };

  const renderBody = (hidden: boolean) => (
    <span className="ft-announcement-ticker-content" aria-hidden={hidden || undefined}>
      <span className="ft-announcement-ticker-message">{announcement.message}</span>
      {announcement.link_url && (
        <Link href={announcement.link_url} tabIndex={hidden ? -1 : undefined} className="ft-announcement-ticker-cta">
          {announcement.link_label || 'Shop now'}
        </Link>
      )}
    </span>
  );

  return (
    <div className="ft-announcement-ticker" role="region" aria-label="Site announcement">
      <span className="ft-announcement-ticker-badge" aria-hidden="true">
        <Icon name="BoltIcon" size={13} />
      </span>
      <div className="ft-announcement-ticker-track">
        {renderBody(false)}
        {renderBody(true)}
      </div>
      <button type="button" onClick={close} className="ft-announcement-ticker-close" aria-label="Dismiss announcement">
        <Icon name="XMarkIcon" size={13} />
      </button>
    </div>
  );
}
