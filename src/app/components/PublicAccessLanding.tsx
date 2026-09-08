'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import PreferenceControls from '@/components/PreferenceControls';
import TiltShowcase from '@/components/TiltShowcase';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import { getPublicLandingCopy } from '@/lib/publicLandingTranslations';

const capabilityIcons = ['MagnifyingGlassIcon', 'BuildingStorefrontIcon', 'SparklesIcon'] as const;
const trustIcons = ['ShieldCheckIcon', 'CreditCardIcon', 'TruckIcon'] as const;

export default function PublicAccessLanding() {
  const { language, t } = useAppPreferences();
  const copy = getPublicLandingCopy(language);
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { href: '#platform', label: copy.navPlatform },
    { href: '#capabilities', label: copy.navCapabilities },
    { href: '/custom-order', label: t('nav.customOrder') },
    { href: '/how-to-use/start', label: copy.navHowToUse },
    { href: '#trust', label: copy.navTrust },
  ];

  return (
    <main className="ft-future-landing ft-showroom min-h-screen overflow-hidden">
      <header className="ft-future-topbar">
        <div className="ft-future-nav">
          <Link href="/" className="ft-future-brand" aria-label="FabricTrad home">
            <AppLogo size={34} />
            <span>FabricTrad</span>
          </Link>

          <nav className="ft-future-navlinks" aria-label="Public navigation">
            <a href="#platform">{copy.navPlatform}</a>
            <a href="#capabilities">{copy.navCapabilities}</a>
            <Link href="/custom-order">{t('nav.customOrder')}</Link>
            <Link href="/how-to-use/start">{copy.navHowToUse}</Link>
            <a href="#trust">{copy.navTrust}</a>
          </nav>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <PreferenceControls compact />
            <Link href="/login" className="ft-secondary-action inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-800">
              {copy.signIn}
            </Link>
            <Link href="/register" className="ft-primary-action inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-800">
              {copy.joinFabricTrad} <Icon name="ArrowRightIcon" size={15} />
            </Link>
          </div>

          <button
            type="button"
            className="ft-mobile-menu-trigger ft-future-menu-btn ml-auto md:hidden"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <Icon name={menuOpen ? 'XMarkIcon' : 'Bars3Icon'} size={22} />
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <button type="button" className="ft-future-menu-backdrop md:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
          <aside className="ft-mobile-commerce-menu ft-future-menu-drawer md:hidden">
            <div className="ft-future-menu-header">
              <Link href="/" className="ft-future-brand" onClick={() => setMenuOpen(false)}>
                <AppLogo size={30} />
                <span>FabricTrad</span>
              </Link>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="ft-future-menu-btn">
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            <nav className="ft-future-menu-links" aria-label="Public navigation">
              {navItems.map((item) =>
                item.href.startsWith('#') ? (
                  <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
                ) : (
                  <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>
                )
              )}
            </nav>

            <div className="ft-future-menu-prefs">
              <PreferenceControls />
            </div>

            <div className="ft-future-menu-actions">
              <Link href="/login" className="ft-secondary-action inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-800" onClick={() => setMenuOpen(false)}>
                {copy.signIn}
              </Link>
              <Link href="/register" className="ft-primary-action inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-800" onClick={() => setMenuOpen(false)}>
                {copy.joinFabricTrad} <Icon name="ArrowRightIcon" size={15} />
              </Link>
            </div>
          </aside>
        </>
      )}

      <section id="platform" className="ft-future-hero">
        <div className="ft-hero-orchestrated relative z-10">
          <div className="ft-future-kicker">
            <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
            {copy.kicker}
          </div>

          <h1>
            {copy.titleLead}<br />
            <em>{copy.titleAccent}</em>
          </h1>

          <p className="ft-future-hero-copy">{copy.heroCopy}</p>

          <div className="ft-future-hero-actions">
            <Link href="/login" className="ft-primary-action rounded-xl">
              {copy.enterFabricTrad} <Icon name="ArrowRightIcon" size={17} />
            </Link>
            <Link href="/how-to-use/start" className="ft-secondary-action rounded-xl">
              {copy.watchHowItWorks}
            </Link>
          </div>

          <div className="ft-future-trustline">
            <span><Icon name="ShieldCheckIcon" size={15} className="text-emerald-600" /> {copy.verifiedSellerAccess}</span>
            <span><Icon name="CreditCardIcon" size={15} className="text-orange-600" /> {copy.protectedPaymentFlow}</span>
            <span><Icon name="DevicePhoneMobileIcon" size={15} className="text-teal-600" /> {copy.deviceSupport}</span>
          </div>
        </div>

        <div className="ft-textile-visual">
          <TiltShowcase>
            <Image src="/images/textile-showroom.webp" alt="" fill priority sizes="(max-width: 900px) 100vw, 50vw" className="ft-textile-image" />
            <div className="ft-textile-caption">
              <Icon name="BuildingStorefrontIcon" size={24} />
              <div><strong>{copy.buyerMarketplace}</strong><p>{copy.buyerMarketplaceCopy}</p></div>
            </div>
          </TiltShowcase>
        </div>
      </section>

      <section id="capabilities" className="relative z-[2] mx-auto w-[min(1420px,calc(100%-32px))] px-4 pb-8 sm:px-0">
        <div className="ft-reveal rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_1.2fr] lg:items-end">
            <div className="min-w-0">
              <p className="text-xs font-850 uppercase tracking-[0.16em] text-[#ff9a69]">{copy.workspacesKicker}</p>
              <h2 className="mt-3 text-3xl font-850 tracking-[-0.04em] text-white sm:text-5xl">{copy.workspacesTitle}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9ba8bb]">{copy.workspacesCopy}</p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#ff9a69]/25 bg-[#ff9a69]/[0.07] p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-[#ff9a69]">{copy.buyer}</p>
                <p className="mt-2 text-sm font-800 text-white">{copy.marketplaceFirst}</p>
                <p className="mt-1 text-xs leading-5 text-[#9ba8bb]">{copy.buyerWorkspaceCopy}</p>
              </div>
              <div className="rounded-2xl border border-[#4fd1c5]/25 bg-[#4fd1c5]/[0.07] p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-[#8ce6dc]">{copy.seller}</p>
                <p className="mt-2 text-sm font-800 text-white">{copy.operationsFirst}</p>
                <p className="mt-1 text-xs leading-5 text-[#9ba8bb]">{copy.sellerWorkspaceCopy}</p>
              </div>
              <div className="rounded-2xl border border-[#c9a24b]/30 bg-[#c9a24b]/[0.08] p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-[#e3c179]">{copy.admin}</p>
                <p className="mt-2 text-sm font-800 text-white">{copy.controlFirst}</p>
                <p className="mt-1 text-xs leading-5 text-[#9ba8bb]">{copy.adminWorkspaceCopy}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ft-future-bento ft-reveal-group">
        <article className="ft-future-panel large ft-reveal">
          <div>
            <div className="ft-future-panel-icon"><Icon name="ArrowsRightLeftIcon" size={22} /></div>
            <p className="mt-6 text-xs font-850 uppercase tracking-[0.16em] text-orange-700">{copy.lifecycleKicker}</p>
            <h2 className="mt-3 max-w-xl text-4xl leading-tight text-slate-900">{copy.lifecycleTitle}</h2>
            <p className="mt-4 max-w-xl text-sm text-slate-600">{copy.lifecycleCopy}</p>
          </div>
          <div className="ft-future-steps">
            <div className="ft-future-step"><b>01</b><span>{copy.lifecycleStepOne}</span></div>
            <div className="ft-future-step"><b>02</b><span>{copy.lifecycleStepTwo}</span></div>
            <div className="ft-future-step"><b>03</b><span>{copy.lifecycleStepThree}</span></div>
          </div>
        </article>

        {copy.capabilities.map((item, index) => (
          <article key={item.title} className="ft-future-panel ft-reveal">
            <div className="ft-future-panel-icon"><Icon name={capabilityIcons[index] as 'SparklesIcon'} size={21} /></div>
            <h3 className="mt-5 text-xl text-slate-900">{item.title}</h3>
            <p className="mt-3 text-sm text-slate-600">{item.copy}</p>
          </article>
        ))}

        <article className="ft-future-panel ft-reveal">
          <div className="ft-future-panel-icon"><Icon name="LockClosedIcon" size={21} /></div>
          <h3 className="mt-5 text-xl text-slate-900">{copy.privateGuidanceTitle}</h3>
          <p className="mt-3 text-sm text-slate-600">{copy.privateGuidanceCopy}</p>
        </article>
      </section>

      <section id="trust" className="relative z-[2] mx-auto w-[min(1420px,calc(100%-32px))] px-4 pb-24 sm:px-0">
        <div className="ft-reveal rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_590px] lg:items-end">
            <div className="min-w-0">
              <p className="text-xs font-850 uppercase tracking-[0.16em] text-[#ff9a69]">{copy.trustKicker}</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-850 tracking-[-0.035em] text-white sm:text-4xl">{copy.trustTitle}</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#9ba8bb]">{copy.trustCopy}</p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3">
              {copy.trustItems.map((item, index) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <Icon name={trustIcons[index]} size={19} className="text-[#ff9a69]" />
                  <p className="mt-3 text-sm font-800 text-white">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-[#9ba8bb]">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="ft-future-footer">
        <div className="mx-auto flex max-w-[1420px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <AppLogo size={28} />
            <span className="font-850 text-white">FabricTrad</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#9ba8bb]" aria-label="Footer navigation">
            <Link href="/how-to-use/start" className="hover:text-white">{copy.footerHowToUse}</Link>
            <Link href="/help" className="hover:text-white">{copy.footerHelp}</Link>
            <Link href="/custom-order" className="hover:text-white">{t('nav.customOrder')}</Link>
            <Link href="/privacy" className="hover:text-white">{copy.footerPrivacy}</Link>
            <Link href="/terms" className="hover:text-white">{copy.footerTerms}</Link>
            <Link href="/login" className="font-800 text-[#ff9a69] hover:text-[#ffb28a]">{copy.signIn}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
