'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';

type UserType = 'buyer' | 'seller';
type BuyerSubType = 'bulk' | 'personal';

// Interactive video-style step data
type VideoStep = {
  id: string;
  title: string;
  duration: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  href: string;
  hrefLabel: string;
  tips: string[];
  badge?: string;
  highlights: string[];
};

const bulkBuyerSteps: VideoStep[] = [
  {
    id: 'bb1',
    title: 'Create Your Bulk Buyer Account',
    duration: '2 min',
    description: 'Go to /buyer-registration and choose "Bulk Buyer — Shop / Business". Enter your name, business email, mobile number, and password. Your account is created instantly — GST and KYC verification comes after.',
    icon: 'BuildingStorefrontIcon',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    href: '/buyer-registration?type=retail_store',
    hrefLabel: 'Register as Bulk Buyer',
    badge: 'Start Here',
    highlights: ['Business email required', 'No GST needed upfront', 'Instant account creation'],
    tips: [
      'Use a business email address — this cannot be the same email as a seller account',
      'Keep your GSTIN certificate ready for the KYC step after account creation',
      'Mobile number must be unique — not used on any other FabricTrad account',
    ],
  },
  {
    id: 'bb2',
    title: 'Complete Business KYC',
    duration: '5 min',
    description: 'After creating your login, complete your business verification from your profile. Submit your GSTIN, PAN, and business proof documents. Our team reviews within 24–48 hours.',
    icon: 'IdentificationIcon',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    href: '/profile',
    hrefLabel: 'Complete KYC',
    highlights: ['GSTIN instant verification', '24–48h review time', 'Browse while pending'],
    tips: [
      'GSTIN verification is instant via the government API',
      'Business name must match your GST registration exactly',
      'Upload clear scans — blurry documents cause delays',
    ],
  },
  {
    id: 'bb3',
    title: 'Browse B2B Catalogue',
    duration: '3 min',
    description: 'Access the full marketplace with B2B pricing, MOQ-based listings, and bulk fabric options. Filter by fabric type, GSM, MOQ, price range, and verified sellers.',
    icon: 'MagnifyingGlassIcon',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    href: '/marketplace',
    hrefLabel: 'Open Marketplace',
    highlights: ['Filter by GSM & MOQ', 'Verified seller badge', 'Save to wishlist'],
    tips: [
      'Filter by "Verified Seller" for trusted, KYC-approved suppliers',
      'Use GSM filter to find fabrics by weight (e.g. 120–200 GSM for shirting)',
      'MOQ is shown on each listing — check before adding to cart',
    ],
  },
  {
    id: 'bb4',
    title: 'Place Bulk Orders',
    duration: '3 min',
    description: 'Add fabrics to cart respecting MOQ, choose quantity in metres or kilograms, and checkout via Razorpay. Supports UPI, cards, net banking, and business payment methods.',
    icon: 'ShoppingCartIcon',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    href: '/cart',
    hrefLabel: 'View Cart',
    highlights: ['MOQ enforced at checkout', 'Auto GST invoice', 'UPI & cards supported'],
    tips: [
      'Minimum order quantity (MOQ) is enforced per product',
      'GST invoice is auto-generated after payment',
      'Order confirmation is sent via email and SMS',
    ],
  },
  {
    id: 'bb5',
    title: 'Track Shipments',
    duration: '2 min',
    description: 'Monitor real-time shipment status from your buyer dashboard. Get AWB tracking, estimated delivery, and courier details via Shiprocket integration.',
    icon: 'TruckIcon',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    href: '/buyer-dashboard?tab=tracking',
    hrefLabel: 'Track Orders',
    highlights: ['Real-time AWB tracking', 'Courier details', 'Dispute within 7 days'],
    tips: [
      'Enable push notifications for live shipment updates',
      'Contact seller directly via Inbox if there is a delay',
      'Raise a dispute within 7 days of delivery for any issues',
    ],
  },
  {
    id: 'bb6',
    title: 'Analytics & Export Reports',
    duration: '3 min',
    description: 'Use the Analytics tab in your buyer dashboard to track spending trends, order history by category, favourite sellers, and repeat purchase rate. Export CSV/PDF reports by month, category, or seller for procurement tracking.',
    icon: 'ChartBarIcon',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    href: '/buyer-dashboard?tab=analytics',
    hrefLabel: 'View Analytics',
    badge: 'New Feature',
    highlights: ['Export CSV & PDF', 'Spending by month/category/seller', 'Repeat purchase rate'],
    tips: [
      'Spending trends chart shows monthly spend over 6 months',
      'Export reports by month, category, or seller for procurement tracking',
      'Favourite sellers list ranks suppliers by order count and total spend',
    ],
  },
];

const personalBuyerSteps: VideoStep[] = [
  {
    id: 'pb1',
    title: 'Create Your Personal Account',
    duration: '2 min',
    description: 'Go to /buyer-registration and choose "Single / Personal Buyer". Enter your name, email, mobile number, and password. No business documents required — your account is ready in under 2 minutes.',
    icon: 'UserPlusIcon',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    href: '/buyer-registration?type=end_user',
    hrefLabel: 'Register as Personal Buyer',
    badge: 'Start Here',
    highlights: ['No business docs needed', 'Ready in 2 minutes', 'Google sign-in available'],
    tips: [
      'Use a personal email address — different from any seller account',
      'No GSTIN, PAN, or business proof needed',
      'Google sign-in is available for buyers — fastest way to get started',
    ],
  },
  {
    id: 'pb2',
    title: 'Sign In with Google',
    duration: '30 sec',
    description: 'Personal buyers can sign in instantly with their Google account. Click "Continue with Google" on the login page — no password needed. Google sign-in is available for buyers only.',
    icon: 'UserCircleIcon',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    href: '/login',
    hrefLabel: 'Sign In',
    badge: 'Google Sign-In',
    highlights: ['One-click sign in', 'No password needed', 'Buyers only'],
    tips: [
      'Google sign-in is only available for buyer accounts',
      'Seller accounts must use email and password',
      'Your Google email becomes your FabricTrad login email',
    ],
  },
  {
    id: 'pb3',
    title: 'Browse & Try Fabrics Virtually',
    duration: '5 min',
    description: 'Explore fabric listings from verified Indian manufacturers. Use the AI-powered Virtual Drape Studio on any product page to see how the fabric looks draped on a model.',
    icon: 'SparklesIcon',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    href: '/marketplace',
    hrefLabel: 'Open Marketplace',
    badge: 'AI Feature',
    highlights: ['AI Virtual Drape Studio', 'Upload your photo', 'Save try-on results'],
    tips: [
      'Upload a clear front-facing photo for best Virtual Drape results',
      'Try different fits: Relaxed, Regular, Tailored',
      'Filter by fabric type, colour, and price range',
    ],
  },
  {
    id: 'pb4',
    title: 'Place Your Order',
    duration: '3 min',
    description: 'Add fabrics to cart, choose quantity, and checkout securely via Razorpay. Supports UPI, credit/debit cards, net banking, and wallets.',
    icon: 'ShoppingCartIcon',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    href: '/cart',
    hrefLabel: 'View Cart',
    highlights: ['All Indian payment methods', 'Secure Razorpay checkout', 'Email & SMS confirmation'],
    tips: [
      'Check the minimum order quantity on each listing',
      'Razorpay supports all major Indian payment methods',
      'Order confirmation is sent via email and SMS',
    ],
  },
  {
    id: 'pb5',
    title: 'Track & Receive Your Order',
    duration: '2 min',
    description: 'Monitor your shipment from your buyer dashboard. Get real-time tracking, estimated delivery, and courier details. Raise a dispute if there is any issue with your order.',
    icon: 'TruckIcon',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    href: '/buyer-dashboard?tab=tracking',
    hrefLabel: 'Track Orders',
    highlights: ['Real-time tracking', 'Dispute within 7 days', 'Refund in 5–7 days'],
    tips: [
      'Disputes must be raised within 7 days of delivery',
      'Refunds are processed within 5–7 business days',
      'Contact seller directly via Inbox for quick resolution',
    ],
  },
];

const sellerSteps: VideoStep[] = [
  {
    id: 's1',
    title: 'Create a Separate Seller Account',
    duration: '3 min',
    description: 'Seller accounts are completely separate from buyer accounts. Go to /seller-registration and use a different email address and mobile number from any buyer account you may have.',
    icon: 'BuildingOfficeIcon',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    href: '/seller-registration',
    hrefLabel: 'Register as Seller',
    badge: 'Start Here',
    highlights: ['Separate from buyer account', 'Email & password only', 'No Google sign-in'],
    tips: [
      'Use a different email address from any buyer account',
      'Google sign-in is NOT available for sellers — use email and password only',
      'Keep GSTIN certificate and cancelled cheque ready',
    ],
  },
  {
    id: 's2',
    title: 'Complete Seller Verification',
    duration: '10 min',
    description: 'After creating your login, complete seller verification: submit GSTIN, bank account details, and identity documents. Our team reviews within 24–48 hours.',
    icon: 'ShieldCheckIcon',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    href: '/seller-registration?resume=1',
    hrefLabel: 'Continue Verification',
    highlights: ['GSTIN verification', 'Bank account for payouts', 'Save & resume anytime'],
    tips: [
      'Business name must match your GST registration exactly',
      'Bank account must be in the business name for payouts',
      'You can save progress and return later',
    ],
  },
  {
    id: 's3',
    title: 'Bulk Import Products via CSV',
    duration: '5 min',
    description: 'Upload 50+ fabric products at once using the CSV bulk import in your Seller Dashboard → Inventory. Download the template, fill in product details, then upload.',
    icon: 'ArrowUpTrayIcon',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    href: '/seller-dashboard?tab=inventory',
    hrefLabel: 'Open Inventory',
    badge: 'Bulk Import',
    highlights: ['50+ products at once', 'Download CSV template', 'GSM & MOQ validation'],
    tips: [
      'Required CSV columns: name, sku, price, available, moq',
      'Optional columns: gsm, category, description, work_type, unit, image_url',
      'All products start as "draft" after import — publish when ready',
    ],
  },
  {
    id: 's4',
    title: 'Manage Orders & Fulfillment',
    duration: '4 min',
    description: 'Accept incoming orders, confirm payment capture, and dispatch via Shiprocket. Print shipping labels and track all shipments from your seller dashboard.',
    icon: 'ShoppingBagIcon',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    href: '/seller-dashboard?tab=orders',
    hrefLabel: 'View Orders',
    highlights: ['Accept within 24 hours', 'Auto courier selection', 'Low-stock alerts'],
    tips: [
      'Accept orders within 24 hours to maintain your seller rating',
      'Shiprocket auto-selects the best courier for each shipment',
      'Dispatch within 2 business days of order confirmation',
    ],
  },
  {
    id: 's5',
    title: 'Track Earnings & Request Payouts',
    duration: '3 min',
    description: 'View your Razorpay payouts, commission breakdown, and tax summaries from the Settlement tab. Submit withdrawal requests — admin approves within 1–2 business days.',
    icon: 'BanknotesIcon',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    href: '/seller-dashboard?tab=settlement',
    hrefLabel: 'View Settlements',
    highlights: ['5% platform commission', 'T+7 settlement cycle', 'Download tax summaries'],
    tips: [
      'Platform commission is 5% + GST (18% on commission)',
      'TDS of 1% is deducted under Section 194H',
      'Settlements are T+7 days after order confirmation',
    ],
  },
  {
    id: 's6',
    title: 'Grow with Analytics & Reputation',
    duration: '3 min',
    description: 'Track your store performance, fulfillment rate, response time, cancellation rate, and customer sentiment trends from the Analytics tab. Use insights to optimise pricing and inventory.',
    icon: 'ChartBarIcon',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    href: '/seller-dashboard?tab=analytics',
    hrefLabel: 'View Analytics',
    highlights: ['Fulfillment rate tracking', 'Sentiment trend chart', 'Reputation score'],
    tips: [
      'Check weekly performance every Monday morning',
      'Products with 5+ photos get 3× more views',
      'Respond to buyer requests within 12 hours for best conversion',
    ],
  },
];

const faqs = [
  { q: 'Can the same account be used as both buyer and seller?', a: 'No. Buyer and seller accounts must use completely different email addresses and mobile numbers. The same account cannot hold both roles. If you want to buy and sell, you need two separate accounts with different credentials.' },
  { q: 'Is Google sign-in available for sellers?', a: 'No. Google sign-in is only available for buyer accounts. Sellers must register and sign in using email and password.' },
  { q: 'What is the difference between a Bulk Buyer and a Personal Buyer?', a: 'Bulk Buyers (shops and businesses) get access to B2B pricing, MOQ-based catalogue orders, and business KYC verification. Personal Buyers get a fast account with no business documents required, suitable for tailoring, events, or household purchases.' },
  { q: 'How do I import products in bulk as a seller?', a: 'Go to Seller Dashboard → Inventory and click "Import CSV". Your CSV must include: name, sku, price, available (stock), and moq columns. Optional columns include gsm, category, description, work_type, unit, and image_url. All imported products start as drafts.' },
  { q: 'How long does seller verification take?', a: 'Typically 24–48 business hours after all documents are submitted. You will receive an email notification once approved.' },
  { q: 'What payment methods are supported?', a: 'All major Indian payment methods via Razorpay: UPI, credit/debit cards, net banking, wallets, and EMI.' },
  { q: 'How are disputes resolved?', a: 'Our team mediates between buyer and seller. Evidence is reviewed and a decision is made within 5 business days. Disputes must be raised within 7 days of delivery.' },
  { q: 'What is MOQ?', a: 'MOQ stands for Minimum Order Quantity. It is the smallest amount a seller will accept for a single order. It is set per product by the seller and enforced at checkout.' },
  { q: 'How does the Virtual Drape AI work?', a: 'Our AI uses GPT-4o Vision to composite your photo with the fabric texture, showing a realistic drape simulation. Available on any product page — results are saved to your profile.' },
  { q: 'Do I need to log in to read this guide?', a: 'No. This How-to-Use guide is fully public and accessible without any login. You only need an account to place orders or list products.' },
];

export default function TutorialPage() {
  const [userType, setUserType] = useState<UserType>('buyer');
  const [buyerSubType, setBuyerSubType] = useState<BuyerSubType>('bulk');
  const [activeStep, setActiveStep] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const steps = userType === 'seller'
    ? sellerSteps
    : buyerSubType === 'bulk'
    ? bulkBuyerSteps
    : personalBuyerSteps;

  const currentStep = steps[activeStep] || steps[0];

  const handleUserTypeChange = (type: UserType) => {
    setUserType(type);
    setActiveStep(0);
  };

  const handleBuyerSubTypeChange = (sub: BuyerSubType) => {
    setBuyerSubType(sub);
    setActiveStep(0);
  };

  const goNext = () => setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  const goPrev = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="text-base font-700 text-gray-900">FabricTrad</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/marketplace" className="hidden text-sm text-gray-600 hover:text-gray-900 sm:block">Marketplace</Link>
            <Link href="/login" className="rounded-lg bg-[#008060] px-4 py-2 text-sm font-600 text-white hover:bg-[#006b52] transition">Get Started</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#008060]/10 px-4 py-1.5 text-sm font-600 text-[#008060]">
            <Icon name="AcademicCapIcon" size={16} />
            Free Guide · No Login Required
          </div>
          <h1 className="text-3xl font-700 text-gray-900 sm:text-4xl">How to Use FabricTrad</h1>
          <p className="mt-3 text-base text-gray-500 max-w-xl mx-auto">
            India&apos;s B2B fabric marketplace. Whether you&apos;re sourcing fabrics or selling them, this interactive guide walks you through every step.
          </p>
        </div>

        {/* Important Notice */}
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Icon name="ExclamationTriangleIcon" size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <strong className="text-amber-900">Buyer and seller accounts are separate.</strong> The same email address or mobile number cannot be used for both a buyer and a seller account. Google sign-in is available for buyers only — sellers must use email and password.
            </div>
          </div>
        </div>

        {/* User Type Toggle */}
        <div className="mb-6 flex justify-center">
          <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {(['buyer', 'seller'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleUserTypeChange(type)}
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

        {/* Buyer Sub-type Toggle */}
        {userType === 'buyer' && (
          <div className="mb-6 flex justify-center">
            <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => handleBuyerSubTypeChange('bulk')}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-600 transition ${
                  buyerSubType === 'bulk' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon name="BuildingStorefrontIcon" size={15} />
                Bulk Buyer (Shop / Business)
              </button>
              <button
                type="button"
                onClick={() => handleBuyerSubTypeChange('personal')}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-600 transition ${
                  buyerSubType === 'personal' ? 'bg-[#008060] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon name="UserIcon" size={15} />
                Single / Personal Buyer
              </button>
            </div>
          </div>
        )}

        {/* Interactive Video-Style Player */}
        <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          {/* Video Header / Progress Bar */}
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${currentStep.bgColor}`}>
                  <Icon name={currentStep.icon as 'HomeIcon'} size={14} className={currentStep.color} />
                </div>
                <span className="text-xs font-700 text-gray-500">
                  Step {activeStep + 1} of {steps.length}
                </span>
                {currentStep.badge && (
                  <span className="rounded-full bg-[#008060]/10 px-2 py-0.5 text-[10px] font-700 text-[#008060]">
                    {currentStep.badge}
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Icon name="ClockIcon" size={12} />
                {currentStep.duration}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#008060] transition-all duration-500"
                style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="grid lg:grid-cols-5">
            {/* Step List Sidebar */}
            <div className="border-b border-gray-100 lg:col-span-2 lg:border-b-0 lg:border-r">
              <div className="p-3">
                {steps.map((step, idx) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(idx)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                      activeStep === idx
                        ? 'bg-[#008060]/5 ring-1 ring-[#008060]/20'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-800 transition ${
                      idx < activeStep
                        ? 'bg-[#008060] text-white'
                        : activeStep === idx
                        ? `${step.bgColor} ${step.color}`
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {idx < activeStep ? (
                        <Icon name="CheckIcon" size={14} />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-700 ${activeStep === idx ? 'text-gray-900' : 'text-gray-600'}`}>
                        {step.title}
                      </p>
                      <p className="text-[10px] text-gray-400">{step.duration}</p>
                    </div>
                    {activeStep === idx && (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-[#008060]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step Detail Panel */}
            <div className="lg:col-span-3 p-6">
              {/* Step Icon + Title */}
              <div className="mb-5 flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${currentStep.bgColor}`}>
                  <Icon name={currentStep.icon as 'HomeIcon'} size={26} className={currentStep.color} />
                </div>
                <div>
                  <h2 className="text-lg font-700 text-gray-900">{currentStep.title}</h2>
                  <p className="mt-0.5 text-xs text-gray-400">{currentStep.duration} to complete</p>
                </div>
              </div>

              {/* Description */}
              <p className="mb-5 text-sm text-gray-600 leading-relaxed">{currentStep.description}</p>

              {/* Highlights */}
              <div className="mb-5 grid grid-cols-3 gap-2">
                {currentStep.highlights.map((h) => (
                  <div key={h} className={`rounded-xl p-2.5 text-center ${currentStep.bgColor}`}>
                    <p className={`text-[11px] font-700 ${currentStep.color}`}>{h}</p>
                  </div>
                ))}
              </div>

              {/* Tips */}
              <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="mb-2.5 text-xs font-700 text-gray-700">💡 Pro Tips</p>
                <div className="space-y-1.5">
                  {currentStep.tips.map((tip) => (
                    <div key={tip} className="flex items-start gap-2">
                      <Icon name="CheckCircleIcon" size={13} className="mt-0.5 shrink-0 text-[#008060]" />
                      <p className="text-xs text-gray-600">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA + Navigation */}
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={currentStep.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#008060] px-5 py-2.5 text-sm font-600 text-white hover:bg-[#006b52] transition"
                >
                  {currentStep.hrefLabel}
                  <Icon name="ArrowRightIcon" size={14} />
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={activeStep === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-30"
                  >
                    <Icon name="ChevronLeftIcon" size={16} />
                  </button>
                  <span className="text-xs text-gray-400">{activeStep + 1} / {steps.length}</span>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={activeStep === steps.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-30"
                  >
                    <Icon name="ChevronRightIcon" size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-700 text-gray-900">
            {userType === 'buyer' ? 'Buyer Features' : 'Seller Features'}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(userType === 'buyer' ? [
              { label: 'Marketplace', href: '/marketplace', icon: 'ShoppingBagIcon', color: 'bg-blue-50 text-blue-700' },
              { label: 'Register as Buyer', href: '/buyer-registration', icon: 'UserPlusIcon', color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Sign In', href: '/login', icon: 'ArrowRightOnRectangleIcon', color: 'bg-gray-100 text-gray-700' },
              { label: 'Virtual Drape AI', href: '/marketplace', icon: 'SparklesIcon', color: 'bg-purple-50 text-purple-700' },
              { label: 'My Orders', href: '/buyer-dashboard?tab=orders', icon: 'ClipboardDocumentListIcon', color: 'bg-amber-50 text-amber-700' },
              { label: 'Export Reports', href: '/buyer-dashboard?tab=analytics', icon: 'ArrowDownTrayIcon', color: 'bg-indigo-50 text-indigo-700' },
              { label: 'Track Shipment', href: '/buyer-dashboard?tab=tracking', icon: 'TruckIcon', color: 'bg-orange-50 text-orange-700' },
              { label: 'Help', href: '/help', icon: 'QuestionMarkCircleIcon', color: 'bg-gray-100 text-gray-700' },
            ] : [
              { label: 'Register as Seller', href: '/seller-registration', icon: 'BuildingOfficeIcon', color: 'bg-blue-50 text-blue-700' },
              { label: 'Seller Dashboard', href: '/seller-dashboard', icon: 'HomeIcon', color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Import CSV', href: '/seller-dashboard?tab=inventory', icon: 'ArrowUpTrayIcon', color: 'bg-amber-50 text-amber-700' },
              { label: 'Add Product', href: '/seller-dashboard?tab=upload', icon: 'PlusCircleIcon', color: 'bg-purple-50 text-purple-700' },
              { label: 'Orders', href: '/seller-dashboard?tab=orders', icon: 'ShoppingBagIcon', color: 'bg-indigo-50 text-indigo-700' },
              { label: 'Settlements', href: '/seller-dashboard?tab=settlement', icon: 'BanknotesIcon', color: 'bg-red-50 text-red-700' },
              { label: 'Analytics', href: '/seller-dashboard?tab=analytics', icon: 'ChartBarIcon', color: 'bg-orange-50 text-orange-700' },
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
          <p className="mt-4 text-xs text-white/60">Buyer and seller accounts require separate email addresses</p>
        </div>
      </main>
    </div>
  );
}
