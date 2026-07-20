'use client';

import Link from 'next/link';
import { useProduct } from '@/lib/hooks/useProduct';

export default function ProductBreadcrumb() {
  const { product } = useProduct();
  return (
    <nav className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-4 text-sm text-muted-foreground sm:px-6" aria-label="Breadcrumb">
      <Link href="/marketplace" className="shrink-0 hover:text-primary">Marketplace</Link>
      <span>/</span>
      <Link href={`/marketplace?category=${encodeURIComponent(product.category)}`} className="shrink-0 hover:text-primary">{product.category}</Link>
      <span>/</span>
      <span className="truncate font-500 text-foreground" aria-current="page">{product.name}</span>
    </nav>
  );
}
