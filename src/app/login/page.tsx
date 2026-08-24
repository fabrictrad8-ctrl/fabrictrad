'use client';

import { Suspense } from 'react';
import EmailOtpLoginClient from './EmailOtpLoginClient';
import LoginRedirectGuard from './LoginRedirectGuard';

export default function LoginPage() {
  return (
    <div className="ft-auth relative">
      <Suspense fallback={<div className="ft-auth-page flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" /></div>}>
        <LoginRedirectGuard />
        <EmailOtpLoginClient />
      </Suspense>
    </div>
  );
}
