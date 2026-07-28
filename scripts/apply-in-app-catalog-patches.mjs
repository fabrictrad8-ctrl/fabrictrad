import { readFile, writeFile } from 'node:fs/promises';

async function patch(path, replacements) {
  let content = await readFile(path, 'utf8');
  for (const [before, after] of replacements) {
    if (!content.includes(before)) {
      throw new Error(`Expected source block was not found in ${path}: ${before.slice(0, 100)}`);
    }
    content = content.replace(before, after);
  }
  await writeFile(path, content);
}

await patch('src/app/seller-dashboard/components/SellerDashboardLayout.tsx', [
  [
    "import SellerWhatsAppUpload from '@/app/seller-dashboard/components/SellerWhatsAppUpload';",
    "import SellerCatalogAssistant from '@/app/seller-dashboard/components/SellerCatalogAssistant';\nimport SellerProfileReadiness from '@/app/seller-dashboard/components/SellerProfileReadiness';\nimport SellerCatalogOrders from '@/app/seller-dashboard/components/SellerCatalogOrders';",
  ],
  [
    "{ key: 'upload', label: 'WhatsApp Catalog', icon: 'ArrowUpTrayIcon' },",
    "{ key: 'upload', label: 'AI Catalog Studio', icon: 'SparklesIcon' },",
  ],
  [
    "Track stock, photos and rates separately for every colour or design.",
    "Track stock, photos, reels and rates separately for every colour or design.",
  ],
  [
    '<main className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">',
    '<main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 min-w-0">\n          <SellerProfileReadiness />',
  ],
  [
    "{activeTab === 'orders' && <SellerOrders />}",
    "{activeTab === 'orders' && (<>\n            <SellerCatalogOrders />\n            <SellerOrders />\n          </>)}",
  ],
  [
    "{activeTab === 'upload' && <SellerWhatsAppUpload />}",
    "{activeTab === 'upload' && <SellerCatalogAssistant />}",
  ],
  [
    'Real catalogue publishing and WhatsApp binding\n                     require a verified seller account.',
    'Real catalogue publishing, media uploads and order processing\n                     require a verified seller account.',
  ],
]);

await patch('src/app/seller-dashboard/components/SellerVariantCatalog.tsx', [
  [
    "import { variantKey } from '@/lib/whatsappCatalog';",
    "import { catalogVariantKey } from '@/lib/catalogAssistant';",
  ],
  ['const key = variantKey(form.colorName, form.designName);', 'const key = catalogVariantKey(form.colorName, form.designName);'],
  ['Use Inventory or WhatsApp Upload to create the fabric listing.', 'Use Parent Fabrics or AI Catalog Studio to create the fabric listing.'],
]);

await patch('src/app/login/EmailOtpLoginClient.tsx', [
  [
`async function resolveRole(fallback: AccountRole): Promise<AccountRole> {
  const response = await fetch('/api/auth/resolve-role', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    role?: AccountRole;
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || 'Unable to open this account.');
  return payload.role || fallback;
}

`,
    '',
  ],
  [
`      const accountRole = result?.isDemo ? fallback : await resolveRole(fallback);
      router.replace(destinationForRole(accountRole));
      router.refresh();`,
`      // signIn already resolves the profile role. Avoid a second API/database round trip and
      // perform a hard navigation so protected middleware sees the new cookie immediately.
      window.location.replace(destinationForRole(fallback));`,
  ],
]);

await patch('src/app/seller-dashboard/components/SellerInventory.tsx', [
  [
    "const categories = ['Silk', 'Cotton', 'Net & Netting', 'Georgette', 'Polyester', 'Handloom', 'Velvet', 'Organza', 'Linen', 'Denim', 'Wool', 'Other'];",
    "const categories = ['Silk', 'Cotton', 'Net & Netting', 'Georgette', 'Polyester', 'Handloom', 'Velvet', 'Organza', 'Linen', 'Denim', 'Wool', 'Lace', 'Satin', 'Other'];",
  ],
  [
    'Draft listings remain private. Active listings need an image URL.',
    'Draft listings remain private. Use AI Catalog Studio for direct image/video uploads and multi-colour products.',
  ],
  [
    "if (form.status === 'active' && !form.image_url.trim()) return 'Add a product image URL before publishing an active listing.';",
    "if (form.status === 'active' && !form.image_url.trim()) return 'Add a product image URL here, or use AI Catalog Studio to upload product media before publishing.';",
  ],
]);

console.log('In-app catalogue source patches applied.');
