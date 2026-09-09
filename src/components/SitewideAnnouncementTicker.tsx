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

/**
 * Shown when no announcement is active, so the bar states what FabricTrad is
 * instead of leaving a dead strip. Every claim here has to stay true of the
 * platform itself, because this runs with no admin reviewing it: sellers really
 * are gated on verification_status, issue_catalog_tax_invoice really does raise
 * a GST invoice on captured payment, and payments really are Razorpay. It
 * deliberately promises no discount or delivery time — an admin announcement
 * takes over the moment one is published.
 */
const DEFAULT_ANNOUNCEMENT: Announcement = {
  id: 'fabrictrad-default',
  message:
    'FabricTrad — India’s textile marketplace · Verified sellers · GST invoice on every paid order · Secure payments by Razorpay',
  link_url: '/marketplace',
  link_label: 'Browse fabrics',
};

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
      if (!mounted) return;
      // RLS only returns rows that are active and inside their schedule, so no
      // row means nothing is running and the brand default takes the slot.
      const next = error || !data ? DEFAULT_ANNOUNCEMENT : data;
      setAnnouncement(next);
      try {
        setDismissed(window.sessionStorage.getItem(dismissedKey(next.id)) === '1');
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
