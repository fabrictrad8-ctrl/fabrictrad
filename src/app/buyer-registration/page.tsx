import React from 'react';
import Header from '@/components/Header';
import BuyerRegistrationFlow from '@/app/buyer-registration/components/BuyerRegistrationFlow';

export default function BuyerRegistrationPage() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        <BuyerRegistrationFlow />
      </div>
    </main>
  );
}
