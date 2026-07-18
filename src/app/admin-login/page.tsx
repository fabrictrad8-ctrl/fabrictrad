'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.role === 'super_admin' || data?.role === 'admin_staff') {
              router.replace('/admin-portal');
            }
          });
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      if (data.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profileData?.role === 'super_admin' || profileData?.role === 'admin_staff') {
          router.replace('/admin-portal');
        } else {
          await supabase.auth.signOut();
          setError('Access denied. This login is for administrators only.');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--foreground)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <AppLogo size={36} />
            <span className="font-display font-800 text-xl text-white">FabricTrad</span>
          </Link>
          <div className="w-14 h-14 rounded-2xl bg-error/20 border border-error/30 flex items-center justify-center mx-auto mb-4">
            <Icon name="ShieldCheckIcon" size={28} className="text-red-300" />
          </div>
          <h1 className="text-2xl font-800 text-white mb-1">Admin Portal</h1>
          <p className="text-sm text-white/60">Restricted access — administrators only</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-xl mb-5">
            <Icon name="ExclamationTriangleIcon" size={14} className="text-red-300 shrink-0" />
            <p className="text-xs text-red-300">
              This area is restricted to FabricTrad administrators. Unauthorized access attempts are
              logged.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-error/20 border border-error/30 rounded-xl mb-4">
              <Icon name="XCircleIcon" size={14} className="text-red-300 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-700 text-white/80 mb-1.5">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fabrictrad.com"
                required
                className="w-full px-4 py-3 text-sm rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-700 text-white/80 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Admin password"
                  required
                  className="w-full px-4 py-3 pr-10 text-sm rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  <Icon name={showPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-sm font-700 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                'Access Admin Portal'
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            <Link href="/" className="text-xs text-white/40 hover:text-white/60 transition-colors">
              ← Return to FabricTrad
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          Not an admin?{' '}
          <Link href="/login" className="text-white/50 hover:text-white/70 underline">
            Buyer / Seller Login
          </Link>
        </p>
      </div>
    </div>
  );
}
