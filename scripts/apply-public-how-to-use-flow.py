from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, minimum: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f"{path}: expected at least {minimum} matches, found {count}: {old!r}")
    p.write_text(text.replace(old, new))


# 1) Public landing: How to use is a direct tab, not a dropdown that skips the chooser.
landing = 'src/app/components/PublicAccessLanding.tsx'
replace_once(
    landing,
    '''            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 marker:content-none">
                How to use <Icon name="ChevronDownIcon" size={13} className="transition group-open:rotate-180" />
              </summary>
              <div className="absolute left-1/2 top-[calc(100%+12px)] z-50 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
                <Link href="/how-to-use?role=buyer" className="flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-orange-50">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Icon name="ShoppingBagIcon" size={17} /></span>
                  <span><strong className="block text-xs text-slate-900">Buyer walkthrough</strong><span className="mt-0.5 block text-[11px] text-slate-500">Interactive buying flow</span></span>
                </Link>
                <Link href="/how-to-use?role=seller" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-teal-50">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon name="BuildingStorefrontIcon" size={17} /></span>
                  <span><strong className="block text-xs text-slate-900">Seller walkthrough</strong><span className="mt-0.5 block text-[11px] text-slate-500">Interactive selling flow</span></span>
                </Link>
              </div>
            </details>''',
    '''            <Link href="/how-to-use">How to use</Link>''',
)
replace_all(landing, 'href="/how-to-use?role=buyer"', 'href="/how-to-use"', minimum=2)

# 2) Global header: public visitors can always find How to use.
header = 'src/components/Header.tsx'
replace_once(
    header,
    "      { label: 'Vendors', href: '/vendors', icon: 'BuildingStorefrontIcon' },\n",
    "      { label: 'Vendors', href: '/vendors', icon: 'BuildingStorefrontIcon' },\n      { label: 'How to use', href: '/how-to-use', icon: 'PlayCircleIcon' },\n",
)

# 3) Middleware: keep the chooser and any future nested guide URLs public.
middleware = 'src/middleware.ts'
replace_once(
    middleware,
    "    if (PUBLIC_PATHS.has(pathname)) return clearStaleSupabaseCookies(request, response);\n",
    "    if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/how-to-use/')) {\n      return clearStaleSupabaseCookies(request, response);\n    }\n",
)

# 4) How-to-use page: no role selected => public Buyer/Seller chooser.
guide = 'src/app/how-to-use/page.tsx'
replace_once(
    guide,
    "  const [role, setRole] = useState<GuideRole>('buyer');\n  const [stepIndex, setStepIndex] = useState(0);\n",
    "  const [role, setRole] = useState<GuideRole>('buyer');\n  const [roleChosen, setRoleChosen] = useState(false);\n  const [stepIndex, setStepIndex] = useState(0);\n",
)
replace_once(
    guide,
    '''  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get('role');
    if (requestedRole === 'seller' || requestedRole === 'buyer') setRole(requestedRole);
  }, []);
''',
    '''  useEffect(() => {
    const syncRoleFromUrl = () => {
      const requestedRole = new URLSearchParams(window.location.search).get('role');
      if (requestedRole === 'seller' || requestedRole === 'buyer') {
        setRole(requestedRole);
        setRoleChosen(true);
      } else {
        setRoleChosen(false);
        setPlaying(false);
        setStepIndex(0);
      }
    };

    syncRoleFromUrl();
    window.addEventListener('popstate', syncRoleFromUrl);
    return () => window.removeEventListener('popstate', syncRoleFromUrl);
  }, []);
''',
)
replace_once(
    guide,
    '''  const chooseRole = (nextRole: GuideRole) => {
    setRole(nextRole);
    window.history.replaceState(null, '', `/how-to-use?role=${nextRole}`);
  };

  const previous = () => setStepIndex((current) => Math.max(0, current - 1));
  const next = () => setStepIndex((current) => Math.min(steps.length - 1, current + 1));

  return (
''',
    '''  const chooseRole = (nextRole: GuideRole) => {
    setRole(nextRole);
    setRoleChosen(true);
    setStepIndex(0);
    setPlaying(false);
    window.history.pushState(null, '', `/how-to-use?role=${nextRole}`);
  };

  const backToChooser = () => {
    setRoleChosen(false);
    setPlaying(false);
    setStepIndex(0);
    window.history.pushState(null, '', '/how-to-use');
  };

  const previous = () => setStepIndex((current) => Math.max(0, current - 1));
  const next = () => setStepIndex((current) => Math.min(steps.length - 1, current + 1));

  if (!roleChosen) {
    return (
      <main className="ft-storefront min-h-screen bg-slate-50">
        <Header />
        <div className="pt-16">
          <section className="border-b border-slate-200 bg-white px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="mx-auto max-w-5xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-850 text-emerald-700">
                <Icon name="LockOpenIcon" size={15} /> Public guides · no sign-in required
              </div>
              <p className="mt-6 text-xs font-850 uppercase tracking-[0.18em] text-orange-700">How to use FabricTrad</p>
              <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-900 tracking-[-0.045em] text-slate-950 sm:text-5xl">Which FabricTrad guide do you want to watch?</h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">Choose Buyer or Seller. You can watch the guided walkthrough and move through every instruction screen without creating an account or signing in.</p>
            </div>
          </section>

          <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <div className="grid gap-5 md:grid-cols-2">
              <button type="button" onClick={() => chooseRole('buyer')} className="group rounded-[28px] border border-orange-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_24px_70px_rgba(194,65,12,0.12)] sm:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-700"><Icon name="ShoppingBagIcon" size={27} /></div>
                <p className="mt-6 text-xs font-850 uppercase tracking-[0.16em] text-orange-700">For buyers</p>
                <h2 className="mt-2 text-2xl font-900 tracking-tight text-slate-950">How to buy on FabricTrad</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">See how to set up buying, search fabrics, inspect listings, place an order, pay securely and track fulfilment.</p>
                <div className="mt-6 space-y-2 text-sm text-slate-700">
                  <span className="flex items-center gap-2"><Icon name="CheckCircleIcon" size={17} className="text-orange-600" />Search and compare products</span>
                  <span className="flex items-center gap-2"><Icon name="CheckCircleIcon" size={17} className="text-orange-600" />Order and payment flow</span>
                  <span className="flex items-center gap-2"><Icon name="CheckCircleIcon" size={17} className="text-orange-600" />Shipment tracking</span>
                </div>
                <span className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-700 px-4 text-sm font-850 text-white">Watch buyer guide <Icon name="ArrowRightIcon" size={16} /></span>
              </button>

              <button type="button" onClick={() => chooseRole('seller')} className="group rounded-[28px] border border-teal-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_24px_70px_rgba(13,148,136,0.12)] sm:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Icon name="BuildingStorefrontIcon" size={27} /></div>
                <p className="mt-6 text-xs font-850 uppercase tracking-[0.16em] text-teal-700">For sellers</p>
                <h2 className="mt-2 text-2xl font-900 tracking-tight text-slate-950">How to sell on FabricTrad</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">See how seller activation, verification, catalogue creation, inventory, incoming orders and fulfilment work.</p>
                <div className="mt-6 space-y-2 text-sm text-slate-700">
                  <span className="flex items-center gap-2"><Icon name="CheckCircleIcon" size={17} className="text-teal-600" />Business and GST verification</span>
                  <span className="flex items-center gap-2"><Icon name="CheckCircleIcon" size={17} className="text-teal-600" />Products and inventory</span>
                  <span className="flex items-center gap-2"><Icon name="CheckCircleIcon" size={17} className="text-teal-600" />Orders and fulfilment</span>
                </div>
                <span className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-850 text-white">Watch seller guide <Icon name="ArrowRightIcon" size={16} /></span>
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Icon name="EyeIcon" size={15} />No account data is loaded</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <span className="inline-flex items-center gap-1.5"><Icon name="ShieldCheckIcon" size={15} />Safe public preview</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <Link href="/help" className="font-800 text-orange-700 hover:text-orange-900">Open help centre</Link>
            </div>
          </section>
        </div>
        <Footer />
      </main>
    );
  }

  return (
''',
)
replace_once(
    guide,
    '''              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1.5" role="tablist" aria-label="Choose walkthrough">
                <button type="button" role="tab" aria-selected={role === 'buyer'} onClick={() => chooseRole('buyer')} className={`min-h-11 rounded-xl px-5 text-sm font-850 transition ${role === 'buyer' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><Icon name="ShoppingBagIcon" size={16} className="mr-2 inline" />Buyer</button>
                <button type="button" role="tab" aria-selected={role === 'seller'} onClick={() => chooseRole('seller')} className={`min-h-11 rounded-xl px-5 text-sm font-850 transition ${role === 'seller' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><Icon name="BuildingStorefrontIcon" size={16} className="mr-2 inline" />Seller</button>
              </div>''',
    '''              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={backToChooser} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-850 text-slate-600 hover:bg-slate-50"><Icon name="Squares2X2Icon" size={16} className="mr-2 inline" />All guides</button>
                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1.5" role="tablist" aria-label="Choose walkthrough">
                  <button type="button" role="tab" aria-selected={role === 'buyer'} onClick={() => chooseRole('buyer')} className={`min-h-11 rounded-xl px-5 text-sm font-850 transition ${role === 'buyer' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><Icon name="ShoppingBagIcon" size={16} className="mr-2 inline" />Buyer</button>
                  <button type="button" role="tab" aria-selected={role === 'seller'} onClick={() => chooseRole('seller')} className={`min-h-11 rounded-xl px-5 text-sm font-850 transition ${role === 'seller' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}><Icon name="BuildingStorefrontIcon" size={16} className="mr-2 inline" />Seller</button>
                </div>
              </div>''',
)

print('Public How to use chooser and guest access patch applied.')
