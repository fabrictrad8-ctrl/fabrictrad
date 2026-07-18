'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import SellerDashboardLayout from '@/app/seller-dashboard/components/SellerDashboardLayout';

export default function SellerDashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router?.replace('/login?role=seller');
        return;
      }
      if (profile && profile?.role !== 'seller' && profile?.role !== 'admin_staff' && profile?.role !== 'super_admin') {
        router?.replace('/buyer-dashboard');
        return;
      }
    }
  }, [user, profile, loading]);

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (profile?.role === 'buyer') return null;

  return <SellerDashboardLayout />;
}