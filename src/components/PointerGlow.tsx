'use client';

import { useEffect } from 'react';

/**
 * Drives the "liquid glass" specular highlight (src/styles/liquid-glass.css)
 * with one global light source instead of per-element listeners: every
 * glass surface reads the same --pointer-x/--pointer-y custom properties
 * and uses `background-attachment: fixed` so the highlight lines up with
 * the cursor across the whole viewport, as if one light were reflecting
 * off every panel at once. Cheap (one root listener, rAF-throttled) and
 * consistent, which reads as more "real" than each panel lighting up on
 * its own. No-ops under prefers-reduced-motion — the panels still render
 * their glass material, just without the moving highlight.
 */
export default function PointerGlow() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;

    const root = document.documentElement;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      root.style.setProperty('--pointer-x', `${pending.x}%`);
      root.style.setProperty('--pointer-y', `${pending.y}%`);
    };

    const handleMove = (event: PointerEvent) => {
      pending = {
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
