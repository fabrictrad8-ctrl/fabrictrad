'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

const MAIN_ID = 'main-content';

export default function RouteExperienceEnhancer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useAppPreferences();

  return (
    <>
      <a className="ft-skip-link" href={`#${MAIN_ID}`}>
        {t('nav.skip')}
      </a>
      <div key={pathname} id={MAIN_ID} tabIndex={-1} className="ft-route-content ft-route-enter">
        {children}
      </div>
    </>
  );
}
