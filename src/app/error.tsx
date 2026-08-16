'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('FabricTrad route error', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main id="main-content" className="flex min-h-[70vh] items-center justify-center bg-background px-5 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto flex w-fit items-center gap-3">
          <AppLogo size={42} />
          <span className="font-display text-2xl font-800 text-foreground">FabricTrad</span>
        </div>
        <p className="mt-8 text-xs font-800 uppercase tracking-[0.18em] text-primary">Temporary page problem</p>
        <h1 className="mt-3 text-3xl font-800 tracking-tight text-foreground">This page could not finish loading.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Your signed-in session and saved FabricTrad records are not changed by this screen. Retry the page, or return to a safe starting point.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={reset}
            className="ft-primary-action min-h-12 items-center justify-center px-5 py-3 text-sm"
          >
            Retry page
          </button>
          <Link href="/" className="ft-secondary-action min-h-12 items-center justify-center px-5 py-3 text-sm">
            Go to home
          </Link>
        </div>
      </section>
    </main>
  );
}
