import { readFile, writeFile } from 'node:fs/promises';

async function replace(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Expected block not found in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(path, source.replace(before, after));
}

async function replaceAll(path, pairs) {
  let source = await readFile(path, 'utf8');
  for (const [before, after] of pairs) {
    if (!source.includes(before)) {
      throw new Error(`Expected block not found in ${path}: ${before.slice(0, 120)}`);
    }
    source = source.replace(before, after);
  }
  await writeFile(path, source);
}

async function replaceRegex(path, pattern, after) {
  const source = await readFile(path, 'utf8');
  if (!pattern.test(source)) throw new Error(`Expected pattern not found in ${path}: ${pattern}`);
  await writeFile(path, source.replace(pattern, after));
}

// Fix migration aliases before it is validated or applied.
await replaceAll('supabase/migrations/20260730220000_unified_commerce_accounts.sql', [
  ['  business_name TEXT;\nBEGIN', '  v_business_name TEXT;\nBEGIN'],
  ["  business_name := COALESCE(NULLIF(trim(p_payload->>'businessName'), ''), NULLIF(trim(p_payload->>'ownerName'), ''), 'FabricTrad Seller');", "  v_business_name := COALESCE(NULLIF(trim(p_payload->>'businessName'), ''), NULLIF(trim(p_payload->>'ownerName'), ''), 'FabricTrad Seller');"],
  ['      business_name = business_name,', '      business_name = v_business_name,'],
  ["    business_name,\n    COALESCE(NULLIF(trim(p_payload->>'businessType'), ''), 'Business buyer'),", "    v_business_name,\n    COALESCE(NULLIF(trim(p_payload->>'businessType'), ''), 'Business buyer'),"],
  ['    business_name,\n    business_name,\n    NULLIF(trim(p_payload->>\'businessType\'), \'\'),', '    v_business_name,\n    v_business_name,\n    NULLIF(trim(p_payload->>\'businessType\'), \'\'),'],
  ['    business_name,\n    NULLIF(trim(p_payload->>\'businessType\'), \'\'),\n    NULLIF(trim(p_payload->>\'city\'), \'\'),', '    v_business_name,\n    NULLIF(trim(p_payload->>\'businessType\'), \'\'),\n    NULLIF(trim(p_payload->>\'city\'), \'\'),'],
  ['WHERE seller.id = seller_id AND seller.is_active = TRUE', 'WHERE seller.id = seller_products.seller_id AND seller.is_active = TRUE'],
  ['WHERE product.id = product_id AND product.seller_id = seller_id\n        AND product.status', 'WHERE product.id = seller_product_variants.product_id AND product.seller_id = seller_product_variants.seller_id\n        AND product.status'],
  ['WHERE product.id = product_id AND product.seller_id = seller_id\n      AND product.status', 'WHERE product.id = seller_product_media.product_id AND product.seller_id = seller_product_media.seller_id\n      AND product.status'],
  ['WHERE product.id = product_id AND product.seller_id = seller_id\n        AND product.status = \'active\'', 'WHERE product.id = catalog_order_requests.product_id AND product.seller_id = catalog_order_requests.seller_id\n        AND product.status = \'active\''],
  ["AND (product.sale_channel IN ('retail','both') OR quantity >= product.moq)\n        AND quantity <=", "AND (product.sale_channel IN ('retail','both') OR catalog_order_requests.quantity >= product.moq)\n        AND catalog_order_requests.quantity <="],
  ['WHERE product.id = product_id AND product.seller_id = seller_id)', 'WHERE product.id = seller_product_variants.product_id AND product.seller_id = seller_product_variants.seller_id)'],
]);

// Capability fields are authoritative; the old role remains only for compatibility.
await replaceAll('src/contexts/AuthContext.tsx', [
  ["  is_active: boolean;\n  avatar_url: string | null;", "  is_active: boolean;\n  can_buy?: boolean;\n  can_sell?: boolean;\n  account_kind?: 'individual' | 'business';\n  verification_method?: 'none' | 'pan' | 'aadhaar_offline' | 'gstin';\n  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';\n  identity_reference_last4?: string | null;\n  avatar_url: string | null;"],
  ["      is_active: true,\n      avatar_url: null,\n      business_name: 'Demo Buyer Textiles',", "      is_active: true,\n      can_buy: true,\n      can_sell: false,\n      account_kind: 'individual',\n      verification_method: 'pan',\n      verification_status: 'verified',\n      avatar_url: null,\n      business_name: 'Demo Buyer Textiles',"],
  ["      is_active: true,\n      avatar_url: null,\n      business_name: 'FabricTrad Demo Textiles',", "      is_active: true,\n      can_buy: true,\n      can_sell: true,\n      account_kind: 'business',\n      verification_method: 'gstin',\n      verification_status: 'verified',\n      avatar_url: null,\n      business_name: 'FabricTrad Demo Textiles',"],
  ["          monthly_capacity: metadata?.monthlyCapacity || '',\n          registration_nonce: registrationNonce,", "          monthly_capacity: metadata?.monthlyCapacity || '',\n          verification_method: metadata?.verificationMethod || (metadata?.role === 'seller' ? 'gstin' : 'none'),\n          identity_reference_last4: metadata?.identityReferenceLast4 || '',\n          registration_nonce: registrationNonce,"],
]);

await writeFile('src/lib/accountProvisioning.ts', `import type { SupabaseClient, User } from '@supabase/supabase-js';

export type AccountRole = 'buyer' | 'seller' | 'admin_staff' | 'super_admin';

export type ProvisionedAccount = {
  role: AccountRole;
  userProfileId: string;
  buyerProfileId: string | null;
  sellerProfileId: string | null;
  canBuy: boolean;
  canSell: boolean;
};

type UserProfileRow = {
  id: string;
  role: AccountRole | null;
  is_active: boolean | null;
  can_buy?: boolean | null;
  can_sell?: boolean | null;
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const nullableText = (value: unknown) => text(value) || null;

const roleFromUser = (user: User): 'buyer' | 'seller' => {
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  return appRole === 'seller' || userRole === 'seller' ? 'seller' : 'buyer';
};

const accountReference = (prefix: 'BYR' | 'SLR', userId: string) =>
  \`FT-\${prefix}-\${userId.replaceAll('-', '').slice(0, 12).toUpperCase()}\`;

const addressFromMetadata = (metadata: Record<string, unknown>) => {
  const address = {
    line1: nullableText(metadata.address_line1),
    line2: nullableText(metadata.address_line2),
    city: nullableText(metadata.city),
    state: nullableText(metadata.state),
    pincode: nullableText(metadata.pincode),
    country: 'India',
  };
  return Object.values(address).some((value) => value && value !== 'India') ? address : null;
};

export async function ensureAccountProvisioned(
  client: SupabaseClient,
  user: User
): Promise<ProvisionedAccount> {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const requestedRole = roleFromUser(user);
  const email = text(user.email).toLowerCase();
  if (!email) throw new Error('The authenticated account does not have an email address.');

  const { data: existingProfile, error: profileReadError } = await client
    .from('user_profiles')
    .select('id,role,is_active,can_buy,can_sell')
    .eq('id', user.id)
    .maybeSingle();
  if (profileReadError) throw profileReadError;

  const existing = existingProfile as UserProfileRow | null;
  const existingRole = existing?.role;
  const role: AccountRole =
    existingRole === 'seller' || existingRole === 'buyer' ||
    existingRole === 'admin_staff' || existingRole === 'super_admin'
      ? existingRole
      : requestedRole;
  const isAdmin = role === 'admin_staff' || role === 'super_admin';
  const requestedSeller = requestedRole === 'seller' || Boolean(text(metadata.gstin));
  const canBuy = !isAdmin && (existing?.can_buy ?? true);
  const canSell = !isAdmin && Boolean(existing?.can_sell || requestedSeller);

  const userProfilePayload = {
    id: user.id,
    email,
    full_name: text(metadata.full_name) || email.split('@')[0],
    avatar_url: nullableText(metadata.avatar_url),
    phone: nullableText(metadata.phone),
    role,
    business_name: nullableText(metadata.business_name),
    gstin: nullableText(metadata.gstin)?.toUpperCase() || null,
    address_line1: nullableText(metadata.address_line1),
    address_line2: nullableText(metadata.address_line2),
    city: nullableText(metadata.city),
    state: nullableText(metadata.state),
    pincode: nullableText(metadata.pincode),
    preferred_language: text(metadata.preferred_language) || 'en',
    preferred_theme: text(metadata.preferred_theme) || 'system',
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await client.from('user_profiles').update(userProfilePayload).eq('id', user.id);
    if (error) throw error;
  } else {
    const { error } = await client.from('user_profiles').insert({
      ...userProfilePayload,
      can_buy: canBuy,
      can_sell: canSell,
      account_kind: canSell ? 'business' : 'individual',
      verification_method: canSell ? 'gstin' : text(metadata.verification_method) || 'none',
      verification_status: canSell || text(metadata.verification_method) ? 'pending' : 'unverified',
      identity_reference_last4: nullableText(metadata.identity_reference_last4),
      is_active: true,
    });
    if (error) throw error;
  }

  if (isAdmin) {
    return { role, userProfileId: user.id, buyerProfileId: null, sellerProfileId: null, canBuy: false, canSell: false };
  }

  const { data: existingBuyer, error: buyerReadError } = await client
    .from('buyer_profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (buyerReadError) throw buyerReadError;
  const buyerPayload = {
    user_id: user.id,
    business_name: nullableText(metadata.business_name),
    business_type: canSell ? nullableText(metadata.business_type) : 'Individual buyer',
    gstin: nullableText(metadata.gstin)?.toUpperCase() || null,
    billing_address: addressFromMetadata(metadata),
    updated_at: new Date().toISOString(),
  };
  let buyerProfileId = existingBuyer?.id ? String(existingBuyer.id) : null;
  if (buyerProfileId) {
    const { error } = await client.from('buyer_profiles').update(buyerPayload).eq('id', buyerProfileId).eq('user_id', user.id);
    if (error) throw error;
  } else {
    const { data, error } = await client.from('buyer_profiles').insert({
      ...buyerPayload,
      buyer_ref: accountReference('BYR', user.id),
      gstin_verified: false,
      is_active: true,
    }).select('id').single();
    if (error) throw error;
    buyerProfileId = String(data.id);
  }

  let sellerProfileId: string | null = null;
  if (canSell) {
    const { data: existingSeller, error: sellerReadError } = await client
      .from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();
    if (sellerReadError) throw sellerReadError;
    const sellerPayload = {
      user_id: user.id,
      legal_business_name: text(metadata.business_name) || text(metadata.full_name) || email.split('@')[0],
      display_name: text(metadata.business_name) || text(metadata.full_name) || email.split('@')[0],
      business_type: nullableText(metadata.business_type),
      gstin: nullableText(metadata.gstin)?.toUpperCase() || null,
      pan: nullableText(metadata.pan)?.toUpperCase() || null,
      pickup_address: addressFromMetadata(metadata),
      updated_at: new Date().toISOString(),
    };
    sellerProfileId = existingSeller?.id ? String(existingSeller.id) : null;
    if (sellerProfileId) {
      const { error } = await client.from('seller_profiles').update(sellerPayload).eq('id', sellerProfileId).eq('user_id', user.id);
      if (error) throw error;
    } else {
      const { data, error } = await client.from('seller_profiles').insert({
        ...sellerPayload,
        seller_ref: accountReference('SLR', user.id),
        verification_status: 'registration_started',
        gstin_verified: false,
        settlement_eligible: false,
        is_active: true,
      }).select('id').single();
      if (error) throw error;
      sellerProfileId = String(data.id);
    }
  }

  return { role, userProfileId: user.id, buyerProfileId, sellerProfileId, canBuy, canSell };
}
`);

await writeFile('src/middleware.ts', `import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_EMAIL = 'fabrictrad8@gmail.com';
const DEMO_COOKIE_NAME = 'fabrictrad_demo_role';

const PUBLIC_PATHS = new Set([
  '/', '/login', '/register', '/buyer-registration', '/seller-registration', '/auth/callback',
]);
const AUTH_ENTRY_PATHS = new Set(['/', '/login', '/register', '/buyer-registration']);

const withRefreshedCookies = (target: NextResponse, source: NextResponse) => {
  source.cookies.getAll().forEach(({ name, value }) => target.cookies.set(name, value));
  return target;
};

const redirect = (request: NextRequest, pathname: string) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
};

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === '/' && (searchParams.has('code') || searchParams.has('error'))) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    return NextResponse.redirect(callbackUrl);
  }

  const demoCookieValue = request.cookies.get(DEMO_COOKIE_NAME)?.value;
  const demoRole = demoCookieValue === 'buyer' || demoCookieValue === 'seller' ? demoCookieValue : null;
  if (demoRole) {
    const canBuy = true;
    const canSell = demoRole === 'seller';
    if (AUTH_ENTRY_PATHS.has(pathname)) return redirect(request, '/marketplace');
    if (pathname.startsWith('/admin-portal')) return redirect(request, '/marketplace');
    if (pathname.startsWith('/seller-dashboard') && !canSell) return redirect(request, '/seller-registration');
    if ((pathname.startsWith('/buyer-dashboard') || pathname.startsWith('/buyer-requirements')) && !canBuy) {
      return redirect(request, '/marketplace');
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    if (PUBLIC_PATHS.has(pathname)) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', \`\${pathname}\${request.nextUrl.search}\`);
    return withRefreshedCookies(NextResponse.redirect(loginUrl), response);
  }

  const normalizedEmail = user.email?.trim().toLowerCase() || '';
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role,is_active,can_buy,can_sell')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_active === false && normalizedEmail !== ADMIN_EMAIL) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('error', 'account_inactive');
    return withRefreshedCookies(NextResponse.redirect(loginUrl), response);
  }

  const role = normalizedEmail === ADMIN_EMAIL
    ? 'super_admin'
    : profile?.role || user.app_metadata?.role || user.user_metadata?.role || 'buyer';
  const isAdmin = role === 'admin_staff' || role === 'super_admin';
  const canBuy = !isAdmin && (profile?.can_buy ?? true);
  const canSell = !isAdmin && (profile?.can_sell ?? role === 'seller');

  if (AUTH_ENTRY_PATHS.has(pathname)) {
    return withRefreshedCookies(redirect(request, isAdmin ? '/admin-portal' : '/marketplace'), response);
  }
  if (pathname.startsWith('/admin-portal') && !isAdmin) {
    return withRefreshedCookies(redirect(request, '/marketplace'), response);
  }
  if (pathname.startsWith('/seller-dashboard') && !canSell) {
    return withRefreshedCookies(redirect(request, '/seller-registration'), response);
  }
  if ((pathname.startsWith('/buyer-dashboard') || pathname.startsWith('/buyer-requirements')) && !canBuy) {
    return withRefreshedCookies(redirect(request, '/marketplace'), response);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
`);

await replaceAll('src/app/auth/callback/route.ts', [
  ["  if (role === 'seller') return `${origin}/seller-dashboard`;\n  if (role === 'admin_staff' || role === 'super_admin') return `${origin}/admin-portal`;\n  return `${origin}/marketplace`;", "  if (role === 'admin_staff' || role === 'super_admin') return `${origin}/admin-portal`;\n  return `${origin}/marketplace`;"],
  ["    .select('id, phone, role, is_active')", "    .select('id, phone, role, is_active, can_buy, can_sell')"],
  ["  if (isGoogleCallback && resolvedRole !== 'buyer') {\n    await supabase.auth.signOut();\n    return redirectAfterAuth(loginErrorUrl(origin, 'google_buyer_only'));\n  }", "  // Google authentication identifies the account; database capabilities decide whether it may buy or sell.\n  void isGoogleCallback;"],
]);

await replaceAll('src/components/ui/AppLogo.tsx', [
  ["      ? profile.role === 'seller'\n        ? '/seller-dashboard'\n        : profile.role === 'admin_staff' || profile.role === 'super_admin'\n          ? '/admin-portal'\n          : '/marketplace'", "      ? profile.role === 'admin_staff' || profile.role === 'super_admin'\n        ? '/admin-portal'\n        : '/marketplace'"],
]);

await replaceAll('src/app/seller-dashboard/page.tsx', [
  ["    if (profile && profile.role !== 'seller') {\n      setAccountReady(true);\n      return;\n    }\n\n", ""],
  ["    if (profile.role === 'buyer') {\n      router.replace('/buyer-dashboard');\n      return;\n    }", "    if (!(profile.can_sell ?? profile.role === 'seller')) {\n      router.replace('/seller-registration');\n      return;\n    }"],
  ["  if (profile.role === 'buyer') {\n    return (\n      <DashboardRouteState\n        title=\"Opening buyer dashboard\"\n        message=\"This account is registered as a buyer, so we are taking you to the buyer dashboard.\"\n        href=\"/buyer-dashboard\"\n        actionLabel=\"Go to Buyer Dashboard\"\n      />\n    );\n  }", "  if (!(profile.can_sell ?? profile.role === 'seller')) {\n    return (\n      <DashboardRouteState\n        title=\"Activate seller access\"\n        message=\"This account can already buy. Add your GST business details once to unlock seller tools on the same mobile number.\"\n        href=\"/seller-registration\"\n        actionLabel=\"Activate Selling\"\n      />\n    );\n  }"],
]);

await replaceAll('src/app/buyer-dashboard/page.tsx', [
  ["    if (profile && profile.role !== 'buyer') {\n      setAccountReady(true);\n      return;\n    }\n\n", ""],
  ["    if (profile.role === 'seller') {\n      router.replace('/seller-dashboard');\n      return;\n    }", "    if (profile.can_buy === false) {\n      router.replace('/marketplace');\n      return;\n    }"],
  ["  if (profile.role === 'seller') {\n    return (\n      <DashboardRouteState\n        title=\"Opening seller dashboard\"\n        message=\"This account is registered as a seller, so we are taking you to the seller tools.\"\n        href=\"/seller-dashboard\"\n        actionLabel=\"Go to Seller Dashboard\"\n      />\n    );\n  }", "  if (profile.can_buy === false) {\n    return (\n      <DashboardRouteState\n        title=\"Buyer access unavailable\"\n        message=\"This account is not currently allowed to place orders.\"\n        href=\"/marketplace\"\n        actionLabel=\"Return to Marketplace\"\n      />\n    );\n  }"],
]);

await replaceAll('src/app/product-detail/components/ProductInfo.tsx', [
  ["    if (profile?.role === 'seller') {\n      toast.error('Seller accounts cannot place buyer orders.');\n      return;\n    }", "    if (profile?.can_buy === false) {\n      toast.error('Buying access is not enabled for this account.');\n      return;\n    }"],
]);

await replaceAll('src/app/seller-dashboard/components/SellerDashboardLayout.tsx', [
  ["        <div className=\"ml-auto flex items-center gap-2 sm:gap-3\">", "        <div className=\"ml-auto flex items-center gap-2 sm:gap-3\">\n          <Link\n            href=\"/marketplace\"\n            className=\"hidden sm:inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-800 text-foreground hover:border-primary/40 hover:text-primary\"\n          >\n            <Icon name=\"ShoppingBagIcon\" size={15} /> Buy fabrics\n          </Link>"],
]);

await replaceAll('src/app/buyer-dashboard/components/ModernBuyerDashboardLayout.tsx', [
  ["        <Link\n          href=\"/marketplace\"\n          className=\"flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-800 text-foreground hover:border-primary/40 hover:text-primary\"\n        >\n          <Icon name=\"ShoppingBagIcon\" size={17} /> {t('nav.marketplace')}\n        </Link>", "        <Link\n          href=\"/marketplace\"\n          className=\"flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-800 text-foreground hover:border-primary/40 hover:text-primary\"\n        >\n          <Icon name=\"ShoppingBagIcon\" size={17} /> {t('nav.marketplace')}\n        </Link>\n        <Link\n          href={profile?.can_sell || profile?.role === 'seller' ? '/seller-dashboard' : '/seller-registration'}\n          className=\"flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-800 text-white hover:opacity-90\"\n        >\n          <Icon name=\"BuildingStorefrontIcon\" size={17} />\n          {profile?.can_sell || profile?.role === 'seller' ? 'Open seller tools' : 'Sell with GST'}\n        </Link>"],
]);

// Catalogue form: never preload an old product, support clear/new, and accept drag/drop.
await replaceAll('src/app/seller-dashboard/components/SellerCatalogAssistant.tsx', [
  ['const STARTER_TEXT = `Catalog = Navratri Vichitra Silk', 'const EXAMPLE_TEXT = `Catalog = Navratri Vichitra Silk'],
  ['  const [text, setText] = useState(STARTER_TEXT);', "  const [text, setText] = useState('');"],
  ["  const addFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {\n    const files = Array.from(event.target.files || []);\n    event.target.value = '';\n    if (!files.length) return;", "  const ingestFiles = async (files: File[]) => {\n    if (!files.length) return;"],
  ["    setAttachments((current) => [...current, ...accepted].slice(0, 24));\n  };\n\n  const updateAttachment", "    setAttachments((current) => [...current, ...accepted].slice(0, 24));\n  };\n\n  const addFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {\n    const files = Array.from(event.target.files || []);\n    event.target.value = '';\n    await ingestFiles(files);\n  };\n\n  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {\n    event.preventDefault();\n    await ingestFiles(Array.from(event.dataTransfer.files || []));\n  };\n\n  const resetComposer = () => {\n    attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));\n    attachmentUrlsRef.current = [];\n    setText('');\n    setDraft(null);\n    setAttachments([]);\n    setProvider(null);\n    setListingStatus('draft');\n    setMessages([{\n      id: `welcome-${Date.now()}`,\n      role: 'assistant',\n      text: 'New product ready. Describe the fabric or drop its photos, then I will organise the name, width, colours, rates and stock.',\n    }]);\n    inputRef.current?.focus();\n  };\n\n  const updateAttachment"],
  ["      setMessages((current) => [\n        ...current,\n        {\n          id: `published-${Date.now()}`,\n          role: 'assistant',\n          text:\n            listingStatus === 'active'\n              ? 'Done. The parent product, variations, stock, photos and reels are now in your live catalogue.'\n              : 'Saved. You can review the draft in Parent Fabrics and publish it later.',\n        },\n      ]);", "      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));\n      attachmentUrlsRef.current = [];\n      setText('');\n      setDraft(null);\n      setAttachments([]);\n      setProvider(null);\n      setListingStatus('draft');\n      setMessages([{\n        id: `published-${Date.now()}`,\n        role: 'assistant',\n        text: listingStatus === 'active'\n          ? 'Published. The form is cleared and ready for your next product.'\n          : 'Draft saved. The form is cleared and ready for your next product.',\n      }]);"],
  ["        <div className=\"flex flex-wrap gap-2 text-xs\">", "        <div className=\"flex flex-wrap gap-2 text-xs\">\n          <button type=\"button\" onClick={resetComposer} className=\"rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 font-800 text-primary\">\n            <Icon name=\"PlusIcon\" size={13} className=\"mr-1 inline\" /> New product\n          </button>\n          <button type=\"button\" onClick={() => setText(EXAMPLE_TEXT)} className=\"rounded-full border border-border bg-card px-3 py-1.5 font-800 text-muted-foreground\">Use example</button>"],
  ["                    ['Base rate', `₹${draft.pricePerUnit.toLocaleString('en-IN')}/${draft.unit}`],", "                    ['Fabric name', draft.name],\n                    ['Width', draft.widthInches ? `${draft.widthInches} in` : 'Not provided'],\n                    ['Base rate', `₹${draft.pricePerUnit.toLocaleString('en-IN')}/${draft.unit}`],"],
  ["          <div className=\"rounded-2xl border border-border bg-card p-5 shadow-sm\">\n            <div className=\"flex items-center justify-between gap-3\">\n              <div>\n                <p className=\"text-xs font-800 uppercase tracking-wide text-muted-foreground\">Product media</p>", "          <div\n            className=\"rounded-2xl border border-border bg-card p-5 shadow-sm\"\n            onDragOver={(event) => event.preventDefault()}\n            onDrop={(event) => void handleDrop(event)}\n          >\n            <div className=\"flex items-center justify-between gap-3\">\n              <div>\n                <p className=\"text-xs font-800 uppercase tracking-wide text-muted-foreground\">Product media</p>"],
  ["            {attachments.length ? (", "            <button\n              type=\"button\"\n              onClick={() => inputRef.current?.click()}\n              className=\"mt-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center transition hover:border-primary/60\"\n            >\n              <Icon name=\"ArrowUpTrayIcon\" size={24} className=\"text-primary\" />\n              <span className=\"mt-2 text-sm font-800 text-foreground\">Drag and drop product photos or a reel</span>\n              <span className=\"mt-1 text-xs text-muted-foreground\">{draft ? `${draft.name} · ${draft.widthInches ? `${draft.widthInches} in` : 'width pending'} · ${(draft.variants || []).map((item) => item.colorName).join(', ') || 'colour pending'}` : 'Name, width and colour appear here after extraction'}</span>\n            </button>\n\n            {attachments.length ? ("],
]);

// Individual buyer verification: collect only PAN/Aadhaar Offline e-KYC reference last four.
await replaceAll('src/app/buyer-registration/components/BuyerRegistrationFlow.tsx', [
  ["    confirmPassword: '',\n  });", "    confirmPassword: '',\n    verificationMethod: 'pan' as 'pan' | 'aadhaar_offline',\n    identityReferenceLast4: '',\n  });"],
  ["    if (account.password.length < 8) {", "    const identityLast4 = account.identityReferenceLast4.trim().toUpperCase();\n    const identityValid = account.verificationMethod === 'aadhaar_offline'\n      ? /^\\d{4}$/.test(identityLast4)\n      : /^[A-Z0-9]{4}$/.test(identityLast4);\n    if (!identityValid) {\n      setError(account.verificationMethod === 'aadhaar_offline'\n        ? 'Enter only the last 4 digits from the Aadhaar Offline e-KYC reference.'\n        : 'Enter the last 4 characters of the PAN reference.');\n      return;\n    }\n    if (account.password.length < 8) {"],
  ["          `This email is already registered as a ${emailCheck.usedAs || 'different'} account. Buyer and seller accounts must use different identity details.`", "          `This email already belongs to a FabricTrad account. Sign in instead—one account can buy and GST-verified accounts can also sell.`"],
  ["          `This phone number is already registered as a ${phoneCheck.usedAs || 'different'} account. Buyer and seller accounts must use different identity details.`", "          `This mobile number already belongs to a FabricTrad account. Sign in instead of registering again.`"],
  ["          'This buyer identity is already in use. Use a different email and phone number from any seller account.'", "          'This identity already has a FabricTrad account. Sign in to buy or activate GST selling on the same account.'"],
  ["        preferredLanguage: address.preferredLanguage,\n      });", "        preferredLanguage: address.preferredLanguage,\n        verificationMethod: account.verificationMethod,\n        identityReferenceLast4: account.identityReferenceLast4.trim().toUpperCase(),\n      });"],
  ["                <div>\n                  <label className=\"block text-sm font-700 text-foreground mb-1.5\">\n                    Password *", "                <div className=\"grid gap-3 sm:grid-cols-2\">\n                  <div>\n                    <label className=\"block text-sm font-700 text-foreground mb-1.5\">Buyer verification *</label>\n                    <select\n                      value={account.verificationMethod}\n                      onChange={(e) => setAccount({ ...account, verificationMethod: e.target.value as 'pan' | 'aadhaar_offline', identityReferenceLast4: '' })}\n                      className=\"input-base w-full px-4 py-3 text-sm rounded-xl\"\n                    >\n                      <option value=\"pan\">PAN Card</option>\n                      <option value=\"aadhaar_offline\">Aadhaar Offline e-KYC</option>\n                    </select>\n                  </div>\n                  <div>\n                    <label className=\"block text-sm font-700 text-foreground mb-1.5\">Reference last 4 *</label>\n                    <input\n                      type=\"text\"\n                      inputMode={account.verificationMethod === 'aadhaar_offline' ? 'numeric' : 'text'}\n                      maxLength={4}\n                      value={account.identityReferenceLast4}\n                      onChange={(e) => setAccount({ ...account, identityReferenceLast4: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() })}\n                      placeholder=\"Last 4 only\"\n                      className=\"input-base w-full px-4 py-3 text-sm rounded-xl uppercase\"\n                      required\n                    />\n                  </div>\n                </div>\n                <p className=\"-mt-2 text-[11px] leading-5 text-muted-foreground\">For Aadhaar, FabricTrad never asks for or stores the full Aadhaar number. Use the UIDAI Paperless Offline e-KYC reference only.</p>\n                <div>\n                  <label className=\"block text-sm font-700 text-foreground mb-1.5\">\n                    Password *"],
]);

// Existing buyers can activate GST seller access without creating another login.
await replaceAll('src/app/seller-registration/components/SellerRegistrationFlow.tsx', [
  ["import React, { useState, useRef } from 'react';", "import React, { useEffect, useState, useRef } from 'react';"],
  ["  const { signUp, checkEmailUnique, checkPhoneUnique } = useAuth();", "  const { user, profile, signUp, checkEmailUnique, checkPhoneUnique, refreshProfile } = useAuth();"],
  ["  const [currentStep, setCurrentStep] = useState<Step>('account');", "  const [currentStep, setCurrentStep] = useState<Step>(user ? 'business' : 'account');"],
  ["  const currentIndex = STEP_ORDER.indexOf(currentStep);", "  const currentIndex = STEP_ORDER.indexOf(currentStep);\n\n  useEffect(() => {\n    if (!user) return;\n    setForm((current) => ({\n      ...current,\n      ownerName: current.ownerName || profile?.full_name || '',\n      email: current.email || user.email || '',\n      phone: current.phone || profile?.phone || '',\n      businessName: current.businessName || profile?.business_name || '',\n      city: current.city || profile?.city || '',\n      state: current.state || profile?.state || '',\n      address: current.address || profile?.address_line1 || '',\n      pincode: current.pincode || profile?.pincode || '',\n      gstin: current.gstin || profile?.gstin || '',\n    }));\n    if (currentStep === 'account') setCurrentStep('business');\n  }, [currentStep, profile, user]);"],
  ["          `This email is already registered as a ${emailCheck.usedAs || 'different'} account. Buyer and seller accounts must use different identity details.`", "          `This email already has a FabricTrad account. Sign in, then activate selling with GST on that same account.`"],
  ["          `This phone number is already registered as a ${phoneCheck.usedAs || 'different'} account. Buyer and seller accounts must use different identity details.`", "          `This mobile number already has a FabricTrad account. Sign in instead of registering a second time.`"],
  ["      const [emailCheck, phoneCheck] = await Promise.all([\n        checkEmailUnique(email),\n        checkPhoneUnique(phone),\n      ]);\n\n      if (!emailCheck.unique || !phoneCheck.unique) {\n        setError(\n          'This seller identity is already in use. Use a different email and phone number from any buyer account.'\n        );\n        return;\n      }\n\n      const signup = await signUp", "      if (user?.id) {\n        const application = new FormData();\n        application.set('payload', JSON.stringify({\n          ownerName: form.ownerName, phone, businessName: form.businessName,\n          businessType: form.businessType, city: form.city, state: form.state,\n          pincode: form.pincode, address: form.address, categories: form.categories,\n          monthlyCapacity: form.monthlyCapacity, gstin: form.gstin, pan: form.pan,\n          bankAccountNumber: form.bankAccountNumber, bankIfsc: form.bankIfsc,\n          bankAccountName: form.bankAccountName, bankName: form.bankName,\n        }));\n        Object.entries(documents).forEach(([key, document]) => {\n          if (document.file) application.set(`document_${key}`, document.file);\n        });\n        const response = await fetch('/api/account/enable-selling', { method: 'POST', credentials: 'same-origin', body: application });\n        const result = await response.json().catch(() => ({}));\n        if (!response.ok && response.status !== 207) throw new Error(result?.error || 'Seller access could not be activated.');\n        setSellerId(result?.sellerRef || `FT-SLR-${user.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`);\n        setSubmissionWarning(result?.warning || '');\n        await refreshProfile();\n        setCurrentStep('done');\n        return;\n      }\n\n      const [emailCheck, phoneCheck] = await Promise.all([\n        checkEmailUnique(email),\n        checkPhoneUnique(phone),\n      ]);\n      if (!emailCheck.unique || !phoneCheck.unique) {\n        setError('This identity already has a FabricTrad account. Sign in and activate selling on that account.');\n        return;\n      }\n\n      const signup = await signUp"],
  ["    if (idx > 0) setCurrentStep(STEP_ORDER[idx - 1]);", "    if (user && idx === 1) return;\n    if (idx > 0) setCurrentStep(STEP_ORDER[idx - 1]);"],
  ["          <h1 className=\"text-2xl font-800 text-foreground mb-1\">Become a FabricTrad Seller</h1>\n          <p className=\"text-sm text-muted-foreground\">\n            Reach 45,000+ verified B2B buyers across India\n          </p>", "          <h1 className=\"text-2xl font-800 text-foreground mb-1\">{user ? 'Activate Selling on Your Account' : 'Join FabricTrad'}</h1>\n          <p className=\"text-sm text-muted-foreground\">\n            {user ? 'Keep the same mobile number and buyer access; add GST details once to unlock seller tools.' : 'Create one account that can buy, and can also sell after GST onboarding.'}\n          </p>"],
]);

// Regression checks for the new account model and catalogue reset.
await replaceAll('.github/workflows/quality.yml', [
  ["            supabase/migrations/20260730212000_catalog_order_inventory_reservation.sql", "            supabase/migrations/20260730212000_catalog_order_inventory_reservation.sql\n            supabase/migrations/20260730220000_unified_commerce_accounts.sql\n            src/app/api/account/enable-selling/route.ts"],
  ["          grep -Fq 'Retail quantity enabled' src/app/product-detail/components/ProductInfo.tsx", "          grep -Fq 'Retail quantity enabled' src/app/product-detail/components/ProductInfo.tsx\n          grep -Fq 'can_current_user_buy' supabase/migrations/20260730220000_unified_commerce_accounts.sql\n          grep -Fq 'request_seller_access' supabase/migrations/20260730220000_unified_commerce_accounts.sql\n          grep -Fq \"const [text, setText] = useState('')\" src/app/seller-dashboard/components/SellerCatalogAssistant.tsx\n          grep -Fq 'Drag and drop product photos or a reel' src/app/seller-dashboard/components/SellerCatalogAssistant.tsx\n          grep -Fq \"fetch('/api/account/enable-selling'\" src/app/seller-registration/components/SellerRegistrationFlow.tsx\n          grep -Fq 'profile?.can_buy === false' src/app/product-detail/components/ProductInfo.tsx"],
]);

console.log('Unified commerce UI and routing patches applied.');
