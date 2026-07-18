import React, { Suspense } from 'react';
import ProfilePageClient from './ProfilePageClient';

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-muted/30 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProfilePageClient />
    </Suspense>
  );
}
