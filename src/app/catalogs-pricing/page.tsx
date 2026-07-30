import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SellerCapabilityGuard from '@/components/SellerCapabilityGuard';
import SellerCatalogPricing from '@/app/seller-dashboard/components/SellerCatalogPricing';

export default function CatalogsPricingPage() {
  return (
    <SellerCapabilityGuard>
      <main className="ft-storefront min-h-screen">
        <Header />
        <div className="pt-16">
          <section className="ft-storefront-content py-6 sm:py-8 lg:py-10">
            <SellerCatalogPricing />
          </section>
        </div>
        <Footer />
      </main>
    </SellerCapabilityGuard>
  );
}