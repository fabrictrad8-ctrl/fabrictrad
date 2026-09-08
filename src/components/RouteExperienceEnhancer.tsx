'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

const MAIN_ID = 'main-content';

export default function RouteExperienceEnhancer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useAppPreferences();
  const ref = useRef<HTMLDivElement>(null);

  // The entrance animation's keyframes move `transform` (translateY/scale).
  // Any non-`none` transform — even the identity matrix an animation can be
  // left holding — creates a new containing block for descendant
  // `position: fixed` elements, which silently breaks every fixed bottom
  // bar, overlay and floating widget on the page (they anchor to this
  // wrapper's scrollable height instead of the real viewport). Removing the
  // class once the animation finishes drops `transform` back to genuinely
  // unset rather than relying on the keyframe's own end value.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('ft-route-enter');
    const clear = () => el.classList.remove('ft-route-enter');
    el.addEventListener('animationend', clear);
    return () => el.removeEventListener('animationend', clear);
  }, [pathname]);

  return (
    <>
      <a className="ft-skip-link" href={`#${MAIN_ID}`}>
        {t('nav.skip')}
      </a>
      <div key={pathname} id={MAIN_ID} tabIndex={-1} ref={ref} className="ft-route-content">
        {children}
      </div>
    </>
  );
}
