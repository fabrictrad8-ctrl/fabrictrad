import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BuyerOnlyGuard from '@/components/BuyerOnlyGuard';
import BuyerCompanyPurchasing from '@/app/buyer-dashboard/components/BuyerCompanyPurchasing';

export default function CompanyPurchasingPage() {
  return (
    <BuyerOnlyGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <section className="ft-storefront-content py-6 sm:py-8 lg:py-10">
            <BuyerCompanyPurchasing />
          </section>
        </div>
        <Footer />
      </main>
    </BuyerOnlyGuard>
  );
}