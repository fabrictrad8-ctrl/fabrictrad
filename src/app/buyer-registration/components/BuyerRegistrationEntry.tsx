'use client';

import { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import BuyerRegistrationFlow from './BuyerRegistrationFlow';

type BuyerType = 'retail_store' | 'end_user';

const options: Array<{
  value: BuyerType;
  title: string;
  subtitle: string;
  description: string;
  icon: 'BuildingStorefrontIcon' | 'UserIcon';
  features: string[];
}> = [
  {
    value: 'retail_store',
    title: 'Retail Store',
    subtitle: 'I am buying for my shop or business',
    description: 'Source wholesale and retail-ready fabrics for resale while keeping the same account available for seller activation.',
    icon: 'BuildingStorefrontIcon',
    features: ['Business purchasing profile', 'Bulk and repeat-order tools', 'Can activate selling on the same mobile number'],
  },
  {
    value: 'end_user',
    title: 'Buy for me',
    subtitle: 'End User / personal purchase',
    description: 'Buy smaller quantities for personal use, tailoring, events or a single household requirement.',
    icon: 'UserIcon',
    features: ['Single-user buying flow', 'Retail quantities where available', 'Access to the same approved product catalogue'],
  },
];

export default function BuyerRegistrationEntry() {
  const [buyerType, setBuyerType] = useState<BuyerType | null>(null);

  const chooseType = (value: BuyerType) => {
    document.cookie = `fabrictrad_buyer_type=${value}; Path=/; Max-Age=7200; SameSite=Lax`;
    window.sessionStorage.setItem('fabrictrad_buyer_type', value);
    setBuyerType(value);
  };

  if (buyerType) {
    return (
      <div>
        <div className="mx-auto max-w-2xl px-4 pt-8">
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <Icon name={buyerType === 'retail_store' ? 'BuildingStorefrontIcon' : 'UserIcon'} size={19} />
              </div>
              <div>
                <p className="text-xs font-800 uppercase tracking-[0.13em] text-primary">Buyer type</p>
                <p className="text-sm font-800 text-foreground">
                  {buyerType === 'retail_store' ? 'Retail Store' : 'Buy for me · End User'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBuyerType(null)}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-800 text-foreground hover:border-primary/40 hover:text-primary"
            >
              Change buyer type
            </button>
          </div>
        </div>
        <BuyerRegistrationFlow />
      </div>
    );
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-muted/30 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-xs font-800 uppercase tracking-[0.16em] text-primary">Create your FabricTrad account</p>
          <h1 className="mt-3 text-3xl font-800 tracking-tight text-foreground sm:text-4xl">How will you buy?</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Choose the buying profile that matches your requirement. One mobile number remains one unified account, and an eligible account can later buy and sell without registering again.
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
                <Icon name="ArrowRightIcon" size={20} className="mt-2 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              <h2 className="mt-5 text-xl font-800 text-foreground">{option.title}</h2>
              <p className="mt-1 text-sm font-700 text-primary">{option.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{option.description}</p>
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
      </div>
    </section>
  );
}
