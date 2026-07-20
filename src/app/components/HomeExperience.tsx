'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import HeroSection from '@/app/components/HeroSection';
import CategorySection from '@/app/components/CategorySection';
import FeaturedProducts from '@/app/components/FeaturedProducts';
import HowItWorks from '@/app/components/HowItWorks';
import TrustSection from '@/app/components/TrustSection';
import ModernLandingPage from '@/app/components/ModernLandingPage';

function PublicBrandHome() {
  const englishTagline =
    "The textile market's smartest and most trustworthy B2B network platform. From sourcing to shipping, everything is automated.";

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <Header />
      <section className="relative min-h-[calc(100vh-1px)] px-4 pb-10 pt-24 sm:px-6 sm:pt-28 lg:pb-14">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.13]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1800&q=80')",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(250,248,243,0.78),rgba(250,248,243,0.98)_72%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.78fr)]">
          <div className="max-w-3xl animate-fade-in-up text-center lg:text-left">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-4 py-2 text-xs font-800 uppercase tracking-widest text-primary shadow-sm backdrop-blur lg:mx-0">
              <span className="h-2 w-2 rounded-full bg-success" />
              Verified B2B Textile Network
            </div>
            <h1 className="text-[3.35rem] font-800 leading-[0.95] tracking-normal text-foreground sm:text-[4.4rem] md:text-[5.4rem] lg:text-[6.3rem]">
              FabricTrad
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base font-700 leading-7 text-secondary sm:text-xl sm:leading-8 lg:mx-0">
              {englishTagline}
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base lg:mx-0">
              Sign in to continue, or create an account and choose whether you are buying textiles
              or selling through a GST-verified store.
            </p>

            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
              <Link href="/login" className="btn-primary px-7 py-3.5 text-sm sm:min-w-36">
                Sign In
              </Link>
              <Link href="/register" className="btn-navy px-7 py-3.5 text-sm sm:min-w-44">
                Create Account
              </Link>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ['UserGroupIcon', 'Buyer and seller access is separated by account role.'],
                ['IdentificationIcon', 'Seller GSTIN, store, bank, and documents are verified.'],
                ['TruckIcon', 'Orders, payments, and fulfilment stay tied to the right account.'],
              ].map(([icon, copy], index) => (
                <div
                  key={copy}
                  className="animate-fade-in-up rounded-2xl border border-border bg-card/78 p-4 text-left shadow-sm backdrop-blur"
                  style={{ animationDelay: `${120 + index * 120}ms` }}
                >
                  <Icon name={icon as 'UserGroupIcon'} size={19} className="mb-3 text-primary" />
                  <p className="text-xs font-700 leading-5 text-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto h-[420px] w-full max-w-[520px] animate-slide-in-right sm:h-[520px] lg:mx-0">
            <div className="absolute left-4 top-2 h-72 w-48 overflow-hidden rounded-[1.25rem] border border-white/60 bg-card shadow-2xl sm:left-8 sm:h-80 sm:w-56">
              <div
                className="h-full w-full bg-cover bg-center fabric-float-slow"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=900&q=80')",
                }}
              />
            </div>
            <div className="absolute right-4 top-16 h-64 w-44 overflow-hidden rounded-[1.25rem] border border-white/60 bg-card shadow-xl sm:right-10 sm:h-72 sm:w-52">
              <div
                className="h-full w-full bg-cover bg-center fabric-float"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?auto=format&fit=crop&w=900&q=80')",
                }}
              />
            </div>
            <div className="absolute bottom-10 left-8 right-6 rounded-2xl border border-border bg-card/92 p-4 shadow-2xl backdrop-blur sm:left-14 sm:right-16">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-800 uppercase tracking-widest text-primary">
                    Live workflow
                  </p>
                  <p className="mt-1 text-sm font-800 text-foreground">
                    Sourcing to shipping, automated
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                  <Icon name="BoltIcon" size={20} className="text-success" />
                </div>
              </div>
              <div className="space-y-2">
                {['GST verification', 'Online payment tracking', 'Seller payout routing'].map(
                  (item, index) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-800 text-primary">
                        {index + 1}
                      </div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary fabric-progress"
                          style={{ animationDelay: `${index * 420}ms` }}
                        />
                      </div>
                      <span className="w-28 text-xs font-700 text-muted-foreground">{item}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SellerHome() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <Header />
      <section className="relative px-4 pb-12 pt-24 sm:px-6 sm:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(200,96,10,0.10),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(31,41,68,0.10),transparent_26%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-2xl border border-border bg-card p-6 card-shadow-lg md:p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/10 px-3 py-1 text-xs font-800 uppercase tracking-widest text-secondary">
              <span className="h-2 w-2 rounded-full bg-success" />
              Seller Workspace
            </div>
            <h1 className="text-hero-lg text-foreground">
              Run your FabricTrad store from catalog to payout
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Upload your own catalog, manage only your orders, confirm dispatch, resolve buyer
              messages, and track payouts tied to this seller account.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/seller-dashboard?tab=upload" className="btn-primary px-6 py-3 text-sm">
                Upload Catalog
              </Link>
              <Link href="/seller-dashboard?tab=orders" className="btn-secondary px-6 py-3 text-sm">
                Manage Orders
              </Link>
              <Link href="/seller-dashboard?tab=earnings" className="btn-navy px-6 py-3 text-sm">
                View Payouts
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 card-shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-white">
                <Icon name="ChatBubbleLeftRightIcon" size={19} />
              </div>
              <div>
                <p className="text-sm font-800 text-foreground">WhatsApp Catalog Upload</p>
                <p className="text-xs text-muted-foreground">
                  Seller-only automation for creating listings faster.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-muted p-4 text-xs">
              <p className="text-muted-foreground">Message format</p>
              <p className="mt-2 font-700 text-foreground">Fabric: dyeable soft net</p>
              <p className="text-muted-foreground">Width: 44 in · MOQ: 50 mtrs · Rate: ₹840</p>
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-success">
                <Icon name="CheckCircleIcon" size={16} />
                <span className="font-700">AI extracts product fields for seller review</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto mt-6 max-w-7xl">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              [
                'ClipboardDocumentListIcon',
                'Order Queue',
                '/seller-dashboard?tab=orders',
                'Respond to buyer orders assigned to your seller profile.',
              ],
              [
                'ArchiveBoxIcon',
                'Inventory',
                '/seller-dashboard?tab=inventory',
                'Upload and maintain your own catalog only.',
              ],
              [
                'BanknotesIcon',
                'Earnings',
                '/seller-dashboard?tab=earnings',
                'Track payout and settlement status for your payments.',
              ],
              [
                'TruckIcon',
                'Fulfillment',
                '/seller-dashboard?tab=fulfillment',
                'Confirm dispatch, courier handoff, and shipment updates.',
              ],
              [
                'ChatBubbleLeftRightIcon',
                'Buyer Inbox',
                '/seller-dashboard?tab=inbox',
                'Reply to buyer questions and order messages.',
              ],
              [
                'BuildingOfficeIcon',
                'Business Profile',
                '/profile',
                'Maintain GST, store, pickup, and verification details.',
              ],
            ].map(([icon, title, href, copy]) => (
              <Link
                key={title}
                href={href}
                className="rounded-2xl border border-border bg-card p-5 card-shadow transition-all hover:-translate-y-0.5 hover:card-shadow-hover"
              >
                <Icon name={icon as 'ArchiveBoxIcon'} size={24} className="mb-4 text-secondary" />
                <p className="text-base font-800 text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function AdminHome() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <section className="px-4 pt-28 pb-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-800 uppercase tracking-widest text-error">Admin Operations</p>
          <h1 className="mt-2 text-hero-lg text-foreground">Platform control center</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              ['ChartPieIcon', 'Dashboard', '/admin-portal'],
              ['CreditCardIcon', 'Payments', '/admin-portal?tab=payments'],
              ['BuildingStorefrontIcon', 'Sellers', '/admin-portal?tab=sellers'],
              ['ExclamationTriangleIcon', 'Errors', '/admin-portal?tab=errors'],
            ].map(([icon, title, href]) => (
              <Link
                key={title}
                href={href}
                className="rounded-2xl border border-border bg-card p-5 card-shadow"
              >
                <Icon name={icon as 'ChartPieIcon'} size={24} className="mb-4 text-primary" />
                <p className="font-800 text-foreground">{title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function HomeExperience() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!user || !profile) return <ModernLandingPage />;

  if (profile.role === 'seller') return <SellerHome />;
  if (profile.role === 'admin_staff' || profile.role === 'super_admin') return <AdminHome />;

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <CategorySection />
      <FeaturedProducts />
      <HowItWorks />
      <TrustSection />
      <Footer />
    </main>
  );
}
