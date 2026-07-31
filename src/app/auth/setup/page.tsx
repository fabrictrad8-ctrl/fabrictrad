import { Suspense } from 'react';
import AccountSetupClient from './AccountSetupClient';

export default function AccountSetupPage() {
  return (
    <div className="ft-auth">
      <Suspense
        fallback={
          <main id="main-content" className="flex min-h-screen items-center justify-center px-5">
            <div className="rounded-3xl border border-border/70 bg-card/90 p-8 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">Preparing your FabricTrad workspace…</p>
            </div>
          </main>
        }
      >
        <AccountSetupClient />
      </Suspense>
    </div>
  );
}
