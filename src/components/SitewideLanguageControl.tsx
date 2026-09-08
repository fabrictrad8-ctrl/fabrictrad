'use client';

import { useEffect, useRef, useState } from 'react';
import PreferenceControls from '@/components/PreferenceControls';
import Icon from '@/components/ui/AppIcon';

/**
 * Safety-net language selector for routes that do not render the shared Header.
 * Normal headers/landing pages render an embedded control; this fallback only
 * appears when no embedded selector exists, so every route remains switchable
 * without duplicating controls.
 *
 * Collapsed to a small globe button by default — the full picker (language
 * select + dark-mode toggle) is ~220px wide, which on a phone-width viewport
 * sits directly over whatever the page renders in that bottom-right corner.
 * It only expands to full size when tapped, so its resting footprint is a
 * single 44px circle.
 */
export default function SitewideLanguageControl() {
  const [needsFallback, setNeedsFallback] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A control can exist in the DOM but be CSS-hidden at the current viewport
    // width (e.g. a crowded dashboard header that hides its inline picker
    // below a breakpoint) — a bare DOM-presence check would stay silent and
    // leave mobile users with no way to reach it at all. Checking the
    // rendered rect instead catches that, and the resize listener re-checks
    // on a pure CSS breakpoint change, which a MutationObserver never sees.
    const isEmbeddedVisible = () => {
      const el = document.querySelector('[data-language-control="embedded"]');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const refresh = () => {
      setNeedsFallback(!isEmbeddedVisible());
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [expanded]);

  if (!needsFallback) return null;

  return (
    <div
      ref={wrapRef}
      className="ft-sitewide-language-control fixed bottom-4 right-4 z-30 rounded-full border border-border bg-card/95 shadow-[0_12px_36px_rgba(15,23,42,0.18)] backdrop-blur-xl print:hidden"
      data-sitewide-language-control
    >
      {expanded ? (
        <div className="p-1">
          <PreferenceControls source="fallback" menuPlacement="up" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-11 w-11 items-center justify-center text-primary"
          aria-label="Open language and appearance settings"
        >
          <Icon name="LanguageIcon" size={19} />
        </button>
      )}
    </div>
  );
}
