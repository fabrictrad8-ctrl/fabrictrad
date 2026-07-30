'use client';

import { Toaster } from 'react-hot-toast';
import GlobalCommandPalette from '@/components/GlobalCommandPalette';

export default function AppClientEnhancements() {
  return (
    <>
      <Toaster
        position="top-right"
        gutter={10}
        containerStyle={{
          top: 'max(16px, env(safe-area-inset-top))',
          right: 'max(12px, env(safe-area-inset-right))',
          left: 'max(12px, env(safe-area-inset-left))',
        }}
        toastOptions={{
          duration: 3500,
          className:
            '!max-w-[min(420px,calc(100vw-24px))] !rounded-xl !border !border-border !bg-card/95 !px-4 !py-3 !text-sm !font-600 !text-foreground !shadow-card-lg backdrop-blur-xl',
          success: {
            iconTheme: { primary: 'var(--success)', secondary: 'var(--card)' },
          },
          error: {
            duration: 5000,
            iconTheme: { primary: 'var(--error)', secondary: 'var(--card)' },
          },
        }}
      />
      <GlobalCommandPalette />
    </>
  );
}
