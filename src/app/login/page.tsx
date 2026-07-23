'use client';

import { Suspense } from 'react';
import EmailOtpLoginClient from './EmailOtpLoginClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#09111f]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <EmailOtpLoginClient />
    </Suspense>
  );
}
