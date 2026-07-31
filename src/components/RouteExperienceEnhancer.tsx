'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const MAIN_ID = 'main-content';

export default function RouteExperienceEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    let timeout = 0;

    const prepareMain = () => {
      const main = document.querySelector<HTMLElement>('main');
      if (!main) return false;

      if (!main.id) main.id = MAIN_ID;
      if (!main.hasAttribute('tabindex')) main.tabIndex = -1;

      main.classList.remove('ft-route-enter');
      frame = window.requestAnimationFrame(() => {
        main.classList.add('ft-route-enter');
        timeout = window.setTimeout(() => main.classList.remove('ft-route-enter'), 620);
      });
      return true;
    };

    if (!prepareMain()) {
      const observer = new MutationObserver(() => {
        if (prepareMain()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = window.setTimeout(() => observer.disconnect(), 1500);
      return () => {
        observer.disconnect();
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
      };
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  return (
    <a className="ft-skip-link" href={`#${MAIN_ID}`}>
      Skip to main content
    </a>
  );
}
