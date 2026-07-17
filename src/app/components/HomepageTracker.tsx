'use client';
import { useEffect } from 'react';
import { trackFunnelStep } from '@/lib/analytics';

export default function HomepageTracker() {
  useEffect(() => {
    trackFunnelStep('homepage_view', { page: 'home' });
  }, []);
  return null;
}
