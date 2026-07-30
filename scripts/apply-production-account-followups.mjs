import { readFile, writeFile } from 'node:fs/promises';

async function replace(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Expected block not found in ${path}: ${before.slice(0, 120)}`);
  await writeFile(path, source.replace(before, after));
}

for (const path of ['src/app/seller-dashboard/page.tsx', 'src/app/buyer-dashboard/page.tsx']) {
  await replace(path, `    if (loading || !user) return;`, `    if (loading || !user || accountReady) return;`);
  await replace(
    path,
    `  }, [isDemoAccount, loading, profile, refreshProfile, user]);`,
    `  }, [accountReady, isDemoAccount, loading, profile, refreshProfile, user]);`
  );
}

await replace(
  'src/app/login/EmailOtpLoginClient.tsx',
  `    } else if (authError === 'google_buyer_only') {\n      setError('Google sign-in is available for buyer accounts only.');\n    } else if (authError) {`,
  `    } else if (authError === 'google_buyer_only') {\n      setError('Google sign-in is available for buyer accounts only.');\n    } else if (authError === 'account_setup_failed') {\n      setError('Your login was verified, but the buyer or seller profile could not be prepared. Please sign in again.');\n    } else if (authError) {`
);

await replace(
  'src/app/api/razorpay/webhook/route.ts',
  `.select('id,seller_id,gst_total,gst_amount')`,
  `.select(payment.kind === 'bulk' ? 'id,seller_id,gst_total' : 'id,seller_id,gst_amount')`
);

await replace(
  'src/app/admin-portal/components/AdminSellers.tsx',
  `  status:\n    | 'registration_started'\n    | 'documents_pending'\n    | 'pending_review'\n    | 'verified'\n    | 'suspended'\n    | 'deactivated'\n    | 'rejected';`,
  `  status:\n    | 'registration_started'\n    | 'phone_unverified'\n    | 'email_unverified'\n    | 'profile_incomplete'\n    | 'documents_submitted'\n    | 'automated_review'\n    | 'manual_review'\n    | 'additional_docs_required'\n    | 'verified'\n    | 'rejected'\n    | 'suspended'\n    | 'permanently_blocked'\n    | 'deactivated';`
);

await replace(
  'src/app/admin-portal/components/AdminSellers.tsx',
  `const statusConfig: Record<string, { label: string; class: string }> = {\n  verified: { label: '✓ Verified', class: 'bg-success/10 text-success' },\n  registration_started: { label: 'Registration Started', class: 'bg-blue-50 text-blue-700' },\n  documents_pending: { label: 'Documents Pending', class: 'bg-blue-50 text-blue-700' },\n  pending_review: { label: '⏳ Pending Review', class: 'bg-amber-50 text-warning' },\n  suspended: { label: '⛔ Suspended', class: 'bg-error/10 text-error' },\n  deactivated: { label: '✗ Deactivated', class: 'bg-muted text-muted-foreground' },\n  rejected: { label: '✗ Rejected', class: 'bg-error/10 text-error' },\n};`,
  `const statusConfig: Record<string, { label: string; class: string }> = {\n  verified: { label: '✓ Verified', class: 'bg-success/10 text-success' },\n  registration_started: { label: 'Registration Started', class: 'bg-blue-50 text-blue-700' },\n  phone_unverified: { label: 'Phone Unverified', class: 'bg-blue-50 text-blue-700' },\n  email_unverified: { label: 'Email Unverified', class: 'bg-blue-50 text-blue-700' },\n  profile_incomplete: { label: 'Profile Incomplete', class: 'bg-blue-50 text-blue-700' },\n  documents_submitted: { label: 'Documents Submitted', class: 'bg-amber-50 text-warning' },\n  automated_review: { label: 'Automated Review', class: 'bg-amber-50 text-warning' },\n  manual_review: { label: 'Manual Review', class: 'bg-amber-50 text-warning' },\n  additional_docs_required: { label: 'More Documents Needed', class: 'bg-amber-50 text-warning' },\n  suspended: { label: '⛔ Suspended', class: 'bg-error/10 text-error' },\n  permanently_blocked: { label: '⛔ Permanently Blocked', class: 'bg-error/10 text-error' },\n  deactivated: { label: '✗ Deactivated', class: 'bg-muted text-muted-foreground' },\n  rejected: { label: '✗ Rejected', class: 'bg-error/10 text-error' },\n};\n\nconst PENDING_STATUSES = new Set<Seller['status']>([\n  'registration_started',\n  'phone_unverified',\n  'email_unverified',\n  'profile_incomplete',\n  'documents_submitted',\n  'automated_review',\n  'manual_review',\n  'additional_docs_required',\n]);`
);

await replace(
  'src/app/admin-portal/components/AdminSellers.tsx',
  `          if (filter === 'Pending Review') return s.status === 'pending_review';`,
  `          if (filter === 'Pending Review') return PENDING_STATUSES.has(s.status);`
);

await replace(
  'src/app/admin-portal/components/AdminSellers.tsx',
  `    const newStatus: Seller['status'] =\n      action === 'approve'\n        ? 'verified'\n        : action === 'reject'\n          ? 'rejected'\n          : action === 'suspend'\n            ? 'suspended'\n            : action === 'deactivate'\n              ? 'deactivated'\n              : 'verified';\n\n    const supabase = createClient();\n    await supabase\n      .from('seller_profiles')\n      .update({\n        verification_status: newStatus === 'deactivated' ? seller.status : newStatus,\n        is_active: newStatus !== 'deactivated',\n      })\n      .eq('id', seller.dbId);\n\n    setSellers((prev) => prev.map((s) => (s.id === seller.id ? { ...s, status: newStatus } : s)));\n    showToast(\`Seller ${'${action}'}d successfully\`);\n    setActionModal(null);\n    setActionReason('');`,
  `    const newStatus: Seller['status'] =\n      action === 'approve'\n        ? 'verified'\n        : action === 'reject'\n          ? 'rejected'\n          : action === 'suspend'\n            ? 'suspended'\n            : action === 'deactivate'\n              ? 'deactivated'\n              : 'verified';\n\n    const updateValues =\n      action === 'deactivate'\n        ? { is_active: false }\n        : action === 'reactivate'\n          ? { is_active: true, verification_status: 'verified' }\n          : {\n              is_active: action !== 'suspend' && action !== 'reject',\n              verification_status: newStatus,\n            };\n\n    const supabase = createClient();\n    const { error } = await supabase\n      .from('seller_profiles')\n      .update(updateValues)\n      .eq('id', seller.dbId);\n    if (error) {\n      showToast(error.message);\n      return;\n    }\n\n    setSellers((prev) => prev.map((s) => (s.id === seller.id ? { ...s, status: newStatus } : s)));\n    showToast(\`Seller ${'${action}'}d successfully\`);\n    setActionModal(null);\n    setActionReason('');`
);

await replace(
  'src/app/admin-portal/components/AdminSellers.tsx',
  `  const pendingCount = sellers.filter((s) => s.status === 'pending_review').length;`,
  `  const pendingCount = sellers.filter((s) => PENDING_STATUSES.has(s.status)).length;`
);

await replace(
  'src/app/admin-portal/components/AdminSellers.tsx',
  `                      {seller.status === 'pending_review' && (`,
  `                      {PENDING_STATUSES.has(seller.status) && (`
);

console.log('Production account follow-up patches applied.');
