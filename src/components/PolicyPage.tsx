import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

type PolicySection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export default function PolicyPage({
  kicker,
  title,
  intro,
  sections,
  notice,
}: {
  kicker: string;
  title: string;
  intro: string;
  sections: PolicySection[];
  notice?: string;
}) {
  return (
    <main className="ft-storefront min-h-screen">
      <Header />
      <div className="pt-16">
        <section className="ft-route-hero px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="relative z-10 mx-auto max-w-5xl">
            <p className="ft-route-kicker">{kicker}</p>
            <h1 className="ft-route-title mt-3">{title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{intro}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="ft-orange-chip"><Icon name="CalendarDaysIcon" size={13} /> Updated 31 July 2026</span>
              <a href="mailto:fabrictrad8@gmail.com" className="ft-orange-chip"><Icon name="EnvelopeIcon" size={13} /> fabrictrad8@gmail.com</a>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-5 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {notice && (
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <Icon name="InformationCircleIcon" size={20} className="mt-0.5 shrink-0 text-warning" />
                <p className="text-sm leading-6 text-muted-foreground">{notice}</p>
              </div>
            </div>
          )}

          {sections.map((section, index) => (
            <article key={section.title} className="ft-card p-5 sm:p-7">
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-800 text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-800 tracking-tight text-foreground">{section.title}</h2>
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph} className="mt-3 text-sm leading-7 text-muted-foreground">{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-4 space-y-2.5">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                          <Icon name="CheckCircleIcon" size={16} className="mt-1 shrink-0 text-primary" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
      <Footer />
    </main>
  );
}
