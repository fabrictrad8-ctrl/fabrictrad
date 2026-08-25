'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';

type UserType = 'buyer' | 'seller';
type TutorialStep = {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  hrefLabel: string;
  videoId?: string;
  tips: string[];
  badge?: string;
};

const buyerSteps: TutorialStep[] = [
  {
    id: 'b1',
    title: 'Create Your Buyer Account',
    description: 'Register as a buyer in under 2 minutes. Provide your business details, GST number (optional for retail), and verify your phone number.',
    icon: 'UserPlusIcon',
    href: '/buyer-registration',
    hrefLabel: 'Register as Buyer',
    tips: ['Use your business email for GST invoices', 'Phone OTP verification is instant', 'You can upgrade to B2B buyer later'],
    badge: 'Start Here',
  },
  {
    id: 'b2',
    title: 'Browse the Marketplace',
    description: 'Explore thousands of fabric listings from verified Indian manufacturers. Filter by fabric type, MOQ, price, and region.',
    icon: 'MagnifyingGlassIcon',
    href: '/marketplace',
    hrefLabel: 'Open Marketplace',
    tips: ['Use the AI search bar for natural language queries', 'Filter by "Verified Seller" for trusted suppliers', 'Save products to wishlist for later comparison'],
  },
  {
    id: 'b3',
    title: 'Try Fabrics Virtually',
    description: 'Use the AI-powered Virtual Drape Studio on any product page. Upload your photo or use an AI model to see how the fabric looks draped.',
    icon: 'SparklesIcon',
    href: '/marketplace',
    hrefLabel: 'Try Virtual Drape',
    tips: ['Upload a clear front-facing photo for best results', 'Try different fits: Relaxed, Regular, Tailored', 'Save try-on results to your profile for reference'],
    badge: 'AI Feature',
  },
  {
    id: 'b4',
    title: 'Place an Order',
    description: 'Add fabrics to cart, choose quantity (respecting MOQ), and checkout securely via Razorpay. Supports UPI, cards, net banking.',
    icon: 'ShoppingCartIcon',
    href: '/cart',
    hrefLabel: 'View Cart',
    tips: ['Check MOQ before adding to cart', 'Razorpay supports all Indian payment methods', 'Order confirmation is sent via email and SMS'],
  },
  {
    id: 'b5',
    title: 'Track Your Shipment',
    description: 'Monitor real-time shipment status from your buyer dashboard. Get AWB tracking, estimated delivery, and courier details.',
    icon: 'TruckIcon',
    href: '/buyer-dashboard?tab=tracking',
    hrefLabel: 'Track Orders',
    tips: ['Enable notifications for shipment updates', 'Contact seller directly via Inbox if delayed', 'Raise a dispute within 7 days of delivery'],
  },
  {
    id: 'b6',
    title: 'Raise Disputes & Returns',
    description: 'If there\'s an issue with your order, raise a dispute from your dashboard. Our team mediates and ensures fair resolution.',
    icon: 'FlagIcon',
    href: '/buyer-dashboard?tab=disputes',
    hrefLabel: 'Manage Disputes',
    tips: ['Attach photos as evidence when raising disputes', 'Disputes must be raised within 7 days of delivery', 'Refunds are processed within 5–7 business days'],
  },
];

const sellerSteps: TutorialStep[] = [
  {
    id: 's1',
    title: 'Register as a Seller',
    description: 'Complete your seller registration with business details, GSTIN, bank account, and identity verification. Our team reviews within 24–48 hours.',
    icon: 'BuildingOfficeIcon',
    href: '/seller-registration',
    hrefLabel: 'Register as Seller',
    tips: ['Keep GSTIN certificate and cancelled cheque ready', 'Business name must match GST registration', 'Bank account must be in business name for payouts'],
    badge: 'Start Here',
  },
  {
    id: 's2',
    title: 'Add Your Products',
    description: 'Use the AI Catalog Assistant to upload fabric listings. Add photos, descriptions, MOQ, pricing, and variants. AI auto-fills many fields.',
    icon: 'PlusCircleIcon',
    href: '/seller-dashboard?tab=upload',
    hrefLabel: 'Add Products',
    tips: ['Upload 4–6 high-quality fabric photos per listing', 'AI assistant can parse WhatsApp catalog images', 'Set competitive MOQ to attract more buyers'],
    badge: 'AI Powered',
  },
  {
    id: 's3',
    title: 'Manage Orders & Fulfillment',
    description: 'Accept incoming orders, confirm payment capture, and dispatch via Shiprocket. Print shipping labels and track all shipments in one place.',
    icon: 'ShoppingBagIcon',
    href: '/seller-dashboard?tab=orders',
    hrefLabel: 'View Orders',
    tips: ['Accept orders within 24 hours to maintain seller rating', 'Shiprocket auto-selects the best courier', 'Dispatch within 2 business days of order confirmation'],
  },
  {
    id: 's4',
    title: 'Track Earnings & Settlements',
    description: 'View your Razorpay payouts, commission breakdown, tax summaries, and payout schedule. Settlements are T+7 days after order confirmation.',
    icon: 'BanknotesIcon',
    href: '/seller-dashboard?tab=settlement',
    hrefLabel: 'View Settlements',
    tips: ['Platform commission is 5% + GST (18% on commission)', 'TDS of 1% is deducted under Section 194H', 'Download tax summaries for your CA'],
  },
  {
    id: 's5',
    title: 'Respond to Buyer Requests',
    description: 'Browse open sourcing requirements from buyers. Submit quotes directly and convert leads into orders without any cold outreach.',
    icon: 'MegaphoneIcon',
    href: '/seller-dashboard?tab=requests',
    hrefLabel: 'View Buyer Requests',
    tips: ['Respond to requests within 12 hours for best conversion', 'Include sample availability in your quote', 'Verified sellers get priority placement in search'],
  },
  {
    id: 's6',
    title: 'Grow with Analytics',
    description: 'Track your store performance, top-selling fabrics, buyer demographics, and revenue trends. Use insights to optimize pricing and inventory.',
    icon: 'ChartBarIcon',
    href: '/seller-dashboard?tab=analytics',
    hrefLabel: 'View Analytics',
    tips: ['Check weekly performance every Monday', 'Products with 5+ photos get 3x more views', 'Competitive pricing within 10% of market rate drives sales'],
  },
];

const faqs = [
  { q: 'How long does seller verification take?', a: 'Typically 24–48 business hours after all documents are submitted. You\'ll receive an email notification once approved.' },
  { q: 'What payment methods are supported?', a: 'All major Indian payment methods via Razorpay: UPI, credit/debit cards, net banking, wallets, and EMI.' },
  { q: 'How are disputes resolved?', a: 'Our team mediates between buyer and seller. Evidence is reviewed and a decision is made within 5 business days.' },
  { q: 'Can I sell internationally?', a: 'Currently FabricTrad supports domestic Indian orders only. International shipping is on our roadmap.' },
  { q: 'What is the minimum order quantity (MOQ)?', a: 'MOQ is set by each seller per product. It can range from 1 metre to bulk quantities. Check each listing for details.' },
  { q: 'How does the Virtual Drape AI work?', a: 'Our AI uses GPT-4o Vision to composite your photo with the fabric texture, showing a realistic drape simulation. Results are saved to your profile.' },
];

export default function TutorialPage() {
  const [userType, setUserType] = useState<UserType>('buyer');
  const [expandedStep, setExpandedStep] = useState<string | null>('b1');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const steps = userType === 'buyer' ? buyerSteps : sellerSteps;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="text-base font-700 text-gray-900">FabricTrad</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/marketplace" className="text-sm text-gray-600 hover:text-gray-900">Marketplace</Link>
            <Link href="/login" className="rounded-lg bg-[#008060] px-4 py-2 text-sm font-600 text-white hover:bg-[#006b52] transition">Get Started</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#008060]/10 px-4 py-1.5 text-sm font-600 text-[#008060]">
            <Icon name="AcademicCapIcon" size={16} />
            Getting Started Guide
          </div>
          <h1 className="text-3xl font-700 text-gray-900 sm:text-4xl">How to Use FabricTrad</h1>
          <p className="mt-3 text-base text-gray-500 max-w-xl mx-auto">
            India&apos;s B2B fabric marketplace. Whether you&apos;re sourcing fabrics or selling them, this guide walks you through every step.
          </p>
        </div>

        {/* User Type Toggle */}
        <div className="mb-8 flex justify-center">
          <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {(['buyer', 'seller'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setUserType(type); setExpandedStep(type === 'buyer' ? 'b1' : 's1'); }}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-600 transition ${
                  userType === type ? 'bg-[#008060] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon name={type === 'buyer' ? 'ShoppingBagIcon' : 'BuildingStorefrontIcon'} size={16} />
                I&apos;m a {type === 'buyer' ? 'Buyer' : 'Seller'}
              </button>
            ))}
          </div>
        </div>

        {/* Video Guide Banner */}
        <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1a1f2e] to-[#2d3748] p-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-600 uppercase tracking-wider text-white/60">Video Tutorial</p>
              <h2 className="mt-1 text-lg font-700">
                {userType === 'buyer' ? 'Complete Buyer Walkthrough' : 'Seller Onboarding & First Sale'}
              </h2>
              <p className="mt-1 text-sm text-white/70">
                {userType === 'buyer' ?'From registration to receiving your first fabric order — 8 min guide' :'Set up your store, list products, and get your first payout — 12 min guide'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Icon name="PlayIcon" size={24} className="text-white ml-1" />
              </div>
              <div>
                <p className="text-sm font-600">Watch on YouTube</p>
                <p className="text-xs text-white/60">Opens in new tab</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(userType === 'buyer'
              ? ['Account Setup', 'Browsing Fabrics', 'Virtual Drape AI', 'Checkout', 'Tracking']
              : ['Seller Registration', 'Adding Products', 'Order Management', 'Settlements', 'Analytics']
            ).map((chapter) => (
              <span key={chapter} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">{chapter}</span>
            ))}
          </div>
        </div>

        {/* Step-by-Step Guide */}
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-700 text-gray-900">
            Step-by-Step {userType === 'buyer' ? 'Buyer' : 'Seller'} Guide
          </h2>
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const isOpen = expandedStep === step.id;
              return (
                <div
                  key={step.id}
                  className={`overflow-hidden rounded-xl border transition-all ${
                    isOpen ? 'border-[#008060]/30 bg-white shadow-md' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 p-4 text-left"
                    onClick={() => setExpandedStep(isOpen ? null : step.id)}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-700 ${
                      isOpen ? 'bg-[#008060] text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-600 text-gray-900">{step.title}</p>
                        {step.badge && (
                          <span className="rounded-full bg-[#008060]/10 px-2 py-0.5 text-[10px] font-700 text-[#008060]">
                            {step.badge}
                          </span>
                        )}
                      </div>
                      {!isOpen && <p className="mt-0.5 truncate text-xs text-gray-500">{step.description}</p>}
                    </div>
                    <Icon name={isOpen ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="shrink-0 text-gray-400" />
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                      <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                      <div className="mt-3 space-y-1.5">
                        {step.tips.map((tip) => (
                          <div key={tip} className="flex items-start gap-2">
                            <Icon name="CheckCircleIcon" size={14} className="mt-0.5 shrink-0 text-[#008060]" />
                            <p className="text-xs text-gray-600">{tip}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4">
                        <Link
                          href={step.href}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#008060] px-4 py-2 text-sm font-600 text-white hover:bg-[#006b52] transition"
                        >
                          {step.hrefLabel}
                          <Icon name="ArrowRightIcon" size={14} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-700 text-gray-900">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(userType === 'buyer' ? [
              { label: 'Marketplace', href: '/marketplace', icon: 'ShoppingBagIcon', color: 'bg-blue-50 text-blue-700' },
              { label: 'My Orders', href: '/buyer-dashboard?tab=orders', icon: 'ClipboardDocumentListIcon', color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Virtual Drape', href: '/marketplace', icon: 'SparklesIcon', color: 'bg-purple-50 text-purple-700' },
              { label: 'Track Shipment', href: '/buyer-dashboard?tab=tracking', icon: 'TruckIcon', color: 'bg-amber-50 text-amber-700' },
              { label: 'Wishlist', href: '/buyer-dashboard?tab=wishlist', icon: 'HeartIcon', color: 'bg-red-50 text-red-700' },
              { label: 'Disputes', href: '/buyer-dashboard?tab=disputes', icon: 'FlagIcon', color: 'bg-orange-50 text-orange-700' },
              { label: 'Profile', href: '/profile', icon: 'UserCircleIcon', color: 'bg-gray-100 text-gray-700' },
              { label: 'Help', href: '/help', icon: 'QuestionMarkCircleIcon', color: 'bg-indigo-50 text-indigo-700' },
            ] : [
              { label: 'Seller Dashboard', href: '/seller-dashboard', icon: 'HomeIcon', color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Add Product', href: '/seller-dashboard?tab=upload', icon: 'PlusCircleIcon', color: 'bg-blue-50 text-blue-700' },
              { label: 'Orders', href: '/seller-dashboard?tab=orders', icon: 'ShoppingBagIcon', color: 'bg-amber-50 text-amber-700' },
              { label: 'Settlements', href: '/seller-dashboard?tab=settlement', icon: 'BanknotesIcon', color: 'bg-purple-50 text-purple-700' },
              { label: 'Analytics', href: '/seller-dashboard?tab=analytics', icon: 'ChartBarIcon', color: 'bg-indigo-50 text-indigo-700' },
              { label: 'Buyer Requests', href: '/seller-dashboard?tab=requests', icon: 'MegaphoneIcon', color: 'bg-red-50 text-red-700' },
              { label: 'Shipments', href: '/seller-dashboard?tab=fulfillment', icon: 'TruckIcon', color: 'bg-orange-50 text-orange-700' },
              { label: 'Help', href: '/help', icon: 'QuestionMarkCircleIcon', color: 'bg-gray-100 text-gray-700' },
            ]).map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm hover:shadow-md transition group"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${link.color}`}>
                  <Icon name={link.icon as 'HomeIcon'} size={18} />
                </div>
                <span className="text-sm font-600 text-gray-700 group-hover:text-gray-900">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-700 text-gray-900">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <div key={idx} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                >
                  <p className="text-sm font-600 text-gray-900">{faq.q}</p>
                  <Icon name={expandedFaq === idx ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} className="shrink-0 text-gray-400" />
                </button>
                {expandedFaq === idx && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-[#008060] to-[#006b52] p-8 text-center text-white">
          <h2 className="text-xl font-700">Ready to get started?</h2>
          <p className="mt-2 text-sm text-white/80">Join thousands of fabric businesses on FabricTrad</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/buyer-registration" className="rounded-xl bg-white px-6 py-2.5 text-sm font-700 text-[#008060] hover:bg-gray-50 transition">
              Register as Buyer
            </Link>
            <Link href="/seller-registration" className="rounded-xl border border-white/30 bg-white/10 px-6 py-2.5 text-sm font-700 text-white hover:bg-white/20 transition">
              Register as Seller
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
