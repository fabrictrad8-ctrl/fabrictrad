'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

type SetupResponse = {
  ready?: boolean;
  role?: string;
  canSell?: boolean;
  phonePresent?: boolean;
  code?: string;
  error?: string;
};

type SetupState = 'working' | 'retrying' | 'failed';

export default function AccountSetupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get('role') === 'seller' ? 'seller' : 'buyer';
  const [state, setState] = useState<SetupState>('working');
  const [message, setMessage] = useState('Securely preparing your buyer and seller workspace.');
  const automaticAttempted = useRef(false);

  const continueToWorkspace = useCallback((result: SetupResponse) => {
    if (result.role === 'admin_staff' || result.role === 'super_admin') {
      router.replace('/admin-portal');
      return;
    }
    if (!result.phonePresent) {
      router.replace(`/auth/phone?role=${requestedRole}`);
      return;
    }
    if (requestedRole === 'seller' && !result.canSell) {
      router.replace('/seller-registration');
      return;
    }
    router.replace('/marketplace');
  }, [requestedRole, router]);

  const prepare = useCallback(async (manual = false) => {
    setState(manual ? 'retrying' : 'working');
    setMessage(manual ? 'Checking your account again…' : 'Securely preparing your buyer and seller workspace.');

    try {
      const response = await fetch('/api/auth/provision-account', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedRole }),
      });
      const result = (await response.json().catch(() => ({}))) as SetupResponse;

      if (response.status === 401) {
        router.replace('/login?error=session_expired');
        return;
      }
      if (!response.ok || !result.ready) {
        throw new Error(result.error || 'Your workspace is not ready yet.');
      }

      setMessage('Your workspace is ready. Taking you inside…');
      continueToWorkspace(result);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Your workspace could not be prepared yet.';
      setMessage(detail);
      setState('failed');
    }
  }, [continueToWorkspace, requestedRole, router]);

  useEffect(() => {
    if (automaticAttempted.current) return;
    automaticAttempted.current = true;
    void prepare(false);
  }, [prepare]);

  const busy = state === 'working' || state === 'retrying';

  return (
    <main id="main-content" className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute left-[8%] top-[12%] h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-[8%] right-[7%] h-64 w-64 rounded-full bg-orange-300/10 blur-3xl" />
      </div>

      <section className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 p-6 shadow-2xl backdrop-blur-2xl sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20">
            {busy ? <RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-6 w-6" aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">FabricTrad account care</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {busy ? 'Finishing your secure sign-in' : 'Your sign-in is safe'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base" aria-live="polite">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            [CheckCircle2, 'Google verified', 'Your identity is already confirmed.'],
            [ShieldCheck, 'Session preserved', 'You will not be signed out during repair.'],
            [Sparkles, 'Role-aware setup', 'Buyer and seller access stay correctly separated.'],
          ].map(([Icon, title, copy]) => {
            const ItemIcon = Icon as typeof CheckCircle2;
            return (
              <div key={String(title)} className="rounded-2xl border border-border/60 bg-background/55 p-4">
                <ItemIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-foreground">{String(title)}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{String(copy)}</p>
              </div>
            );
          })}
        </div>

        {state === 'failed' ? (
          <div className="mt-7 rounded-2xl border border-destructive/25 bg-destructive/8 p-4" role="alert">
            <p className="text-sm font-medium text-foreground">The automatic repair did not complete.</p>
            <p className="mt-1 text-sm text-muted-foreground">Your Google session is still active. Retrying is safe and will not create duplicate profiles.</p>
            <button
              type="button"
              onClick={() => void prepare(true)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-105 sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry account setup
            </button>
          </div>
        ) : (
          <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          Account setup is idempotent: retrying only completes missing records and never duplicates them.
        </p>
      </section>
    </main>
  );
}
