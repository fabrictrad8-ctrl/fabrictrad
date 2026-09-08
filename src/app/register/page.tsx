'use client';

import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import PreferenceControls from '@/components/PreferenceControls';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

const options = [
  { href: '/buyer-registration?type=end_user', icon: 'UserIcon', title: 'register.personal', description: 'register.personalCopy' },
  { href: '/buyer-registration?type=retail_store', icon: 'ShoppingBagIcon', title: 'register.retail', description: 'register.retailCopy' },
  { href: '/seller-registration', icon: 'BuildingStorefrontIcon', title: 'register.sell', description: 'register.sellCopy' },
] as const;

export default function RegisterPage() {
  const { t } = useAppPreferences();
  return (
    <main className="ft-future-landing ft-showroom min-h-screen">
      <header className="ft-future-topbar">
        <div className="ft-future-nav">
          <Link href="/" className="ft-future-brand" aria-label="FabricTrad"><AppLogo size={34} /></Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex"><PreferenceControls compact /></div>
            <Link href="/login" className="ft-secondary-action inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-800">{t('nav.signIn')}</Link>
          </div>
        </div>
      </header>
      <section className="relative z-[2] mx-auto w-full max-w-[1240px] px-5 pb-20 pt-32 sm:px-8 lg:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-700 text-[#ff9a69]">{t('register.kicker')}</p>
          <h1 className="mt-5 text-balance text-4xl font-850 leading-tight tracking-tight text-white sm:text-6xl">{t('register.title')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#9ba8bb]">{t('register.copy')}</p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {options.map((option) => (
            <Link key={option.href} href={option.href} className="ft-resource-card group flex flex-col rounded-2xl border border-border bg-card p-7 text-foreground shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name={option.icon} size={26} /></div>
              <h2 className="mt-7 text-2xl font-800">{t(option.title)}</h2>
              <p className="mb-8 mt-4 text-base leading-8 text-muted-foreground">{t(option.description)}</p>
              <span className="mt-auto inline-flex items-center gap-3 text-sm font-800 text-primary">{t('nav.createAccount')}<Icon name="ArrowRightIcon" size={18} /></span>
            </Link>
          ))}
        </div>
        <div className="mt-10 text-center"><Link href="/login" className="inline-flex min-h-11 items-center rounded-lg px-5 text-base font-700 text-primary underline underline-offset-4">{t('nav.signIn')}</Link></div>
      </section>
    </main>
  );
}
