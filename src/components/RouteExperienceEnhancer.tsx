'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const MAIN_ID = 'main-content';

export default function RouteExperienceEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    let animationTimeout = 0;
    let currentMain: HTMLElement | null = null;

    const prepareMain = () => {
      const mains = Array.from(document.querySelectorAll<HTMLElement>('main'));
      const main = mains[0] || null;
      if (!main) return;

      // Dynamic route shells can replace their <main> node after hydration.
      // Keep the skip-link target attached to the current primary main instead
      // of disconnecting the observer after the first transient render.
      mains.forEach((candidate, index) => {
        if (index === 0) {
          if (candidate.id !== MAIN_ID) candidate.id = MAIN_ID;
          if (!candidate.hasAttribute('tabindex')) candidate.tabIndex = -1;
        } else if (candidate.id === MAIN_ID) {
          candidate.removeAttribute('id');
        }
      });

      if (main === currentMain) return;
      currentMain = main;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(animationTimeout);
      main.classList.remove('ft-route-enter');
      frame = window.requestAnimationFrame(() => {
        main.classList.add('ft-route-enter');
        animationTimeout = window.setTimeout(() => main.classList.remove('ft-route-enter'), 620);
      });
    };

    prepareMain();
    const observer = new MutationObserver(prepareMain);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(animationTimeout);
    };
  }, [pathname]);

  return (
    <a className="ft-skip-link" href={`#${MAIN_ID}`}>
      Skip to main content
    </a>
  );
}
