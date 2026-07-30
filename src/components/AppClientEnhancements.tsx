'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

const routeName = (pathname: string) => {
  if (pathname === '/') return 'home';
  return pathname
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/gi, '') || 'home';
};

export default function AppClientEnhancements() {
  const pathname = usePathname();

  useEffect(() => {
    const name = routeName(pathname || '/');
    document.body.dataset.route = name;
    document.documentElement.dataset.route = name;
    return () => {
      delete document.body.dataset.route;
      delete document.documentElement.dataset.route;
    };
  }, [pathname]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        const search = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]'
        );
        search?.focus();
        search?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        className:
          'text-sm !bg-card !text-foreground !border !border-primary/20 !rounded-xl !shadow-xl',
        success: { iconTheme: { primary: '#c8600a', secondary: '#ffffff' } },
      }}
    />
  );
}
