'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import EmailOtpLoginClient from './EmailOtpLoginClient';
import LoginRedirectGuard from './LoginRedirectGuard';

export default function LoginPage() {
  return (
    <div className="ft-auth relative">
      <Link href="/admin-login" className="ft-auth-admin-link">Admin Portal</Link>
      <Suspense fallback={<div className="ft-auth-page flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" /></div>}>
        <LoginRedirectGuard />
        <EmailOtpLoginClient />
      </Suspense>
    </div>
  );
}
