import React from 'react';
import Header from '@/components/Header';
import BuyerRegistrationFlow from '@/app/buyer-registration/components/BuyerRegistrationFlow';

export default function BuyerRegistrationPage() {
  return (
    <main className="ft-storefront min-h-screen">
      <Header />
      <div className="pt-16">
        <BuyerRegistrationFlow />
      </div>
    </main>
  );
}
