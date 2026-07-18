import { Suspense } from 'react';
import PhoneCollectionPage from './PhoneCollectionPage';

export default function PhonePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen gradient-hero flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PhoneCollectionPage />
    </Suspense>
  );
}
