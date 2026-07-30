'use client';

import { Toaster } from 'react-hot-toast';
import GlobalCommandPalette from '@/components/GlobalCommandPalette';

export default function AppClientEnhancements() {
  return (
    <>
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 3500,
          className: 'ft-toast text-sm',
          success: {
            iconTheme: { primary: 'var(--ft-success)', secondary: 'var(--ft-surface-solid)' },
          },
          error: {
            iconTheme: { primary: 'var(--ft-danger)', secondary: 'var(--ft-surface-solid)' },
          },
        }}
      />
      <GlobalCommandPalette />
    </>
  );
}
