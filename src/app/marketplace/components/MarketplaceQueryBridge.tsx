'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const categoryMap: Record<string, string> = {
  'net-embroidered': 'Net & Netting',
  cotton: 'Cotton',
  silk: 'Silk',
  georgette: 'Georgette',
  'georgette-chiffon': 'Georgette',
  polyester: 'Polyester',
  linen: 'Linen',
  velvet: 'Velvet',
  denim: 'Denim',
  'denim-suiting': 'Denim',
  organza: 'Organza',
  wool: 'Wool',
  'wool-blends': 'Wool',
  'digital-print': 'Digital Print',
  khadi: 'Handloom',
  'khadi-handloom': 'Handloom',
};

const vendorMap: Record<string, string> = {
  v1: 'Surat Textile Mills Pvt Ltd',
  v2: 'Bhiwandi Weave House',
  v3: 'Jaipur Crafts Emporium',
  v4: 'Varanasi Silk Traders',
  v5: 'Kutch Khadi Gramodyog',
  v6: 'Ahmedabad Denim Works',
};

export default function MarketplaceQueryBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const legacyCategory = searchParams.get('category');
    const legacySeller = searchParams.get('seller');
    if (!legacyCategory && !legacySeller) return;

    const next = new URLSearchParams(searchParams.toString());

    if (legacyCategory) {
      const normalized = categoryMap[legacyCategory.toLowerCase()] || legacyCategory.replace(/[-_]+/g, ' ');
      next.delete('category');
      if (normalized === 'Digital Print') {
        next.set('work', normalized);
      } else {
        next.set('fabricType', normalized);
      }
    }

    if (legacySeller) {
      next.delete('seller');
      next.set('search', vendorMap[legacySeller] || legacySeller);
    }

    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
