import React from 'react';
import Icon from '@/components/ui/AppIcon';

const steps = [
  {
    number: '01',
    icon: 'MagnifyingGlassIcon',
    title: 'Browse & Discover',
    description:
      'Search verified textile sellers across India. Filter by GSM, width, MOQ, dispatch time, and more.',
    color: 'bg-blue-50 text-blue-600',
    accent: '#3B82F6',
  },
  {
    number: '02',
    icon: 'DocumentCheckIcon',
    title: 'Submit Order Request',
    description:
      'Select quantity and submit your request. Seller confirms availability within their response window.',
    color: 'bg-amber-50 text-amber-600',
    accent: '#D97706',
  },
  {
    number: '03',
    icon: 'CreditCardIcon',
    title: 'Secure Payment',
    description: '100% secure payment via Razorpay. No COD. GST invoice generated automatically.',
    color: 'bg-green-50 text-green-600',
    accent: '#16A34A',
  },
  {
    number: '04',
    icon: 'TruckIcon',
    title: 'Automated Fulfilment',
    description:
      'Shipment created on Shiprocket automatically. Track your order in real-time from dashboard.',
    color: 'bg-primary/10 text-primary',
    accent: '#C8600A',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-700 text-primary uppercase tracking-widest mb-2">Process</p>
          <h2 className="text-section-title text-foreground mb-3">How FabricTrad Works</h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            From sourcing to shipping — fully automated. No calls, no confusion.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] right-0 h-0.5 bg-gradient-to-r from-border to-transparent z-0" />
              )}

              <div className="bg-card rounded-2xl p-6 border border-border card-shadow hover:card-shadow-hover transition-all relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center`}
                  >
                    <Icon name={step.icon as 'TruckIcon'} size={22} />
                  </div>
                  <span className="font-mono text-2xl font-800 text-muted-foreground/30">
                    {step.number}
                  </span>
                </div>
                <h3 className="text-base font-700 text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature Pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {[
            '100% prepaid buyer orders',
            'GST invoice on every order',
            'Verified seller profiles',
            'AI drape preview for fabric inspection',
            'Real-time shipment tracking',
          ].map((pill) => (
            <span
              key={pill}
              className="bg-muted border border-border rounded-full px-4 py-2 text-xs font-500 text-foreground"
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
