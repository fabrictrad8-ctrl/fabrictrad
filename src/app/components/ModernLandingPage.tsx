'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAppPreferences } from '@/contexts/AppPreferencesContext';

const swatches = [
  {
    id: 'net',
    label: 'Embroidered net',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1000&q=88',
  },
  {
    id: 'silk',
    label: 'Banarasi silk',
    image: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1000&q=88',
  },
  {
    id: 'cotton',
    label: 'Printed cotton',
    image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1000&q=88',
  },
];

const garments = ['Saree', 'Lehenga', 'Kurta'];

function InteractiveDrapePreview() {
  const { t } = useAppPreferences();
  const [swatch, setSwatch] = useState(swatches[0]);
  const [garment, setGarment] = useState(garments[0]);
  const [split, setSplit] = useState(62);
  const [photo, setPhoto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const model = photo || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1200&q=88';

  const selectPhoto = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (photo?.startsWith('blob:')) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(file));
  };

  return (
    <section id="drape-studio" className="relative overflow-hidden border-y border-border bg-muted/40 py-20 sm:py-24">
      <div className="landing-orb absolute -left-24 top-8 h-72 w-72 rounded-full bg-primary/25" />
      <div className="landing-orb absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-secondary/20" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-800 uppercase tracking-[0.16em] text-primary">
            <Icon name="SparklesIcon" size={15} /> {t('drape.eyebrow')}
          </span>
          <h2 className="mt-5 text-balance text-4xl font-800 leading-tight text-foreground sm:text-5xl">{t('drape.title')}</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">{t('drape.description')}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {[
              ['CameraIcon', t('drape.upload')],
              ['SwatchIcon', t('drape.choose')],
              ['SparklesIcon', t('drape.preview')],
            ].map(([icon, label], index) => (
              <div key={label} className="glass-card rounded-2xl p-4">
                <Icon name={icon as 'CameraIcon'} size={19} className="mb-3 text-primary" />
                <p className="text-sm font-800 text-foreground">{index + 1}. {label}</p>
              </div>
            ))}
          </div>
          <Link href="/product-detail#drape-on" className="btn-primary mt-7 inline-flex items-center gap-2 px-6 py-3.5 text-sm">
            {t('drape.open')} <Icon name="ArrowRightIcon" size={16} />
          </Link>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-3 shadow-2xl sm:p-5">
          <div className="grid gap-4 xl:grid-cols-[150px_minmax(0,1fr)]">
            <div className="order-2 space-y-3 xl:order-1">
              <p className="text-xs font-800 uppercase tracking-wider text-muted-foreground">Fabric</p>
              <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
                {swatches.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSwatch(item)} className={`overflow-hidden rounded-xl border text-left ${swatch.id === item.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                    <div className="h-14 bg-cover bg-center" style={{ backgroundImage: `url(${item.image})` }} />
                    <p className="truncate px-2 py-1.5 text-xs font-700 text-foreground">{item.label}</p>
                  </button>
                ))}
              </div>
              <p className="pt-1 text-xs font-800 uppercase tracking-wider text-muted-foreground">Garment</p>
              <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
                {garments.map((item) => (
                  <button key={item} type="button" onClick={() => setGarment(item)} className={`rounded-xl border px-3 py-2 text-xs font-800 ${garment === item ? 'border-secondary bg-secondary text-white' : 'border-border text-foreground'}`}>{item}</button>
                ))}
              </div>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => selectPhoto(event.target.files?.[0])} />
              <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary flex w-full items-center justify-center gap-2 px-3 py-2.5 text-xs">
                <Icon name="ArrowUpTrayIcon" size={15} /> {t('drape.upload')}
              </button>
            </div>

            <div className="order-1 xl:order-2">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
                <AppImage src={model} alt="Fabric drape model preview" fill className="object-cover" />
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${split}%` }}>
                  <div className="absolute inset-0 min-w-[430px] sm:min-w-[540px] xl:min-w-[580px]">
                    <AppImage src={model} alt="Interactive draped preview" fill className="object-cover" />
                    <div className="absolute inset-0 opacity-70 mix-blend-multiply dark:mix-blend-screen" style={{ backgroundImage: `url(${swatch.image})`, backgroundSize: garment === 'Saree' ? '190% auto' : garment === 'Lehenga' ? '150% auto' : '120% auto', backgroundPosition: 'center' }} />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-secondary/25" />
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-xl" style={{ left: `${split}%` }}>
                  <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-primary text-white shadow-xl">
                    <Icon name="ArrowsRightLeftIcon" size={16} />
                  </div>
                </div>
                <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-700 text-white">{t('drape.after')}</span>
                <span className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-700 text-white">{t('drape.before')}</span>
                <input aria-label="Compare original and draped preview" type="range" min="10" max="90" value={split} onChange={(event) => setSplit(Number(event.target.value))} className="absolute inset-x-4 bottom-4 z-10 accent-primary" />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                <div><p className="text-xs font-800 text-foreground">{swatch.label} · {garment}</p><p className="text-xs text-muted-foreground">Interactive preview before secure AI generation</p></div>
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-800 text-success">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ModernLandingPage() {
  const { t } = useAppPreferences();
  const metrics = [
    ['ShieldCheckIcon', '1,200+', t('hero.verified')],
    ['SwatchIcon', '18,000+', t('hero.products')],
    ['MapPinIcon', '36', t('hero.states')],
    ['LanguageIcon', '10', t('hero.support')],
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <Header />
      <section className="relative flex min-h-[760px] items-center overflow-hidden px-4 pb-20 pt-28 sm:px-6 lg:min-h-screen lg:pt-24">
        <div className="hero-grid absolute inset-0" />
        <div className="landing-orb absolute -left-36 top-10 h-[30rem] w-[30rem] rounded-full bg-primary/20" />
        <div className="landing-orb absolute -right-44 top-10 h-[34rem] w-[34rem] rounded-full bg-secondary/20" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-xs font-800 uppercase tracking-[0.16em] text-success">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>
              {t('hero.eyebrow')}
            </div>
            <h1 className="mt-7 max-w-4xl text-balance text-5xl font-800 leading-[0.98] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
              {t('hero.titleStart')} <span className="bg-gradient-to-r from-primary via-saffron-light to-gold bg-clip-text text-transparent">{t('hero.titleAccent')}</span> {t('hero.titleEnd')}
            </h1>
            <p className="mt-7 max-w-2xl text-base font-500 leading-7 text-muted-foreground sm:text-lg sm:leading-8">{t('hero.description')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/marketplace" className="btn-primary inline-flex items-center justify-center gap-2 px-7 py-4 text-sm">{t('hero.explore')} <Icon name="ArrowRightIcon" size={17} /></Link>
              <a href="#drape-studio" className="btn-secondary inline-flex items-center justify-center gap-2 px-7 py-4 text-sm"><Icon name="SparklesIcon" size={17} /> {t('hero.tryDrape')}</a>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-800">
              <Link href="/buyer-registration" className="text-foreground underline decoration-primary/40 underline-offset-4 hover:text-primary">{t('hero.buyer')}</Link><span className="text-border">•</span><Link href="/seller-registration" className="text-foreground underline decoration-primary/40 underline-offset-4 hover:text-primary">{t('hero.seller')}</Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px] animate-slide-in-right">
            <div className="glass-card relative rounded-[2rem] p-3 shadow-2xl sm:p-4">
              <div className="relative aspect-[5/4] overflow-hidden rounded-[1.5rem]">
                <AppImage src="https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1400&q=88" alt="Textile sourcing and apparel" fill className="object-cover" priority />
                <div className="absolute inset-0 bg-gradient-to-tr from-secondary/65 via-transparent to-primary/25" />
                <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-black/30 px-3 py-1.5 text-xs font-800 text-white backdrop-blur">Live B2B workflow</div>
                <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2 sm:bottom-6 sm:left-6 sm:right-6">
                  {[['CheckBadgeIcon','Verified seller'],['SparklesIcon','AI drape'],['TruckIcon','Live tracking']].map(([icon,label]) => (
                    <div key={label} className="rounded-2xl border border-white/25 bg-black/35 p-3 text-white backdrop-blur-md"><Icon name={icon as 'TruckIcon'} size={18} className="mb-2 text-gold" /><p className="text-xs font-800 sm:text-sm">{label}</p></div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-card px-4 py-3"><p className="text-xs font-700 text-muted-foreground"><span className="font-800 text-foreground">Trusted across textile hubs</span><br />Surat · Mumbai · Tiruppur · Jaipur</p><Icon name="ShieldCheckIcon" size={26} className="text-success" /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card py-6"><div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 sm:px-6 lg:grid-cols-4">{metrics.map(([icon,value,label]) => <div key={label} className="flex items-center gap-3 rounded-2xl p-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name={icon as 'ShieldCheckIcon'} size={21} /></div><div><p className="text-xl font-800 text-foreground">{value}</p><p className="text-xs font-600 text-muted-foreground">{label}</p></div></div>)}</div></section>

      <InteractiveDrapePreview />

      <section className="py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="mx-auto max-w-3xl text-center"><p className="text-xs font-800 uppercase tracking-[0.18em] text-primary">{t('how.eyebrow')}</p><h2 className="mt-4 text-balance text-4xl font-800 tracking-tight text-foreground sm:text-5xl">{t('how.title')}</h2></div><div className="mt-12 grid gap-5 md:grid-cols-3">{[["MagnifyingGlassIcon",t('how.one.title'),t('how.one.copy')],["ChatBubbleLeftRightIcon",t('how.two.title'),t('how.two.copy')],["TruckIcon",t('how.three.title'),t('how.three.copy')]].map(([icon,title,copy],index) => <div key={title} className="relative rounded-3xl border border-border bg-card p-7 card-shadow transition hover:-translate-y-1 hover:card-shadow-hover"><span className="absolute right-5 top-4 text-5xl font-800 text-muted">0{index+1}</span><div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name={icon as 'TruckIcon'} size={23} /></div><h3 className="relative mt-6 text-xl font-800 text-foreground">{title}</h3><p className="relative mt-3 text-sm leading-6 text-muted-foreground">{copy}</p></div>)}</div></div></section>

      <section className="bg-secondary py-20 text-white sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6"><h2 className="max-w-3xl text-balance text-4xl font-800 tracking-tight sm:text-5xl">{t('roles.title')}</h2><div className="mt-10 grid gap-5 lg:grid-cols-2">{[
        {icon:'BuildingOffice2Icon',title:t('roles.buyerTitle'),copy:t('roles.buyerCopy'),href:'/buyer-registration',cta:t('roles.joinBuyer'),features:['Multi-filter marketplace','Wishlist and comparisons','Pending orders and tracking','AI fabric drape']},
        {icon:'BuildingStorefrontIcon',title:t('roles.sellerTitle'),copy:t('roles.sellerCopy'),href:'/seller-registration',cta:t('roles.joinSeller'),features:['Add and update products','Inventory and stock alerts','Order fulfilment','Billing document upload']},
      ].map((role,index) => <div key={role.title} className={`rounded-[2rem] border p-7 sm:p-9 ${index===0?'border-white/20 bg-white/10':'border-primary/40 bg-primary/20'}`}><Icon name={role.icon as 'BuildingStorefrontIcon'} size={26} className="text-gold" /><h3 className="mt-6 text-2xl font-800">{role.title}</h3><p className="mt-3 text-sm leading-6 text-white/75">{role.copy}</p><div className="mt-6 grid gap-2 sm:grid-cols-2">{role.features.map((feature) => <div key={feature} className="flex items-center gap-2 text-sm font-700"><Icon name="CheckCircleIcon" size={16} className="text-gold" />{feature}</div>)}</div><Link href={role.href} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-800 text-secondary">{role.cta}<Icon name="ArrowRightIcon" size={16} /></Link></div>)}</div></div></section>

      <section className="py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="rounded-[2rem] border border-border bg-card p-7 card-shadow-lg sm:p-10"><div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center"><div><p className="text-xs font-800 uppercase tracking-[0.18em] text-primary">Safety by design</p><h2 className="mt-4 text-4xl font-800 text-foreground">{t('trust.title')}</h2></div><div className="grid gap-3 sm:grid-cols-2">{[["IdentificationIcon",t('trust.gst')],["CreditCardIcon",t('trust.payment')],["TruckIcon",t('trust.shipping')],["LockClosedIcon",t('trust.privacy')]].map(([icon,label]) => <div key={label} className="flex items-center gap-3 rounded-2xl bg-muted p-4"><Icon name={icon as 'TruckIcon'} size={20} className="text-success" /><span className="text-sm font-800 text-foreground">{label}</span></div>)}</div></div></div><div className="mt-8 rounded-[2rem] bg-gradient-to-r from-primary via-saffron-light to-gold p-8 text-white sm:p-12"><div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-3xl font-800 sm:text-4xl">{t('cta.title')}</h2><p className="mt-3 max-w-2xl text-white/85">{t('cta.copy')}</p></div><div className="flex flex-col gap-3 sm:flex-row"><Link href="/register" className="rounded-xl bg-white px-6 py-3.5 text-center text-sm font-800 text-primary">{t('nav.createAccount')}</Link><Link href="/marketplace" className="rounded-xl border border-white/40 px-6 py-3.5 text-center text-sm font-800 text-white">{t('hero.explore')}</Link></div></div></div></div></section>
      <Footer />
    </main>
  );
}
