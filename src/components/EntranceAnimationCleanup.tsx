'use client';

import { useEffect } from 'react';

/**
 * Every "fade/rise into place" entrance animation sitewide (ft-content-reveal,
 * ft-route-enter, ft-hero-rise, ft-command-arrive, ft-auth-rise, and more)
 * ends its keyframe on `transform: none` rather than `translateY(0)` —
 * deliberately, per comments scattered across the CSS files, because a held
 * non-none transform creates a new containing block for descendant
 * `position: fixed` elements.
 *
 * That fix is incomplete. With `animation-fill-mode: both`, the browser
 * keeps computing the element's transform by interpolating the animation's
 * keyframes for as long as the animation is attached — even once it has
 * fully finished — and interpolating "to `none`" still resolves to the
 * identity matrix (`matrix(1, 0, 0, 1, 0, 0)`), not the literal keyword
 * `none`. getComputedStyle() reflects that matrix, and a matrix is not
 * `none`: it still creates a containing block, so the underlying bug (fixed
 * bottom bars, floating widgets, and full-screen dialogs anchoring to this
 * element's own box instead of the real viewport) persists indefinitely.
 * Confirmed directly: an isolated element left animating for 300ms past a
 * 50ms `both`-filled ft-content-reveal still read a matrix, never `none`.
 *
 * The only real fix is to drop the animation entirely once it has finished
 * playing, so the element stops being "animated" at all. Every entrance
 * animation in this codebase runs at most one `animation-name` at a time
 * (no comma-composited animations), so a single delegated `animationend`
 * listener can safely clear any element's animation the moment it
 * completes — this doesn't touch looping/infinite animations (shimmer,
 * pulse), since those never fire `animationend` to begin with.
 */
export default function EntranceAnimationCleanup() {
  useEffect(() => {
    const handleAnimationEnd = (event: AnimationEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        target.style.animation = 'none';
      }
    };

    // A fast above-the-fold entrance animation (ft-hero-rise et al. can run
    // as short as ~200-400ms) can finish and fire animationend while React
    // is still walking the rest of a large tree during initial hydration.
    // Mutating an element's inline style in that window makes React see an
    // attribute value it didn't render server-side on a node it hasn't
    // hydrated yet, which it reports as a hydration mismatch — a false
    // positive from an unrelated, later mutation, not a real markup
    // difference. Deferring attachment past hydration (idle callback, with
    // a timeout fallback for Safari) keeps this listener from ever firing
    // inside that window.
    type IdleWindow = Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const idleWindow = window as IdleWindow;
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const attach = () => document.addEventListener('animationend', handleAnimationEnd, true);
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(attach);
    } else {
      timeoutHandle = setTimeout(attach, 0);
    }

    return () => {
      document.removeEventListener('animationend', handleAnimationEnd, true);
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, []);

  return null;
}
