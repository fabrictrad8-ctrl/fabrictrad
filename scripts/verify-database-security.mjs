import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20260804143000_harden_role_checks_and_private_marketplace.sql', import.meta.url),
  'utf8'
);
const storageMigration = readFileSync(
  new URL('../supabase/migrations/20260804144500_make_product_media_authenticated_only.sql', import.meta.url),
  'utf8'
);
const sellerReviewMigration = readFileSync(
  new URL('../supabase/migrations/20260804151500_protect_seller_review_fields.sql', import.meta.url),
  'utf8'
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(
  migration.includes('from public.user_profiles profile') &&
    migration.includes("profile.role in ('super_admin'::public.user_role, 'admin_staff'::public.user_role)"),
  'Administrator authorization must use the authoritative user_profiles role.'
);
assert(
  !migration.includes("raw_user_meta_data ->> 'role'") &&
    !migration.includes("raw_user_meta_data->>'role'"),
  'Database authorization must never trust user-editable Auth metadata.'
);
assert(
  migration.includes('revoke all on function public.is_admin() from public, anon'),
  'Anonymous callers must not execute the administrator helper.'
);

const privateTables = [
  'seller_profiles',
  'seller_products',
  'seller_product_variants',
  'seller_product_media',
  'seller_reviews',
  'seller_categories',
  'discount_campaigns',
  'buyer_requirements',
];

for (const table of privateTables) {
  assert(
    migration.includes(`revoke select on table public.${table} from anon`),
    `Anonymous SELECT access must be revoked from public.${table}.`
  );
  assert(
    migration.includes(`grant select on table public.${table} to authenticated`),
    `Authenticated marketplace access must remain available for public.${table}.`
  );
}

assert(
  migration.includes('create policy "authenticated_read_active_seller_products"') &&
    migration.includes('create policy "authenticated_read_verified_seller_profiles"'),
  'Marketplace products and sellers must use authenticated-only read policies.'
);
assert(
  storageMigration.includes("set public = false") &&
    storageMigration.includes("where id = 'seller-product-media'"),
  'Product media storage must not expose public object URLs.'
);
assert(
  storageMigration.includes('create policy "authenticated_read_seller_product_media"') &&
    storageMigration.includes('to authenticated'),
  'Signed-in marketplace users must retain product-media access.'
);
assert(
  sellerReviewMigration.match(/security invoker/g)?.length === 4,
  'Seller review protection triggers must run with the calling user permissions.'
);
assert(
  sellerReviewMigration.includes('Seller verification, activation and settlement fields are managed by FabricTrad.') &&
    sellerReviewMigration.includes('Only FabricTrad can approve or reject seller documents.') &&
    sellerReviewMigration.includes('Bank verification and payout linkage are managed by FabricTrad.') &&
    sellerReviewMigration.includes('Only FabricTrad can approve or reject products.'),
  'Seller, document, bank and product review fields must be protected from self-approval.'
);
assert(
  sellerReviewMigration.includes('protect_product_variant_review_fields_trigger'),
  'Product variation approvals must receive the same protection as product approvals.'
);

console.log('Database role, marketplace, media and seller approval security checks passed.');
