'use client';

import { useEffect } from 'react';

export default function PublicHowToUseNavigation() {
  useEffect(() => {
    const landing = document.querySelector<HTMLElement>('.ft-future-landing');
    if (!landing) return;

    const chooserHref = '/how-to-use/start';
    const summary = landing.querySelector<HTMLElement>('.ft-future-navlinks summary');

    const openChooser = (event: Event) => {
      event.preventDefault();
      window.location.assign(chooserHref);
    };

    summary?.addEventListener('click', openChooser);

    const guideLinks = Array.from(
      landing.querySelectorAll<HTMLAnchorElement>('a[href^="/how-to-use?role="]')
    );
    guideLinks.forEach((link) => link.setAttribute('href', chooserHref));

    return () => {
      summary?.removeEventListener('click', openChooser);
    };
  }, []);

  return null;
}
