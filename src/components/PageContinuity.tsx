'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function PageContinuity() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = `${pathname}${search ? `?${search}` : ''}`;

  useEffect(() => {
    const key = `fabrictrad:page:${routeKey}`;
    const save = () => {
      try {
        sessionStorage.setItem(key, JSON.stringify({ y: window.scrollY, at: Date.now() }));
      } catch {}
    };
    try {
      const raw = sessionStorage.getItem(key);
      const saved = raw ? JSON.parse(raw) as { y?: number; at?: number } : null;
      if (saved?.at && Date.now() - saved.at < 12 * 60 * 60 * 1000) {
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, Number(saved.y || 0))));
      }
    } catch {}

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      save();
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [routeKey]);

  return null;
}
