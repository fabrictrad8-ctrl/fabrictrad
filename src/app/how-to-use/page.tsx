'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';
import { getHowToUseCopy, type GuideRole, type LocalizedGuideStep } from '@/lib/howToUseTranslations';

function DemoFrame({ role, step, copy }: { role: GuideRole; step: LocalizedGuideStep; copy: ReturnType<typeof getHowToUseCopy>['guide'] }) {
  const accent = role === 'buyer' ? 'text-orange-700 bg-orange-50 border-orange-200' : 'text-teal-700 bg-teal-50 border-teal-200';
  const sidebar = role === 'buyer' ? copy.buyerSidebar : copy.sellerSidebar;

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <div className="ml-3 h-7 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] leading-7 text-slate-400">fabrictrad.com · {copy.interactivePreview}</div>
      </div>

      <div className="grid min-h-[360px] gap-0 md:grid-cols-[190px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-slate-950 p-4 text-white md:block">
          <p className="text-xs font-850 uppercase tracking-[0.16em] text-white/50">{role === 'buyer' ? copy.buyer : copy.seller} {copy.view}</p>
          <div className="mt-5 space-y-2">
            {sidebar.map((item, index) => (
              <div key={item} className={`rounded-xl px-3 py-2.5 text-xs font-750 ${index === 0 ? 'bg-white/12 text-white' : 'text-white/55'}`}>{item}</div>
            ))}
          </div>
        </aside>

        <div className="p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-850 uppercase tracking-[0.15em] text-slate-400">{copy.liveInteractionPreview}</p>
              <p className="mt-1 text-sm font-850 text-slate-900">{step.title}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-850 ${accent}`}>{copy.noLiveData}</span>
          </div>

          {(step.screen === 'account' || step.screen === 'verify') && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`rounded-2xl border p-5 ${accent}`}>
                <Icon name={role === 'buyer' ? 'ShoppingBagIcon' : 'BuildingStorefrontIcon'} size={24} />
                <p className="mt-4 text-sm font-850">{role === 'buyer' ? copy.buyOnFabricTrad : copy.sellOnFabricTrad}</p>
                <p className="mt-2 text-xs leading-5 opacity-80">{copy.roleAwareSetup}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="space-y-3">
                  <div className="h-9 rounded-xl bg-slate-100" />
                  <div className="h-9 rounded-xl bg-slate-100" />
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-750 text-emerald-700">
                    <Icon name="ShieldCheckIcon" size={16} /> {copy.verificationShown}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step.screen === 'discover' && (
            <div>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Icon name="MagnifyingGlassIcon" size={17} className="text-slate-400" />
                <span className="text-xs text-slate-400">{copy.searchPlaceholder}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr]">
                <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
                  {copy.filters.map((item) => <div key={item} className="rounded-lg bg-slate-100 px-2 py-2 text-[11px] font-750 text-slate-500">{item}</div>)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((item) => <div key={item} className="rounded-2xl border border-slate-200 p-3"><div className="aspect-[4/3] rounded-xl bg-slate-100" /><div className="mt-3 h-2.5 w-4/5 rounded bg-slate-200" /><div className="mt-2 h-2.5 w-2/5 rounded bg-slate-100" /></div>)}
                </div>
              </div>
            </div>
          )}

          {step.screen === 'product' && (
            <div className="grid gap-4 sm:grid-cols-[1fr_1.05fr]">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 p-4"><div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs font-750 text-slate-400">{copy.sellerProvidedMedia}</div></div>
              <div>
                <div className="h-3 w-4/5 rounded bg-slate-200" /><div className="mt-3 h-2.5 w-2/3 rounded bg-slate-100" />
                <div className="mt-5 grid grid-cols-2 gap-2">{copy.productFacts.map((item) => <div key={item} className="rounded-xl border border-slate-200 p-3 text-xs font-750 text-slate-600">{item}</div>)}</div>
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs font-750 text-violet-700"><Icon name="SparklesIcon" size={16} className="mr-1 inline" />{copy.drapeSupported}</div>
              </div>
            </div>
          )}

          {(step.screen === 'catalogue' || step.screen === 'inventory') && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="h-3 w-32 rounded bg-slate-200" /><div className="mt-2 h-2.5 w-48 rounded bg-slate-100" /></div><button type="button" className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-850 text-white">{step.screen === 'catalogue' ? copy.addProduct : copy.updateStock}</button></div>
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[1.4fr_.7fr_.7fr_.7fr] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-850 uppercase tracking-wider text-slate-400">{copy.tableHeaders.map((item) => <span key={item}>{item}</span>)}</div>
                {[1, 2, 3].map((item) => <div key={item} className="grid grid-cols-[1.4fr_.7fr_.7fr_.7fr] gap-2 border-t border-slate-100 px-3 py-3 text-[11px] text-slate-500"><span className="font-750">{copy.yourProduct}</span><span>—</span><span>—</span><span className="text-emerald-600">{copy.current}</span></div>)}
              </div>
            </div>
          )}

          {(step.screen === 'order' || step.screen === 'fulfilment' || step.screen === 'tracking') && (
            <div className="space-y-3">
              {[
                copy.orderCreated,
                role === 'seller' ? copy.sellerDecision : copy.sellerConfirmation,
                step.screen === 'tracking' || step.screen === 'fulfilment' ? copy.dispatchTracking : copy.nextStep,
              ].map((item, index) => (
                <div key={`${item}-${index}`} className={`flex items-center gap-3 rounded-2xl border p-4 ${index === 0 ? accent : 'border-slate-200 bg-white'}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${index === 0 ? 'bg-white/70' : 'bg-slate-100'}`}><Icon name={index === 2 ? 'TruckIcon' : 'CheckIcon'} size={16} /></div>
                  <div className="min-w-0 flex-1"><p className="text-xs font-850">{item}</p><p className="mt-1 text-[11px] opacity-70">{copy.recordCarriesStatus}</p></div>
                </div>
              ))}
            </div>
          )}

          {step.screen === 'payment' && (
            <div className="mx-auto max-w-md rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Icon name="CreditCardIcon" size={21} /></div><div><p className="text-sm font-850 text-slate-900">{copy.secureCheckout}</p><p className="text-xs text-slate-500">{copy.paymentTiedToOrder}</p></div></div>
              <div className="mt-5 space-y-2"><div className="h-10 rounded-xl bg-slate-100" /><div className="h-10 rounded-xl bg-slate-100" /><div className="h-11 rounded-xl bg-slate-950 text-center text-xs font-850 leading-[44px] text-white">{copy.continueToPayment}</div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HowToUsePage() {
  const { language } = useAppPreferences();
  const copy = getHowToUseCopy(language).guide;
  const [role, setRole] = useState<GuideRole>('buyer');
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get('role');
    if (requestedRole === 'seller' || requestedRole === 'buyer') setRole(requestedRole);
  }, []);

  const steps = useMemo(() => (role === 'buyer' ? copy.buyerSteps : copy.sellerSteps), [copy, role]);
  const step = steps[stepIndex] ?? steps[0];

  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [role, language]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [playing, steps.length]);

  const chooseRole = (nextRole: GuideRole) => {
    setRole(nextRole);
    window.history.replaceState(null, '', `/how-to-use?role=${nextRole}`);
  };

  const previous = () => setStepIndex((current) => Math.max(0, current - 1));
  const next = () => setStepIndex((current) => Math.min(steps.length - 1, current + 1));

  if (!step) return null;

  return (
    <main className="ft-storefront min-h-screen bg-slate-50">
      <Header />
      <div className="pt-16">
        <section className="border-b border-slate-200 bg-white px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-850 uppercase tracking-[0.18em] text-orange-700">{copy.eyebrow}</p>
                <h1 className="mt-3 text-4xl font-900 tracking-[-0.045em] text-slate-950 sm:text-5xl">{copy.title}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{copy.intro}</p>
              </div>
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1.5" role="tablist" aria-label={copy.chooseWalkthrough}>
                <button type="button" role="tab" aria-selected={role === 'buyer'} onClick={() => chooseRole('buyer')} className={`min-h-11 rounded-xl px-5 text-sm font-850 transition ${role === 'buyer' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><Icon name="ShoppingBagIcon" size={16} className="mr-2 inline" />{copy.buyer}</button>
                <button type="button" role="tab" aria-selected={role === 'seller'} onClick={() => chooseRole('seller')} className={`min-h-11 rounded-xl px-5 text-sm font-850 transition ${role === 'seller' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><Icon name="BuildingStorefrontIcon" size={16} className="mr-2 inline" />{copy.seller}</button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid gap-7 lg:grid-cols-[330px_1fr] lg:items-start">
            <div className="order-2 lg:order-1">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[11px] font-850 uppercase tracking-[0.15em] text-slate-400">{role === 'buyer' ? copy.buyer : copy.seller} {copy.walkthrough}</p><p className="mt-1 text-sm font-850 text-slate-900">{copy.step} {stepIndex + 1} {copy.of} {steps.length}</p></div>
                  <button type="button" onClick={() => setPlaying((current) => !current)} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-850 text-white" aria-label={playing ? copy.pauseWalkthrough : copy.playWalkthrough}><Icon name={playing ? 'PauseIcon' : 'PlayIcon'} size={15} />{playing ? copy.pause : copy.play}</button>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-500 ${role === 'buyer' ? 'bg-orange-600' : 'bg-teal-600'}`} style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} /></div>

                <div className="mt-5 space-y-1.5">
                  {steps.map((item, index) => (
                    <button key={`${item.title}-${index}`} type="button" onClick={() => { setStepIndex(index); setPlaying(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${index === stepIndex ? (role === 'buyer' ? 'bg-orange-50 text-orange-800' : 'bg-teal-50 text-teal-800') : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"><Icon name={item.icon} size={15} /></span>
                      <span className="min-w-0"><span className="block text-[11px] font-850 uppercase tracking-wider opacity-60">{copy.step} {index + 1}</span><span className="block truncate text-xs font-850">{item.title}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-1 min-w-0 lg:order-2">
              <DemoFrame role={role} step={step} copy={copy} />

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${role === 'buyer' ? 'bg-orange-50 text-orange-700' : 'bg-teal-50 text-teal-700'}`}><Icon name={step.icon} size={20} /></div>
                  <div className="min-w-0"><p className="text-lg font-900 tracking-tight text-slate-950">{step.action}</p><p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p></div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                  <button type="button" onClick={previous} disabled={stepIndex === 0} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-850 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="ChevronLeftIcon" size={16} />{copy.previous}</button>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/login" className="flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-850 text-slate-700">{copy.signIn}</Link>
                    {stepIndex < steps.length - 1 ? (
                      <button type="button" onClick={next} className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-850 text-white ${role === 'buyer' ? 'bg-orange-700' : 'bg-teal-700'}`}>{copy.nextStep}<Icon name="ChevronRightIcon" size={16} /></button>
                    ) : (
                      <Link href="/register" className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-850 text-white ${role === 'buyer' ? 'bg-orange-700' : 'bg-teal-700'}`}>{copy.createAccount}<Icon name="ArrowRightIcon" size={16} /></Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
