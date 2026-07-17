import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/app/components/HeroSection';
import CategorySection from '@/app/components/CategorySection';
import FeaturedProducts from '@/app/components/FeaturedProducts';
import HowItWorks from '@/app/components/HowItWorks';
import SellerCTA from '@/app/components/SellerCTA';
import TrustSection from '@/app/components/TrustSection';
import HomepageTracker from '@/app/components/HomepageTracker';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <HomepageTracker />
      <Header />
      <HeroSection />
      <CategorySection />
      <FeaturedProducts />
      <HowItWorks />
      <TrustSection />
      <SellerCTA />
      <Footer />
    </main>
  );
}