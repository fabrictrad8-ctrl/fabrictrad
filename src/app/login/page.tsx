'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import EmailOtpLoginClient from './EmailOtpLoginClient';

export default function LoginPage() {
  return (
    <div className="ft-auth relative">
      <Link
        href="/admin-login"
        className="fixed right-4 top-4 z-50 rounded-xl border border-white/10 bg-[#151a21]/90 px-4 py-2 text-xs font-800 text-orange-300 shadow-lg backdrop-blur-xl transition hover:border-orange-300/30 hover:text-orange-200 sm:right-6 sm:top-6"
      >
        Admin Portal
      </Link>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <EmailOtpLoginClient />
      </Suspense>
    </div>
  );
}
