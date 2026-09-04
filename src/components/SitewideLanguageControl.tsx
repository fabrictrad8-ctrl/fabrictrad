'use client';

import { useEffect, useState } from 'react';
import PreferenceControls from '@/components/PreferenceControls';

/**
 * Safety-net language selector for routes that do not render the shared Header.
 * Normal headers/landing pages render an embedded control; this fallback only
 * appears when no embedded selector exists, so every route remains switchable
 * without duplicating controls.
 */
export default function SitewideLanguageControl() {
  const [needsFallback, setNeedsFallback] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setNeedsFallback(!document.querySelector('[data-language-control="embedded"]'));
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!needsFallback) return null;

  return (
    <div
      data-sitewide-language-fallback
      className="fixed bottom-4 right-4 z-[120] rounded-full bg-white/95 p-1 shadow-[0_12px_36px_rgba(15,23,42,0.18)] backdrop-blur-xl print:hidden"
    >
      <PreferenceControls source="fallback" menuPlacement="up" />
    </div>
  );
}
