import React from 'react';
import Header from '@/components/Header';
import BuyerRegistrationEntry from '@/app/buyer-registration/components/BuyerRegistrationEntry';

export default function BuyerRegistrationPage() {
  return (
    <main className="ft-storefront min-h-screen">
      <Header />
      <div className="pt-16">
        <BuyerRegistrationEntry />
      </div>
    </main>
  );
}
