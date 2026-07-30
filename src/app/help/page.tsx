'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

const topics = [
  { title: 'Buying fabrics', icon: 'ShoppingBagIcon', copy: 'Marketplace filters, colours, quantity, orders, payments and tracking.', href: '/buyer-dashboard' },
  { title: 'Selling on FabricTrad', icon: 'BuildingStorefrontIcon', copy: 'GST activation, catalogue upload, inventory, orders and payouts.', href: '/seller-dashboard' },
  { title: 'Account & verification', icon: 'ShieldCheckIcon', copy: 'Login, phone, identity, GST, profile and security settings.', href: '/profile' },
  { title: 'Orders & fulfilment', icon: 'TruckIcon', copy: 'Seller acceptance, payment, shipment tracking and issue evidence.', href: '/buyer-dashboard?tab=orders' },
  { title: 'Buyer requirements', icon: 'MegaphoneIcon', copy: 'Post sourcing needs, review responses and use secure messaging.', href: '/buyer-requirements' },
  { title: 'Privacy & platform rules', icon: 'DocumentTextIcon', copy: 'Read data practices, responsibilities and prohibited activity.', href: '/privacy' },
];

const faqs = [
  ['Can one account buy and sell?', 'Yes. A verified account can keep buying access and activate seller tools with GST business details on the same login.'],
  ['Why is my seller dashboard unavailable?', 'Complete seller activation, upload the required documents and make sure the account has can_sell access. Pending verification information is shown in the seller profile readiness panel.'],
  ['Can buyers order a single piece?', 'Products configured for retail can allow a quantity of one. Other listings can enforce seller-defined MOQ or package quantities.'],
  ['How do seller order requests work?', 'The buyer submits a quantity request. The seller accepts, rejects or confirms an available quantity. Accepted requests can proceed to payment and fulfilment.'],
  ['Where can I track a shipment?', 'Open Buyer dashboard → Track shipments. Sellers can manage dispatch and tracking from Seller dashboard → Fulfilment.'],
  ['How do I upload multiple products?', 'Use Seller dashboard → Inventory → Import CSV, or use the AI Catalogue Studio for media and structured product extraction.'],
  ['What should I do if payment fails?', 'Do not retry repeatedly. Check the order status first, then use the same order page or contact support with the FabricTrad order ID and payment reference.'],
  ['How do I report damaged or incorrect goods?', 'Open the relevant order or dispute flow and provide timely photographs, packaging evidence and an unedited unboxing video when required.'],
];

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const filteredFaqs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return faqs.filter(([question, answer]) => !normalized || `${question} ${answer}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <main className="ft-storefront min-h-screen">
      <Header />
      <div className="pt-16">
        <section className="ft-route-hero px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="relative z-10 mx-auto max-w-5xl text-center">
            <p className="ft-route-kicker">Help centre</p>
            <h1 className="ft-route-title mt-3">How can we help with FabricTrad?</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Find buyer, seller, account, payment and fulfilment guidance, or contact support with the relevant account or order ID.
            </p>
            <div className="ft-search mx-auto mt-7 max-w-2xl text-left">
              <Icon name="MagnifyingGlassIcon" size={19} className="ml-4 text-muted-foreground" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help topics and questions" className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
              {query && <button type="button" onClick={() => setQuery('')} className="mr-2 rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Clear help search"><Icon name="XMarkIcon" size={16} /></button>}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <Link key={topic.title} href={topic.href} className="ft-resource-card group p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name={topic.icon as 'ShoppingBagIcon'} size={21} /></div>
                <h2 className="mt-4 text-base font-800 text-foreground group-hover:text-primary">{topic.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{topic.copy}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-800 text-primary">Open section <Icon name="ArrowRightIcon" size={13} /></span>
              </Link>
            ))}
          </div>

          <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div><p className="ft-route-kicker">Frequently asked</p><h2 className="mt-1 text-2xl font-800 tracking-tight text-foreground">Common questions</h2></div>
                <span className="ft-orange-chip">{filteredFaqs.length} answers</span>
              </div>
              <div className="space-y-3">
                {filteredFaqs.map(([question, answer]) => (
                  <details key={question} className="ft-card group p-0">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-800 text-foreground">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon name="QuestionMarkCircleIcon" size={16} /></span>
                      <span className="flex-1">{question}</span>
                      <Icon name="ChevronDownIcon" size={17} className="text-muted-foreground transition group-open:rotate-180" />
                    </summary>
                    <p className="border-t border-border px-5 py-4 text-sm leading-7 text-muted-foreground">{answer}</p>
                  </details>
                ))}
                {!filteredFaqs.length && <div className="ft-card ft-empty-state"><div><Icon name="MagnifyingGlassIcon" size={32} className="mx-auto text-primary" /><h3 className="mt-3 font-800">No matching help articles</h3><p className="mt-2 text-sm text-muted-foreground">Try a shorter search or contact support.</p></div></div>}
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><Icon name="LifebuoyIcon" size={21} /></div>
                <h2 className="mt-4 text-lg font-800 text-foreground">Contact support</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Include your registered email, FabricTrad account ID, order ID and a concise description. Never email passwords or OTPs.</p>
                <a href="mailto:fabrictrad8@gmail.com?subject=FabricTrad%20Support%20Request" className="ft-primary-action mt-5 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm"><Icon name="EnvelopeIcon" size={16} /> Email support</a>
              </div>
              <div className="ft-card p-5">
                <p className="text-sm font-800 text-foreground">Security reminder</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">FabricTrad support should never ask for your password, full card details or OTP. Report suspicious requests immediately.</p>
              </div>
            </aside>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
