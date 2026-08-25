'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import AuthenticatedBuyerRegistrationResume from './AuthenticatedBuyerRegistrationResume';
import PersonalBuyerQuickSignup from './PersonalBuyerQuickSignup';
import RetailBuyerAccountStart from './RetailBuyerAccountStart';

type BuyerType = 'retail_store' | 'end_user';

const options: Array<{
  value: BuyerType;
  title: string;
  subtitle: string;
  description: string;
  icon: 'BuildingStorefrontIcon' | 'UserIcon';
  features: string[];
  notice: string;
}> = [
  {
    value: 'retail_store',
    title: 'Bulk Buyer — Shop / Business',
    subtitle: 'I am buying in bulk for my shop, boutique, or business',
    description:
      'Create your buyer login first, then complete GST and business KYC. Designed for shops, boutiques, garment manufacturers, and businesses ordering 50+ metres.',
    icon: 'BuildingStorefrontIcon',
    features: [
      'Secure account created before KYC begins',
      'GSTIN verification for GST-registered businesses',
      'PAN or Aadhaar Offline e-KYC plus business proof',
      'Access to bulk pricing, MOQ-based orders, and B2B catalogue',
    ],
    notice: 'Account first · KYC second',
  },
  {
    value: 'end_user',
    title: 'Single / Personal Buyer',
    subtitle: 'I am buying for myself, tailoring, an event, or household use',
    description:
      'Create a simple account and start shopping. No business documents required. Add a delivery address from your profile before your first order.',
    icon: 'UserIcon',
    features: [
      'No PAN, Aadhaar, GST certificate or business proof',
      'One-screen account creation',
      'Delivery address is not a signup requirement',
      'Access to retail listings with no minimum order quantity',
    ],
    notice: 'Fast signup · no official documents',
  },
];

const validBuyerType = (value: string | null): value is BuyerType =>
  value === 'retail_store' || value === 'end_user';

const persistBuyerType = (value: BuyerType) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `fabrictrad_buyer_type=${value}; Path=/; Max-Age=7200; SameSite=Lax${secure}`;
  window.sessionStorage.setItem('fabrictrad_buyer_type', value);
  window.localStorage.setItem('fabrictrad_buyer_type', value);
};

const clearBuyerType = () => {
  document.cookie = 'fabrictrad_buyer_type=; Path=/; Max-Age=0; SameSite=Lax';
  window.sessionStorage.removeItem('fabrictrad_buyer_type');
  window.localStorage.removeItem('fabrictrad_buyer_type');
};

export default function BuyerRegistrationEntry() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const requestedType = validBuyerType(searchParams.get('type'))
    ? (searchParams.get('type') as BuyerType)
    : null;
  const [buyerType, setBuyerType] = useState<BuyerType | null>(requestedType);
  const isAuthenticatedAccount = Boolean(user);

  useEffect(() => {
    if (requestedType) {
      persistBuyerType(requestedType);
      setBuyerType(requestedType);
      return;
    }

    const stored =
      window.localStorage.getItem('fabrictrad_buyer_type') ||
      window.sessionStorage.getItem('fabrictrad_buyer_type');
    if (validBuyerType(stored)) setBuyerType(stored);
  }, [requestedType]);

  const chooseType = (value: BuyerType) => {
    persistBuyerType(value);
    setBuyerType(value);
  };

  const changeType = () => {
    clearBuyerType();
    setBuyerType(null);
    if (window.location.search) window.history.replaceState(null, '', '/buyer-registration');
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-label="Loading registration"
        />
      </div>
    );
  }

  if (buyerType) {
    return (
      <div>
        <div className="mx-auto max-w-3xl px-4 pt-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                <Icon
                  name={buyerType === 'retail_store' ? 'BuildingStorefrontIcon' : 'UserIcon'}
                  size={20}
                />
              </div>
              <div>
                <p className="text-xs font-800 uppercase tracking-[0.13em] text-primary">Buyer type</p>
                <p className="text-sm font-800 text-foreground">
                  {buyerType === 'retail_store' ?'Retail Store · account first, business KYC second' :'Personal Buyer · fast signup, no business KYC'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={changeType}
              className="min-h-11 rounded-xl border border-border bg-card px-4 py-2 text-xs font-800 text-foreground hover:border-primary/40 hover:text-primary"
            >
              Change buyer type
            </button>
          </div>
        </div>

        {isAuthenticatedAccount ? (
          <AuthenticatedBuyerRegistrationResume buyerType={buyerType} />
        ) : buyerType === 'end_user' ? (
          <PersonalBuyerQuickSignup />
        ) : (
          <RetailBuyerAccountStart />
        )}
      </div>
    );
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-muted/30 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">
            {isAuthenticatedAccount ? 'Continue your FabricTrad setup' : 'Create your buyer account'}
          </p>
          <h1 className="mt-3 text-3xl font-800 tracking-tight text-foreground sm:text-4xl">
            What type of buyer are you?
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {isAuthenticatedAccount
              ? 'Your login is already secured. Choose your buyer type and FabricTrad will set up your buyer workspace.' :'Bulk buyers (shops and businesses) get B2B pricing and catalogue access. Personal buyers get a fast account with no business documents required.'}
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => chooseType(option.value)}
              className="group rounded-3xl border border-border bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                  <Icon name={option.icon} size={23} />
                </div>
                <Icon
                  name="ArrowRightIcon"
                  size={20}
                  className="mt-2 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"
                />
              </div>
              <h2 className="mt-5 text-xl font-800 text-foreground">{option.title}</h2>
              <p className="mt-1 text-sm font-700 text-primary">{option.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{option.description}</p>
              <div
                className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-800 ${
                  option.value === 'end_user' ?'bg-success/10 text-success' :'bg-amber-100 text-amber-800'
                }`}
              >
                {option.notice}
              </div>
              <ul className="mt-5 space-y-2.5">
                {option.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                    <Icon name="CheckCircleIcon" size={17} className="mt-0.5 shrink-0 text-success" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-error/20 bg-error/5 p-4 text-xs leading-5 text-muted-foreground">
          <strong className="text-foreground">Important:</strong> Buyer and seller accounts must use different email addresses and mobile numbers. The same account cannot be used as both a buyer and a seller. If you want to sell on FabricTrad,{' '}
          <a href="/seller-registration" className="font-700 text-primary hover:underline">register a separate seller account</a>.
        </div>
      </div>
    </section>
  );
}
