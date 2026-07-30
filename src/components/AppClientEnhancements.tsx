'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import GlobalCommandPalette from '@/components/GlobalCommandPalette';

function routeGroup(pathname: string) {
  if (pathname.startsWith('/seller-dashboard')) return 'seller';
  if (pathname.startsWith('/buyer-dashboard')) return 'buyer';
  if (pathname.startsWith('/admin-portal')) return 'admin';
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/buyer-registration') ||
    pathname.startsWith('/seller-registration')
  ) {
    return 'auth';
  }
  if (
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/categories') ||
    pathname.startsWith('/vendors') ||
    pathname.startsWith('/product-detail') ||
    pathname.startsWith('/buyer-requirements')
  ) {
    return 'commerce';
  }
  return 'public';
}

export default function AppClientEnhancements() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    document.body.dataset.route = pathname;
    document.body.dataset.routeGroup = routeGroup(pathname);
    document.body.classList.remove('route-entering');

    const frame = window.requestAnimationFrame(() => {
      document.body.classList.add('route-entering');
    });
    const timer = window.setTimeout(() => {
      document.body.classList.remove('route-entering');
    }, 320);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      document.body.classList.remove('route-entering');
      delete document.body.dataset.route;
      delete document.body.dataset.routeGroup;
    };
  }, [pathname]);

  return (
    <>
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 3500,
          className: 'fabrictrad-toast text-sm',
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--card)' } },
          error: { iconTheme: { primary: 'var(--error)', secondary: 'var(--card)' } },
        }}
      />
      <GlobalCommandPalette />
    </>
  );
}
