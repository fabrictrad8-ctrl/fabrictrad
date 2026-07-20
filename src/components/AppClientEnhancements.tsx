'use client';

import { Toaster } from 'react-hot-toast';

export default function AppClientEnhancements() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        className: 'text-sm !bg-card !text-foreground !border !border-border',
      }}
    />
  );
}
