'use client';

import { useEffect, useState } from 'react';
import { mapSellerProductSummary, type CatalogProduct } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const RELATED_LIMIT = 10;
const CANDIDATE_LIMIT = 24;

/** Values that mean "no real category/work signal to filter on". */
const GENERIC_CATEGORY_VALUES = new Set(['', 'other']);
const GENERIC_WORK_VALUES = new Set(['', 'plain', 'not specified', 'not available']);

export type RelatedProductsScope = 'seller' | 'general';

export type RelatedProductsInput = {
  /** The current product's raw seller_products.id (not the `seller-<id>` catalog id). */
  productId: string | null | undefined;
  sellerId: string | null | undefined;
  category: string | null | undefined;
  work: string | null | undefined;
};

/**
 * Finds "more like this" candidates for a product detail page by querying
 * seller_products directly (status=active, approval_status=approved),
 * excluding the current product. Prioritizes, in order:
 *   1. Same seller + same category ("more from this seller")
 *   2. Same seller, any category (still fills out the seller shelf)
 *   3. Same category, any seller ("you may also like")
 *   4. Same work/fabric type, any seller or category
 * stopping as soon as enough candidates are collected, capped at
 * RELATED_LIMIT. Returns no fabricated data: an empty result means no
 * genuine related listings exist.
 *
 * Uses the same lightweight row->card mapping (mapSellerProductSummary) as
 * the marketplace grid, so related-product cards match marketplace cards
 * exactly rather than introducing a second card shape.
 */
export function useRelatedProducts({ productId, sellerId, category, work }: RelatedProductsInput) {
  const { profile } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [scope, setScope] = useState<RelatedProductsScope>('general');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!productId) {
      setProducts([]);
      setScope('general');
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      const supabase = createClient();
      const isIndividualBuyer = profile?.account_kind === 'individual';
      const normalizedCategory = GENERIC_CATEGORY_VALUES.has(String(category || '').trim().toLowerCase())
        ? null
        : String(category).trim();
      const normalizedWork = GENERIC_WORK_VALUES.has(String(work || '').trim().toLowerCase())
        ? null
        : String(work).trim();

      const baseQuery = () => {
        let query = supabase
          .from('seller_products')
          .select('*')
          .eq('status', 'active')
          .eq('approval_status', 'approved')
          .gt('available_quantity', 0)
          .neq('id', productId as string);
        if (isIndividualBuyer) {
          query = query.eq('end_user_enabled', true).in('sale_channel', ['retail', 'both']);
        }
        return query;
      };

      const collected: Record<string, unknown>[] = [];
      const seenIds = new Set<string>();
      const addRows = (rows: Record<string, unknown>[] | null | undefined) => {
        (rows || []).forEach((row) => {
          const id = String(row.id);
          if (seenIds.has(id)) return;
          seenIds.add(id);
          collected.push(row as Record<string, unknown>);
        });
      };

      // Tier 1: same seller + same category — genuine "more from this seller".
      if (sellerId && normalizedCategory && collected.length < RELATED_LIMIT) {
        const { data } = await baseQuery()
          .eq('seller_id', sellerId)
          .eq('category', normalizedCategory)
          .order('updated_at', { ascending: false })
          .limit(CANDIDATE_LIMIT);
        addRows(data);
      }

      // Tier 2: same seller, any category — still fills out the seller shelf.
      if (sellerId && collected.length < RELATED_LIMIT) {
        const { data } = await baseQuery()
          .eq('seller_id', sellerId)
          .order('updated_at', { ascending: false })
          .limit(CANDIDATE_LIMIT);
        addRows(data);
      }

      // Tier 3: same category generally, across sellers.
      if (normalizedCategory && collected.length < RELATED_LIMIT) {
        const { data } = await baseQuery()
          .eq('category', normalizedCategory)
          .order('updated_at', { ascending: false })
          .limit(CANDIDATE_LIMIT);
        addRows(data);
      }

      // Tier 4: same work/fabric type, across sellers and categories.
      if (normalizedWork && collected.length < RELATED_LIMIT) {
        const { data } = await baseQuery()
          .eq('work_type', normalizedWork)
          .order('updated_at', { ascending: false })
          .limit(CANDIDATE_LIMIT);
        addRows(data);
      }

      if (!mounted) return;

      const limited = collected.slice(0, RELATED_LIMIT);
      const sellerIds = [...new Set(limited.map((row) => String(row.seller_id || '')).filter(Boolean))];
      const sellerNames = new Map<string, string>();
      if (sellerIds.length) {
        const { data: sellers } = await supabase
          .from('seller_directory')
          .select('id,display_name,legal_business_name')
          .in('id', sellerIds);
        (sellers || []).forEach((seller) => {
          sellerNames.set(seller.id, seller.display_name || seller.legal_business_name || 'Verified FabricTrad Seller');
        });
      }

      if (!mounted) return;

      const mapped = limited.map((row) =>
        mapSellerProductSummary(row, sellerNames.get(String(row.seller_id || '')) || 'Verified FabricTrad Seller')
      );
      const allFromSameSeller =
        Boolean(sellerId) && mapped.length > 0 && mapped.every((item) => item.sellerId === sellerId);

      setProducts(mapped);
      setScope(allFromSameSeller ? 'seller' : 'general');
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [productId, sellerId, category, work, profile?.account_kind]);

  return { products, loading, scope };
}
