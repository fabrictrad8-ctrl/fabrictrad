'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

type SetupResponse = {
  ready?: boolean;
  role?: string;
  canSell?: boolean;
  phonePresent?: boolean;
  destination?: string;
  code?: string;
  error?: string;
};

type SetupState = 'working' | 'retrying' | 'failed';

const sellerPhonePath =
  '/auth/phone?role=seller&returnTo=%2Fseller-registration%3Fresume%3D1';

export default function AccountSetupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get('role') === 'seller' ? 'seller' : 'buyer';
  const [state, setState] = useState<SetupState>('working');
  const [message, setMessage] = useState('Securely preparing your FabricTrad workspace.');
  const automaticAttempted = useRef(false);

  const continueToWorkspace = useCallback((result: SetupResponse) => {
    if (result.role === 'admin_staff' || result.role === 'super_admin') {
      router.replace('/admin-portal');
      return;
    }
    if (requestedRole === 'seller' && !result.phonePresent) {
      router.replace(sellerPhonePath);
      return;
    }
    if (requestedRole === 'seller' && !result.canSell) {
      router.replace('/seller-registration?resume=1');
      return;
    }
    router.replace('/marketplace');
  }, [requestedRole, router]);

  const prepare = useCallback(async (manual = false) => {
    setState(manual ? 'retrying' : 'working');
    setMessage(manual ? 'Checking and repairing your account again…' : 'Securely preparing your FabricTrad workspace.');

    try {
      const response = await fetch('/api/auth/provision-account', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ requestedRole }),
      });
      const result = (await response.json().catch(() => ({}))) as SetupResponse;

      if (response.status === 401) {
        router.replace('/login?error=session_expired');
        return;
      }
      if (!response.ok || !result.ready) {
        if (result.destination?.startsWith('/') && result.destination !== '/auth/setup') {
          router.replace(result.destination);
          return;
        }
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12 sm:px-8">
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

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-success/20 bg-success/8 px-3 py-2 text-sm text-success" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span><strong>Session preserved</strong> · this repair keeps the current signed-in account and does not create a duplicate.</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            [CheckCircle2, 'Identity preserved', 'Your existing login stays attached to the same FabricTrad account.'],
            [ShieldCheck, 'Safe repair', 'Only missing workspace records are repaired; no duplicate account is created.'],
            [Sparkles, 'Role-aware setup', 'Buyer access and seller verification continue through the correct next step.'],
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
            <p className="mt-1 text-sm text-muted-foreground">Your authenticated sign-in remains active, and retrying is safe.</p>
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
          Buyer accounts are not blocked for a missing phone number. Seller onboarding asks for one contact number, without SMS OTP.
        </p>
      </section>
    </main>
  );
}
