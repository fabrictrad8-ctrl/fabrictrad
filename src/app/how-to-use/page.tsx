'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';

type UserType = 'buyer' | 'seller';
type BuyerSubType = 'bulk' | 'personal';

type TutorialStep = {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  hrefLabel: string;
  tips: string[];
  badge?: string;
};

const bulkBuyerSteps: TutorialStep[] = [
  {
    id: 'bb1',
    title: 'Create Your Bulk Buyer Account',
    description: 'Go to /buyer-registration and choose "Bulk Buyer — Shop / Business". Enter your name, business email, mobile number, and password. Your account is created instantly — GST and KYC verification comes after.',
    icon: 'BuildingStorefrontIcon',
    href: '/buyer-registration?type=retail_store',
    hrefLabel: 'Register as Bulk Buyer',
    tips: [
      'Use a business email address — this cannot be the same email as a seller account',
      'Keep your GSTIN certificate ready for the KYC step after account creation',
      'Mobile number must be unique — not used on any other FabricTrad account',
      'You will receive an email confirmation after registration',
    ],
    badge: 'Start Here',
  },
  {
    id: 'bb2',
    title: 'Complete Business KYC',
    description: 'After creating your login, complete your business verification from your profile. Submit your GSTIN, PAN, and business proof documents. Our team reviews within 24–48 hours.',
    icon: 'IdentificationIcon',
    href: '/profile',
    hrefLabel: 'Complete KYC',
    tips: [
      'GSTIN verification is instant via the government API',
      'Business name must match your GST registration exactly',
      'Upload clear scans — blurry documents cause delays',
      'You can browse the marketplace while KYC is pending',
    ],
  },
  {
    id: 'bb3',
    title: 'Browse B2B Catalogue',
    description: 'Access the full marketplace with B2B pricing, MOQ-based listings, and bulk fabric options. Filter by fabric type, GSM, MOQ, price range, and verified sellers.',
    icon: 'MagnifyingGlassIcon',
    href: '/marketplace',
    hrefLabel: 'Open Marketplace',
    tips: [
      'Filter by "Verified Seller" for trusted, KYC-approved suppliers',
      'Use GSM filter to find fabrics by weight (e.g. 120–200 GSM for shirting)',
      'MOQ is shown on each listing — check before adding to cart',
      'Save products to wishlist for later comparison and reordering',
    ],
  },
  {
    id: 'bb4',
    title: 'Place Bulk Orders',
    description: 'Add fabrics to cart respecting MOQ, choose quantity in metres or kilograms, and checkout via Razorpay. Supports UPI, cards, net banking, and business payment methods.',
    icon: 'ShoppingCartIcon',
    href: '/cart',
    hrefLabel: 'View Cart',
    tips: [
      'Minimum order quantity (MOQ) is enforced per product',
      'GST invoice is auto-generated after payment',
      'Order confirmation is sent via email and SMS',
      'You can request samples before placing large orders',
    ],
  },
  {
    id: 'bb5',
    title: 'Track Shipments',
    description: 'Monitor real-time shipment status from your buyer dashboard. Get AWB tracking, estimated delivery, and courier details via Shiprocket integration.',
    icon: 'TruckIcon',
    href: '/buyer-dashboard?tab=tracking',
    hrefLabel: 'Track Orders',
    tips: [
      'Enable push notifications for live shipment updates',
      'Contact seller directly via Inbox if there is a delay',
      'Raise a dispute within 7 days of delivery for any issues',
    ],
  },
  {
    id: 'bb6',
    title: 'View Analytics & Reorder',
    description: 'Use the Analytics tab in your buyer dashboard to track spending trends, order history by category, favourite sellers, and repeat purchase rate — making data-driven reorder decisions easy.',
    icon: 'ChartBarIcon',
    href: '/buyer-dashboard?tab=analytics',
    hrefLabel: 'View Analytics',
    tips: [
      'Spending trends chart shows monthly spend over 6 months',
      'Category breakdown helps you identify your most-ordered fabric types',
      'Favourite sellers list ranks suppliers by order count and total spend',
      'Repeat purchase rate shows your supplier loyalty score',
    ],
    badge: 'New Feature',
  },
];

const personalBuyerSteps: TutorialStep[] = [
  {
    id: 'pb1',
    title: 'Create Your Personal Buyer Account',
    description: 'Go to /buyer-registration and choose "Single / Personal Buyer". Enter your name, email, mobile number, and password. No business documents required — your account is ready in under 2 minutes.',
    icon: 'UserPlusIcon',
    href: '/buyer-registration?type=end_user',
    hrefLabel: 'Register as Personal Buyer',
    tips: [
      'Use a personal email address — different from any seller account',
      'No GSTIN, PAN, or business proof needed',
      'Add your delivery address from your profile before placing an order',
      'Google sign-in is available for buyers — fastest way to get started',
    ],
    badge: 'Start Here',
  },
  {
    id: 'pb2',
    title: 'Sign In with Google (Optional)',
    description: 'Personal buyers can sign in instantly with their Google account. Click "Continue with Google" on the login page — no password needed. Google sign-in is available for buyers only.',
    icon: 'UserCircleIcon',
    href: '/login',
    hrefLabel: 'Sign In',
    tips: [
      'Google sign-in is only available for buyer accounts',
      'Seller accounts must use email and password',
      'Your Google email becomes your FabricTrad login email',
    ],
    badge: 'Google Sign-In',
  },
  {
    id: 'pb3',
    title: 'Browse & Try Fabrics Virtually',
    description: 'Explore fabric listings from verified Indian manufacturers. Use the AI-powered Virtual Drape Studio on any product page to see how the fabric looks draped on a model.',
    icon: 'SparklesIcon',
    href: '/marketplace',
    hrefLabel: 'Open Marketplace',
    tips: [
      'Upload a clear front-facing photo for best Virtual Drape results',
      'Try different fits: Relaxed, Regular, Tailored',
      'Save try-on results to your profile for reference',
      'Filter by fabric type, colour, and price range',
    ],
    badge: 'AI Feature',
  },
  {
    id: 'pb4',
    title: 'Place Your Order',
    description: 'Add fabrics to cart, choose quantity, and checkout securely via Razorpay. Supports UPI, credit/debit cards, net banking, and wallets.',
    icon: 'ShoppingCartIcon',
    href: '/cart',
    hrefLabel: 'View Cart',
    tips: [
      'Check the minimum order quantity on each listing',
      'Razorpay supports all major Indian payment methods',
      'Order confirmation is sent via email and SMS',
    ],
  },
  {
    id: 'pb5',
    title: 'Track & Receive Your Order',
    description: 'Monitor your shipment from your buyer dashboard. Get real-time tracking, estimated delivery, and courier details. Raise a dispute if there is any issue with your order.',
    icon: 'TruckIcon',
    href: '/buyer-dashboard?tab=tracking',
    hrefLabel: 'Track Orders',
    tips: [
      'Disputes must be raised within 7 days of delivery',
      'Refunds are processed within 5–7 business days',
      'Contact seller directly via Inbox for quick resolution',
    ],
  },
];

const sellerSteps: TutorialStep[] = [
  {
    id: 's1',
    title: 'Create a Separate Seller Account',
    description: 'Seller accounts are completely separate from buyer accounts. Go to /seller-registration and use a different email address and mobile number from any buyer account you may have. Enter your name, business email, mobile, and password.',
    icon: 'BuildingOfficeIcon',
    href: '/seller-registration',
    hrefLabel: 'Register as Seller',
    tips: [
      'Use a different email address from any buyer account — same email cannot be used for both roles',
      'Use a different mobile number from any buyer account',
      'Google sign-in is NOT available for sellers — use email and password only',
      'Keep GSTIN certificate and cancelled cheque ready for the next step',
    ],
    badge: 'Start Here',
  },
  {
    id: 's2',
    title: 'Complete Seller Verification',
    description: 'After creating your login, complete seller verification: submit GSTIN, bank account details, and identity documents. Our team reviews within 24–48 hours. You will receive an email once approved.',
    icon: 'ShieldCheckIcon',
    href: '/seller-registration?resume=1',
    hrefLabel: 'Continue Verification',
    tips: [
      'Business name must match your GST registration exactly',
      'Bank account must be in the business name for payouts',
      'Upload clear scans of all documents',
      'You can save progress and return later — your data is preserved',
    ],
  },
  {
    id: 's3',
    title: 'Add Products via CSV Bulk Import',
    description: 'Upload 50+ fabric products at once using the CSV bulk import in your Seller Dashboard → Inventory. Download the template, fill in product name, SKU, price, available stock, MOQ, GSM, and category, then upload.',
    icon: 'ArrowUpTrayIcon',
    href: '/seller-dashboard?tab=inventory',
    hrefLabel: 'Open Inventory',
    tips: [
      'Required CSV columns: name, sku, price, available, moq',
      'Optional columns: gsm, category, description, work_type, unit, image_url',
      'GSM (grams per square metre) helps buyers filter by fabric weight',
      'MOQ is enforced at checkout — set it accurately',
      'All products start as "draft" after import — publish when ready',
    ],
    badge: 'Bulk Import',
  },
  {
    id: 's4',
    title: 'Manage Orders & Fulfillment',
    description: 'Accept incoming orders, confirm payment capture, and dispatch via Shiprocket. Print shipping labels and track all shipments from your seller dashboard.',
    icon: 'ShoppingBagIcon',
    href: '/seller-dashboard?tab=orders',
    hrefLabel: 'View Orders',
    tips: [
      'Accept orders within 24 hours to maintain your seller rating',
      'Shiprocket auto-selects the best courier for each shipment',
      'Dispatch within 2 business days of order confirmation',
      'Low-stock alerts appear automatically when inventory drops below MOQ',
    ],
  },
  {
    id: 's5',
    title: 'Track Earnings & Request Payouts',
    description: 'View your Razorpay payouts, commission breakdown, and tax summaries from the Settlement tab. Submit withdrawal requests specifying your payout amount and bank details — admin approves within 1–2 business days.',
    icon: 'BanknotesIcon',
    href: '/seller-dashboard?tab=settlement',
    hrefLabel: 'View Settlements',
    tips: [
      'Platform commission is 5% + GST (18% on commission)',
      'TDS of 1% is deducted under Section 194H',
      'Settlements are T+7 days after order confirmation',
      'Download tax summaries for your CA from the Billing tab',
    ],
  },
  {
    id: 's6',
    title: 'Grow with Analytics',
    description: 'Track your store performance, top-selling fabrics, buyer demographics, and revenue trends from the Analytics tab. Use insights to optimise pricing and inventory.',
    icon: 'ChartBarIcon',
    href: '/seller-dashboard?tab=analytics',
    hrefLabel: 'View Analytics',
    tips: [
      'Check weekly performance every Monday morning',
      'Products with 5+ photos get 3× more views',
      'Competitive pricing within 10% of market rate drives more sales',
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
  const [expandedStep, setExpandedStep] = useState<string | null>('bb1');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const steps = userType === 'seller'
    ? sellerSteps
    : buyerSubType === 'bulk'
    ? bulkBuyerSteps
    : personalBuyerSteps;

  const handleUserTypeChange = (type: UserType) => {
    setUserType(type);
    if (type === 'buyer') {
      setExpandedStep(buyerSubType === 'bulk' ? 'bb1' : 'pb1');
    } else {
      setExpandedStep('s1');
    }
  };

  const handleBuyerSubTypeChange = (sub: BuyerSubType) => {
    setBuyerSubType(sub);
    setExpandedStep(sub === 'bulk' ? 'bb1' : 'pb1');
  };

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
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#008060]/10 px-4 py-1.5 text-sm font-600 text-[#008060]">
            <Icon name="AcademicCapIcon" size={16} />
            Free Guide · No Login Required
          </div>
          <h1 className="text-3xl font-700 text-gray-900 sm:text-4xl">How to Use FabricTrad</h1>
          <p className="mt-3 text-base text-gray-500 max-w-xl mx-auto">
            India&apos;s B2B fabric marketplace. Whether you&apos;re sourcing fabrics or selling them, this guide walks you through every step — from creating an account to placing your first order.
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

        {/* Section Description */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {userType === 'buyer' && buyerSubType === 'bulk' && (
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Icon name="BuildingStorefrontIcon" size={22} />
              </div>
              <div>
                <h2 className="text-base font-700 text-gray-900">Bulk Buyer — Shop / Business Guide</h2>
                <p className="mt-1 text-sm text-gray-500">For shops, boutiques, garment manufacturers, and businesses ordering 50+ metres. Includes B2B pricing, MOQ-based orders, GSTIN verification, and analytics for data-driven reorders.</p>
              </div>
            </div>
          )}
          {userType === 'buyer' && buyerSubType === 'personal' && (
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Icon name="UserIcon" size={22} />
              </div>
              <div>
                <h2 className="text-base font-700 text-gray-900">Single / Personal Buyer Guide</h2>
                <p className="mt-1 text-sm text-gray-500">For individuals buying for tailoring, events, or household use. Fast account creation with no business documents. Google sign-in available. No minimum order quantity restrictions.</p>
              </div>
            </div>
          )}
          {userType === 'seller' && (
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <Icon name="BuildingOfficeIcon" size={22} />
              </div>
              <div>
                <h2 className="text-base font-700 text-gray-900">Seller Guide</h2>
                <p className="mt-1 text-sm text-gray-500">For fabric manufacturers, wholesalers, and distributors. Includes seller registration (separate from buyer accounts), CSV bulk product import, order management, settlements, and analytics.</p>
              </div>
            </div>
          )}
        </div>

        {/* Step-by-Step Guide */}
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-700 text-gray-900">
            Step-by-Step Guide
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
                      <div className="flex items-center gap-2 flex-wrap">
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
              { label: 'Register as Buyer', href: '/buyer-registration', icon: 'UserPlusIcon', color: 'bg-emerald-50 text-emerald-700' },
              { label: 'Sign In', href: '/login', icon: 'ArrowRightOnRectangleIcon', color: 'bg-gray-100 text-gray-700' },
              { label: 'Virtual Drape', href: '/marketplace', icon: 'SparklesIcon', color: 'bg-purple-50 text-purple-700' },
              { label: 'My Orders', href: '/buyer-dashboard?tab=orders', icon: 'ClipboardDocumentListIcon', color: 'bg-amber-50 text-amber-700' },
              { label: 'Analytics', href: '/buyer-dashboard?tab=analytics', icon: 'ChartBarIcon', color: 'bg-indigo-50 text-indigo-700' },
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
