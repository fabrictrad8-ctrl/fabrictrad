'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders `position: fixed` chrome at <body> level instead of inside the routed page.
 *
 * RouteExperienceEnhancer wraps every route in .ft-route-content and animates it
 * with a transform on each navigation. A transformed ancestor becomes the
 * containing block for fixed descendants, so for the 420ms that animation runs,
 * anything fixed inside the page anchors to the wrapper's full scroll height
 * rather than the viewport. The keyframes already end on `transform: none` and
 * the class is stripped on animationend, so the trap is not permanent -- but it
 * cannot be closed from the CSS side while a transform-based page transition
 * exists at all.
 *
 * It has produced two separate user-visible bugs: the assistant launcher landing
 * at top 3568px on /help, and the workspace bottom tab bar -- the primary mobile
 * navigation -- flying off-screen on the admin and seller dashboards. Rather than
 * patch each one, fixed chrome goes through here.
 *
 * <body> is the host because .ft-root lives there, so themed styling that selects
 * `body.ft-root ...` and the `body:has(...)` collision rules keep matching.
 *
 * Renders nothing until mounted, since document does not exist during SSR. That is
 * acceptable for workspace chrome, which sits behind authentication and is client
 * rendered anyway; do not use this for content that must appear in the server HTML.
 */
export default function ViewportFixedLayer({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.body);
  }, []);

  if (!host) return null;
  return createPortal(children, host);
}
