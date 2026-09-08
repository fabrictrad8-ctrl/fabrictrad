'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import { getHowToUseCopy } from '@/lib/howToUseTranslations';

export default function HowToUseStartPage() {
  const { language } = useAppPreferences();
  const copy = getHowToUseCopy(language).start;

  const guideOptions = [
    {
      role: 'buyer' as const,
      ...copy.buyer,
      icon: 'ShoppingBagIcon',
      href: '/how-to-use?role=buyer',
    },
    {
      role: 'seller' as const,
      ...copy.seller,
      icon: 'BuildingStorefrontIcon',
      href: '/how-to-use?role=seller',
    },
  ];

  return (
    <main className="ft-storefront min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        <section className="border-b border-border bg-card px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1.5 text-xs font-850 text-success">
              <Icon name="LockOpenIcon" size={15} />
              {copy.publicBadge}
            </div>
            <p className="mt-6 text-xs font-850 uppercase tracking-[0.18em] text-primary">
              {copy.eyebrow}
            </p>
            <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-900 tracking-[-0.045em] text-foreground sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              {copy.intro}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid gap-5 md:grid-cols-2">
            {guideOptions.map((guide) => {
              const buyer = guide.role === 'buyer';
              return (
                <Link
                  key={guide.role}
                  href={guide.href}
                  className={`group ft-glass-card rounded-[28px] border p-6 text-left transition hover:-translate-y-1 sm:p-8 ${
                    buyer
                      ? 'border-orange-200 dark:border-orange-900/40 hover:border-orange-300 hover:shadow-[0_24px_70px_rgba(194,65,12,0.12)]'
                      : 'border-teal-200 dark:border-teal-900/40 hover:border-teal-300 hover:shadow-[0_24px_70px_rgba(13,148,136,0.12)]'
                  }`}
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                      buyer ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                    }`}
                  >
                    <Icon name={guide.icon} size={27} />
                  </div>
                  <p
                    className={`mt-6 text-xs font-850 uppercase tracking-[0.16em] ${
                      buyer ? 'text-orange-600 dark:text-orange-400' : 'text-teal-600 dark:text-teal-400'
                    }`}
                  >
                    {guide.eyebrow}
                  </p>
                  <h2 className="mt-2 text-2xl font-900 tracking-tight text-foreground">{guide.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{guide.description}</p>

                  <div className="mt-6 space-y-2 text-sm text-foreground">
                    {guide.bullets.map((bullet) => (
                      <span key={bullet} className="flex items-center gap-2">
                        <Icon
                          name="CheckCircleIcon"
                          size={17}
                          className={buyer ? 'text-orange-600 dark:text-orange-400' : 'text-teal-600 dark:text-teal-400'}
                        />
                        {bullet}
                      </span>
                    ))}
                  </div>

                  <span
                    className={`mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-850 text-white ${
                      buyer ? 'bg-orange-700' : 'bg-teal-700'
                    }`}
                  >
                    {guide.button}
                    <Icon name="ArrowRightIcon" size={16} />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="EyeIcon" size={15} /> {copy.noAccountData}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <span className="inline-flex items-center gap-1.5">
              <Icon name="ShieldCheckIcon" size={15} /> {copy.safePreview}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <Link href="/help" className="font-800 text-primary hover:underline">
              {copy.helpCentre}
            </Link>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
