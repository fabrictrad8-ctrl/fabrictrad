import React, { Suspense } from 'react';
import ProfilePageClient from './ProfilePageClient';

export default function ProfilePage() {
  return (
    <main className="ft-shell ft-route-profile min-h-screen">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <ProfilePageClient />
      </Suspense>
    </main>
  );
}
