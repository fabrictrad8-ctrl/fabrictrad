'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, params?: Record<string, string | number | boolean>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

export function trackFunnelStep(step: 'homepage_view' | 'marketplace_view' | 'product_view' | 'checkout_start' | 'checkout_complete', params?: Record<string, string | number>) {
  trackEvent(step, { funnel_step: step, ...params });
}

export default function GAFunnelTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname === '/') {
      trackFunnelStep('homepage_view');
    } else if (pathname === '/marketplace') {
      trackFunnelStep('marketplace_view', {
        category: searchParams?.get('category') || 'all',
        source: searchParams?.get('source') || 'direct',
      });
    } else if (pathname === '/product-detail') {
      trackFunnelStep('product_view', {
        product_id: searchParams?.get('id') || 'unknown',
      });
    }
  }, [pathname, searchParams]);

  return null;
}
