import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BespokeStageAppointmentPanel from './BespokeStageAppointmentPanel';
import CustomOrderClient from './CustomOrderClient';

export const dynamic = 'force-dynamic';

export default function CustomOrderPage() {
  return (
    <main className="ft-storefront min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          }
        >
          <CustomOrderClient />
          <BespokeStageAppointmentPanel />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
