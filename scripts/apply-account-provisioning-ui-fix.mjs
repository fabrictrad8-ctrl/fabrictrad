import { readFile, writeFile } from 'node:fs/promises';

async function replace(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Expected block not found in ${path}: ${before.slice(0, 100)}`);
  await writeFile(path, source.replace(before, after));
}

// Auth: persist complete signup metadata and provision role profiles immediately.
await replace(
  'src/contexts/AuthContext.tsx',
  `    const { data, error } = await supabase.auth.signUp({`,
  `    const registrationNonce = crypto.randomUUID();\n    const { data, error } = await supabase.auth.signUp({`
);

await replace(
  'src/contexts/AuthContext.tsx',
  `          preferred_language: metadata?.preferredLanguage || 'en',\n          preferred_theme: metadata?.preferredTheme || 'system',`,
  `          preferred_language: metadata?.preferredLanguage || 'en',\n          preferred_theme: metadata?.preferredTheme || 'system',\n          business_type: metadata?.businessType || '',\n          pan: metadata?.pan || '',\n          categories: Array.isArray(metadata?.categories) ? metadata.categories : [],\n          monthly_capacity: metadata?.monthlyCapacity || '',\n          registration_nonce: registrationNonce,`
);

await replace(
  'src/contexts/AuthContext.tsx',
  `        emailRedirectTo: \`${'${getAuthRedirectBase()}'}/auth/callback\`,\n      },\n    });\n    if (error) throw error;\n    return data;`,
  `        emailRedirectTo: \`${'${getAuthRedirectBase()}'}/auth/callback\`,\n      },\n    });\n    if (error) throw error;\n\n    let provisioningWarning: string | null = null;\n    if (data.user) {\n      const response = await fetch('/api/auth/provision-account', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          ...(data.session?.access_token\n            ? { Authorization: \`Bearer ${'${data.session.access_token}'}\` }\n            : {}),\n        },\n        credentials: 'same-origin',\n        cache: 'no-store',\n        body: JSON.stringify({ userId: data.user.id, registrationNonce }),\n      }).catch(() => null);\n      if (!response?.ok) {\n        const payload = await response?.json().catch(() => ({}));\n        provisioningWarning = payload?.error || 'Account profile setup will finish when you verify and sign in.';\n      }\n    }\n\n    return { ...data, registrationNonce, provisioningWarning };`
);

await replace(
  'src/contexts/AuthContext.tsx',
  `    setSession(data.session);\n    setUser(data.user);\n    let accountRole =\n      data.user?.app_metadata?.role || data.user?.user_metadata?.role || 'buyer';\n\n    if (data.user) {\n      const loadedProfile = await loadProfile(data.user.id).catch(() => null);\n      if (loadedProfile?.role) accountRole = loadedProfile.role;\n    }`,
  `    setSession(data.session);\n    setUser(data.user);\n    let accountRole =\n      data.user?.app_metadata?.role || data.user?.user_metadata?.role || 'buyer';\n\n    if (data.user) {\n      const provisionResponse = await fetch('/api/auth/provision-account', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          ...(data.session?.access_token\n            ? { Authorization: \`Bearer ${'${data.session.access_token}'}\` }\n            : {}),\n        },\n        credentials: 'same-origin',\n        cache: 'no-store',\n        body: '{}',\n      });\n      const provisionPayload = await provisionResponse.json().catch(() => ({}));\n      if (!provisionResponse.ok) {\n        throw new Error(provisionPayload?.error || 'Your account profile could not be prepared. Please try again.');\n      }\n\n      const loadedProfile = await loadProfile(data.user.id).catch(() => null);\n      if (loadedProfile?.role) accountRole = loadedProfile.role;\n    }`
);

await replace(
  'src/contexts/AuthContext.tsx',
  `    if (error) throw error;\n    if (data.user) await loadProfile(data.user.id).catch(() => setProfile(null));\n    return data;`,
  `    if (error) throw error;\n    if (data.user) {\n      await fetch('/api/auth/provision-account', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          ...(data.session?.access_token\n            ? { Authorization: \`Bearer ${'${data.session.access_token}'}\` }\n            : {}),\n        },\n        credentials: 'same-origin',\n        cache: 'no-store',\n        body: '{}',\n      }).catch(() => undefined);\n      await loadProfile(data.user.id).catch(() => setProfile(null));\n    }\n    return data;`
);

await replace(
  'src/contexts/AuthContext.tsx',
  `  const refreshProfile = async () => {\n    if (user && !isDemoAccount) await loadProfile(user.id);\n  };`,
  `  const refreshProfile = async () => {\n    if (user && !isDemoAccount) {\n      await fetch('/api/auth/provision-account', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          ...(session?.access_token ? { Authorization: \`Bearer ${'${session.access_token}'}\` } : {}),\n        },\n        credentials: 'same-origin',\n        cache: 'no-store',\n        body: '{}',\n      }).catch(() => undefined);\n      await loadProfile(user.id);\n    }\n  };`
);

// Seller registration: persist the application, masked bank data and documents.
await replace(
  'src/app/seller-registration/components/SellerRegistrationFlow.tsx',
  `  const [sellerId] = useState(\`FT-SLR-${'${Math.floor(100000 + Math.random() * 900000)}'}\`);`,
  `  const [sellerId, setSellerId] = useState(\`FT-SLR-${'${Math.floor(100000 + Math.random() * 900000)}'}\`);\n  const [submissionWarning, setSubmissionWarning] = useState('');`
);

await replace(
  'src/app/seller-registration/components/SellerRegistrationFlow.tsx',
  `      await signUp(email, form.password, {\n        fullName: form.ownerName,\n        phone,\n        role: 'seller',\n        businessName: form.businessName,\n        gstin: form.gstin.toUpperCase(),\n        addressLine1: form.address,\n        city: form.city,\n        state: form.state,\n        pincode: form.pincode,\n        preferredLanguage: form.preferredLanguage,\n      });\n      setCurrentStep('done');`,
  `      const signup = await signUp(email, form.password, {\n        fullName: form.ownerName,\n        phone,\n        role: 'seller',\n        businessName: form.businessName,\n        businessType: form.businessType,\n        gstin: form.gstin.toUpperCase(),\n        pan: form.pan.toUpperCase(),\n        categories: form.categories,\n        monthlyCapacity: form.monthlyCapacity,\n        addressLine1: form.address,\n        city: form.city,\n        state: form.state,\n        pincode: form.pincode,\n        preferredLanguage: form.preferredLanguage,\n      });\n\n      if (!signup?.user?.id) throw new Error('The seller login could not be created.');\n      const application = new FormData();\n      application.set('userId', signup.user.id);\n      application.set('registrationNonce', signup.registrationNonce || '');\n      application.set(\n        'payload',\n        JSON.stringify({\n          ownerName: form.ownerName,\n          phone,\n          businessName: form.businessName,\n          businessType: form.businessType,\n          city: form.city,\n          state: form.state,\n          pincode: form.pincode,\n          address: form.address,\n          categories: form.categories,\n          monthlyCapacity: form.monthlyCapacity,\n          gstin: form.gstin,\n          pan: form.pan,\n          bankAccountNumber: form.bankAccountNumber,\n          bankIfsc: form.bankIfsc,\n          bankAccountName: form.bankAccountName,\n          bankName: form.bankName,\n        })\n      );\n      Object.entries(documents).forEach(([key, document]) => {\n        if (document.file) application.set(\`document_${'${key}'}\`, document.file);\n      });\n\n      const finalizeResponse = await fetch('/api/registration/seller/finalize', {\n        method: 'POST',\n        headers: signup.session?.access_token\n          ? { Authorization: \`Bearer ${'${signup.session.access_token}'}\` }\n          : undefined,\n        credentials: 'same-origin',\n        body: application,\n      });\n      const finalized = await finalizeResponse.json().catch(() => ({}));\n      if (!finalizeResponse.ok) {\n        setSubmissionWarning(\n          finalized?.error || signup.provisioningWarning ||\n            'Your login was created, but the application needs to be completed after email verification.'\n        );\n      } else {\n        setSellerId(finalized.sellerRef || sellerId);\n        setSubmissionWarning(signup.provisioningWarning || '');\n      }\n      setCurrentStep('done');`
);

await replace(
  'src/app/seller-registration/components/SellerRegistrationFlow.tsx',
  `              <p className="text-xs text-muted-foreground mb-4">\n                Check your email to verify your account. Selling tools activate after GSTIN, store,\n                bank, and document checks pass.\n              </p>`,
  `              <p className="text-xs text-muted-foreground mb-4">\n                Verify your email, then sign in to access the seller workspace. You can prepare draft\n                products immediately; products become buyer-visible after seller approval.\n              </p>\n              {submissionWarning && (\n                <div className="mb-5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-left text-xs leading-5 text-warning">\n                  {submissionWarning}\n                </div>\n              )}`
);

await replace(
  'src/app/seller-registration/components/SellerRegistrationFlow.tsx',
  `                  href="/seller-dashboard"`,
  `                  href="/login?role=seller"`
);
await replace(
  'src/app/seller-registration/components/SellerRegistrationFlow.tsx',
  `                  Go to Seller Dashboard`,
  `                  Verify Email / Sign In`
);

// Buyer registration: expose the real account reference and any setup warning.
await replace(
  'src/app/buyer-registration/components/BuyerRegistrationFlow.tsx',
  `  const [buyerId] = useState('FT-BYR-007842');`,
  `  const [buyerId, setBuyerId] = useState('Pending');\n  const [setupWarning, setSetupWarning] = useState('');`
);
await replace(
  'src/app/buyer-registration/components/BuyerRegistrationFlow.tsx',
  `      await signUp(email, account.password, {\n        fullName: account.fullName,\n        phone,\n        role: 'buyer',\n        addressLine1: address.line1,\n        addressLine2: address.line2,\n        city: address.city,\n        state: address.state,\n        pincode: address.pin,\n        preferredLanguage: address.preferredLanguage,\n      });\n      setCurrentStep('done');`,
  `      const signup = await signUp(email, account.password, {\n        fullName: account.fullName,\n        phone,\n        role: 'buyer',\n        addressLine1: address.line1,\n        addressLine2: address.line2,\n        city: address.city,\n        state: address.state,\n        pincode: address.pin,\n        preferredLanguage: address.preferredLanguage,\n      });\n      if (!signup?.user?.id) throw new Error('The buyer login could not be created.');\n      setBuyerId(\`FT-BYR-${'${signup.user.id.replaceAll(\'-\', \'\').slice(0, 12).toUpperCase()}'}\`);\n      setSetupWarning(signup.provisioningWarning || '');\n      setCurrentStep('done');`
);
await replace(
  'src/app/buyer-registration/components/BuyerRegistrationFlow.tsx',
  `              <div className="bg-muted rounded-2xl p-4 mb-6 inline-block">`,
  `              {setupWarning && (\n                <div className="mb-5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-left text-xs leading-5 text-warning">\n                  {setupWarning}\n                </div>\n              )}\n\n              <div className="bg-muted rounded-2xl p-4 mb-6 inline-block">`
);
await replace(
  'src/app/buyer-registration/components/BuyerRegistrationFlow.tsx',
  `                  href="/marketplace"`,
  `                  href="/login?role=buyer"`
);
await replace(
  'src/app/buyer-registration/components/BuyerRegistrationFlow.tsx',
  `                  Start Shopping`,
  `                  Verify Email / Open Marketplace`
);

// Existing logged-in accounts are repaired before dashboard features mount.
for (const [path, role, color] of [
  ['src/app/seller-dashboard/page.tsx', 'seller', 'secondary'],
  ['src/app/buyer-dashboard/page.tsx', 'buyer', 'primary'],
]) {
  await replace(path, `import React, { Suspense, useEffect } from 'react';`, `import React, { Suspense, useEffect, useState } from 'react';`);
  await replace(
    path,
    `  const { user, profile, loading } = useAuth();\n  const router = useRouter();`,
    `  const { user, profile, loading, isDemoAccount, refreshProfile } = useAuth();\n  const router = useRouter();\n  const [accountReady, setAccountReady] = useState(false);\n  const [accountError, setAccountError] = useState('');\n\n  useEffect(() => {\n    if (loading || !user) return;\n    if (isDemoAccount) {\n      setAccountReady(true);\n      return;\n    }\n    if (profile && profile.role !== '${role}') {\n      setAccountReady(true);\n      return;\n    }\n\n    let cancelled = false;\n    const prepare = async () => {\n      try {\n        const response = await fetch('/api/auth/provision-account', {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          credentials: 'same-origin',\n          cache: 'no-store',\n          body: '{}',\n        });\n        const payload = await response.json().catch(() => ({}));\n        if (!response.ok) throw new Error(payload?.error || 'Account setup failed.');\n        await refreshProfile();\n        if (!cancelled) setAccountReady(true);\n      } catch (error) {\n        if (!cancelled) setAccountError(error instanceof Error ? error.message : 'Account setup failed.');\n      }\n    };\n    void prepare();\n    return () => { cancelled = true; };\n  }, [isDemoAccount, loading, profile, refreshProfile, user]);`
  );
  await replace(
    path,
    `  if (loading) {`,
    `  if (accountError) {\n    return (\n      <DashboardRouteState\n        title="Account setup needs attention"\n        message={accountError}\n        href="/login?role=${role}"\n        actionLabel="Sign In Again"\n      />\n    );\n  }\n\n  if (loading || (user && !accountReady)) {`
  );
}

// Inventory self-heals too, covering a dashboard tab already open during deployment.
await replace(
  'src/app/seller-dashboard/components/SellerInventory.tsx',
  `    const supabase = createClient();\n    const { data: seller, error: sellerError } = await supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();\n    if (sellerError || !seller?.id) { setError(sellerError?.message || 'Complete seller registration before adding products.'); setLoading(false); return; }\n    setSellerId(seller.id);`,
  `    const supabase = createClient();\n    let { data: seller, error: sellerError } = await supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();\n    if (!seller?.id && !sellerError) {\n      const repairResponse = await fetch('/api/auth/provision-account', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        credentials: 'same-origin',\n        cache: 'no-store',\n        body: '{}',\n      });\n      if (repairResponse.ok) {\n        const retry = await supabase.from('seller_profiles').select('id').eq('user_id', user.id).maybeSingle();\n        seller = retry.data;\n        sellerError = retry.error;\n      }\n    }\n    if (sellerError || !seller?.id) { setError(sellerError?.message || 'We could not finish the seller profile. Sign out and sign in again.'); setLoading(false); return; }\n    setSellerId(seller.id);`
);

console.log('Account provisioning UI and authentication patches applied.');
