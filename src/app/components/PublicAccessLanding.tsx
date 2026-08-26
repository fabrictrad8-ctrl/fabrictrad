'use client';

import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import PreferenceControls from '@/components/PreferenceControls';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import { getPublicLandingCopy } from '@/lib/publicLandingTranslations';

const capabilityIcons = ['MagnifyingGlassIcon', 'BuildingStorefrontIcon', 'SparklesIcon'] as const;
const trustIcons = ['ShieldCheckIcon', 'CreditCardIcon', 'TruckIcon'] as const;

export default function PublicAccessLanding() {
  const { language } = useAppPreferences();
  const copy = getPublicLandingCopy(language);

  return (
    <main id="main-content" className="ft-future-landing min-h-screen overflow-hidden text-slate-900">
      <header className="ft-future-topbar">
        <div className="ft-future-nav">
          <Link href="/" className="ft-future-brand" aria-label="FabricTrad home">
            <AppLogo size={34} />
            <span>FabricTrad</span>
          </Link>

          <nav className="ft-future-navlinks" aria-label="Public navigation">
            <a href="#platform">{copy.navPlatform}</a>
            <a href="#capabilities">{copy.navCapabilities}</a>
            <Link href="/how-to-use/start">{copy.navHowToUse}</Link>
            <a href="#trust">{copy.navTrust}</a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <PreferenceControls compact />
            <Link href="/login" className="ft-secondary-action inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-800">
              {copy.signIn}
            </Link>
            <Link href="/register" className="ft-primary-action inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-800">
              {copy.joinFabricTrad} <Icon name="ArrowRightIcon" size={15} />
            </Link>
          </div>
        </div>
      </header>

      <section id="platform" className="ft-future-hero">
        <div className="relative z-10">
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

        <div className="ft-future-orbit" aria-hidden="true">
          <div className="ft-future-core">
            <div className="ft-future-core-inner" />
          </div>
          <div className="ft-future-float-card c1">
            <strong><span className="dot" />{copy.buyerMarketplace}</strong>
            <p>{copy.buyerMarketplaceCopy}</p>
          </div>
          <div className="ft-future-float-card c2">
            <strong><span className="dot" />{copy.sellerOperations}</strong>
            <p>{copy.sellerOperationsCopy}</p>
          </div>
          <div className="ft-future-float-card c3">
            <strong><span className="dot" />{copy.aiVirtualDrape}</strong>
            <p>{copy.aiVirtualDrapeCopy}</p>
          </div>
        </div>
      </section>

      <section id="capabilities" className="relative z-[2] mx-auto w-[min(1420px,calc(100%-32px))] px-4 pb-8 sm:px-0">
        <div className="rounded-[30px] border border-slate-200 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-850 uppercase tracking-[0.16em] text-orange-700">{copy.workspacesKicker}</p>
              <h2 className="mt-3 text-3xl font-850 tracking-[-0.04em] text-slate-900 sm:text-5xl">{copy.workspacesTitle}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{copy.workspacesCopy}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-orange-700">{copy.buyer}</p>
                <p className="mt-2 text-sm font-800 text-slate-900">{copy.marketplaceFirst}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{copy.buyerWorkspaceCopy}</p>
              </div>
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-teal-700">{copy.seller}</p>
                <p className="mt-2 text-sm font-800 text-slate-900">{copy.operationsFirst}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{copy.sellerWorkspaceCopy}</p>
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-xs font-850 uppercase tracking-wider text-violet-700">{copy.admin}</p>
                <p className="mt-2 text-sm font-800 text-slate-900">{copy.controlFirst}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{copy.adminWorkspaceCopy}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ft-future-bento">
        <article className="ft-future-panel large">
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
          <article key={item.title} className="ft-future-panel">
            <div className="ft-future-panel-icon"><Icon name={capabilityIcons[index] as 'SparklesIcon'} size={21} /></div>
            <h3 className="mt-5 text-xl text-slate-900">{item.title}</h3>
            <p className="mt-3 text-sm text-slate-600">{item.copy}</p>
          </article>
        ))}

        <article className="ft-future-panel">
          <div className="ft-future-panel-icon"><Icon name="LockClosedIcon" size={21} /></div>
          <h3 className="mt-5 text-xl text-slate-900">{copy.privateGuidanceTitle}</h3>
          <p className="mt-3 text-sm text-slate-600">{copy.privateGuidanceCopy}</p>
        </article>
      </section>

      <section id="trust" className="relative z-[2] mx-auto w-[min(1420px,calc(100%-32px))] px-4 pb-24 sm:px-0">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-850 uppercase tracking-[0.16em] text-orange-700">{copy.trustKicker}</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-850 tracking-[-0.035em] text-slate-900 sm:text-4xl">{copy.trustTitle}</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{copy.trustCopy}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[590px]">
              {copy.trustItems.map((item, index) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <Icon name={trustIcons[index]} size={19} className="text-orange-600" />
                  <p className="mt-3 text-sm font-800 text-slate-900">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{item.copy}</p>
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
            <span className="font-850 text-slate-900">FabricTrad</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600" aria-label="Footer navigation">
            <Link href="/how-to-use/start" className="hover:text-slate-950">{copy.footerHowToUse}</Link>
            <Link href="/help" className="hover:text-slate-950">{copy.footerHelp}</Link>
            <Link href="/privacy" className="hover:text-slate-950">{copy.footerPrivacy}</Link>
            <Link href="/terms" className="hover:text-slate-950">{copy.footerTerms}</Link>
            <Link href="/login" className="font-800 text-orange-700 hover:text-orange-900">{copy.signIn}</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
