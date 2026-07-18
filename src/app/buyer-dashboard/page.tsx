'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import BuyerDashboardLayout from '@/app/buyer-dashboard/components/BuyerDashboardLayout';

export default function BuyerDashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router?.replace('/login?role=buyer');
        return;
      }
      if (profile && profile?.role === 'seller') {
        router?.replace('/seller-dashboard');
        return;
      }
    }
  }, [user, profile, loading]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (profile?.role === 'seller') return null;

  return <BuyerDashboardLayout />;
}