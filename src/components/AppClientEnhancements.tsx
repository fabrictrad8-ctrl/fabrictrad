'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function AppClientEnhancements() {
  const { profile } = useAuth();

  useEffect(() => {
    const language = profile?.preferred_language || 'en';
    document.documentElement.lang = language;
  }, [profile?.preferred_language]);

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        className: 'text-sm',
      }}
    />
  );
}
