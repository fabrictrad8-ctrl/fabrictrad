import { Suspense } from 'react';
import PhoneCollectionPage from './PhoneCollectionPage';

export default function PhonePage() {
  return (
    <div className="ft-auth">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <PhoneCollectionPage />
      </Suspense>
    </div>
  );
}
