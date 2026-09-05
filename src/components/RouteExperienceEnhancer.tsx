'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const MAIN_ID = 'main-content';

export default function RouteExperienceEnhancer({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <a className="ft-skip-link" href={`#${MAIN_ID}`}>
        Skip to main content
      </a>
      <div key={pathname} id={MAIN_ID} tabIndex={-1} className="ft-route-content ft-route-enter">
        {children}
      </div>
    </>
  );
}
