'use client';

import { useEffect } from 'react';

const SELECTOR = '.ft-reveal:not(.is-visible)';

/**
 * Sitewide scroll-reveal: any element anywhere in the app opts in just by
 * getting the `ft-reveal` class in its JSX — no per-page observer wiring.
 * A MutationObserver keeps watching after the first pass so client-side
 * navigation and dynamically rendered content (new pages, tab switches)
 * pick up reveal behaviour automatically too.
 */
export default function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll(SELECTOR).forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          intersectionObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    const observeNewNodes = () => {
      document.querySelectorAll(SELECTOR).forEach((el) => intersectionObserver.observe(el));
    };
    observeNewNodes();

    const mutationObserver = new MutationObserver(observeNewNodes);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
