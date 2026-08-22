'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  status: string;
  approval_status: string | null;
};

type CategorySummary = {
  name: string;
  total: number;
  live: number;
  drafts: number;
  archived: number;
};

const COMMON_CATEGORIES = [
  'Cotton', 'Silk', 'Banarasi Silk', 'Raw Silk', 'Chanderi', 'Georgette', 'Chiffon',
  'Organza', 'Velvet', 'Linen', 'Denim', 'Wool', 'Satin', 'Crepe', 'Rayon', 'Viscose',
  'Polyester', 'Nylon', 'Net & Netting', 'Lace', 'Khadi', 'Handloom', 'Muslin', 'Twill',
  'Jacquard', 'Brocade', 'Modal', 'Lyocell', 'Jersey', 'Fleece', 'Canvas', 'Corduroy',
  'Poplin', 'Saree', 'Sherwani', 'Jodhpuri', 'Indo-Western', 'Lehenga', 'Kurta',
  'Shirting', 'Suiting', 'Menswear', 'Womenswear', 'Kidswear', 'Accessory', 'Other',
];

export default function SellerCategories() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!user?.id) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: seller, error: sellerError } = await supabase
      .from('seller_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (sellerError || !seller?.id) {
      setError(sellerError?.message || 'Seller profile is not available.');
      setProducts([]);
      setLoading(false);
      return;
    }

    const { data, error: productError } = await supabase
      .from('seller_products')
      .select('id,name,category,status,approval_status')
      .eq('seller_id', seller.id)
      .order('updated_at', { ascending: false });
    if (productError) {
      setError(productError.message);
      setProducts([]);
    } else {
      setProducts((data || []) as ProductRow[]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const grouped = new Map<string, CategorySummary>();
    products.forEach((product) => {
      const name = String(product.category || 'Other').trim() || 'Other';
      const current = grouped.get(name) || { name, total: 0, live: 0, drafts: 0, archived: 0 };
      current.total += 1;
      if (product.status === 'active' && product.approval_status === 'approved') current.live += 1;
      else if (product.status === 'draft') current.drafts += 1;
      else if (product.status === 'archived') current.archived += 1;
      grouped.set(name, current);
    });
    const normalized = query.trim().toLowerCase();
    return [...grouped.values()]
      .filter((category) => !normalized || category.name.toLowerCase().includes(normalized))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [products, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ft-route-kicker">Categories</p>
          <h1 className="mt-1 text-2xl font-800 text-foreground">Live product categories</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            These counts come directly from your actual seller products. Categories are product labels, so changing a product category immediately updates this page and the marketplace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/seller-product-rules" className="ft-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-xs">
            <Icon name="AdjustmentsHorizontalIcon" size={15} /> Buyer rules & tax
          </Link>
          <Link href="/seller-dashboard?tab=inventory" className="ft-primary-action inline-flex items-center gap-2 px-4 py-2.5 text-xs">
            <Icon name="PencilSquareIcon" size={15} /> Edit product categories
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Icon name="InformationCircleIcon" size={20} className="mt-0.5 text-primary" />
          <div>
            <p className="text-sm font-800 text-foreground">You are not limited to “Other”.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The product editor now shows a real dropdown with common textile and apparel categories, plus a Custom category option. Existing products can be changed from Products → Edit.
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-800 text-foreground">Your catalogue structure</p>
            <p className="mt-1 text-xs text-muted-foreground">{products.length} real product{products.length === 1 ? '' : 's'} across {new Set(products.map((product) => String(product.category || 'Other').trim() || 'Other')).size} categor{new Set(products.map((product) => String(product.category || 'Other').trim() || 'Other')).size === 1 ? 'y' : 'ies'}.</p>
          </div>
          <div className="flex min-h-10 min-w-[220px] items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
            <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-error">{error}</div>}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border border-border bg-muted" />)}
        </div>
      ) : categories.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <article key={category.name} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-base font-800 text-foreground">{category.name}</p><p className="mt-1 text-xs text-muted-foreground">{category.total} product{category.total === 1 ? '' : 's'}</p></div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-800 text-primary">{category.live} live</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-success/10 p-2"><p className="text-lg font-800 text-success">{category.live}</p><p className="text-[10px] text-muted-foreground">Live</p></div>
                <div className="rounded-xl bg-warning/10 p-2"><p className="text-lg font-800 text-warning">{category.drafts}</p><p className="text-[10px] text-muted-foreground">Draft</p></div>
                <div className="rounded-xl bg-muted p-2"><p className="text-lg font-800 text-foreground">{category.archived}</p><p className="text-[10px] text-muted-foreground">Archived</p></div>
              </div>
              <Link href={`/seller-dashboard?tab=inventory`} className="mt-4 inline-flex items-center gap-1 text-xs font-800 text-primary hover:underline">Manage products <Icon name="ArrowRightIcon" size={13} /></Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <Icon name="Squares2X2Icon" size={32} className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-800 text-foreground">{products.length ? 'No categories match your search' : 'No product categories yet'}</p>
          <p className="mt-1 text-xs text-muted-foreground">Add or edit a product to create category labels.</p>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-800 text-foreground">Common category choices available in the editor</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMMON_CATEGORIES.map((category) => <span key={category} className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">{category}</span>)}
        </div>
      </section>
    </div>
  );
}
