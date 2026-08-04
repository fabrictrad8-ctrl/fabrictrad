import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20260804143000_harden_role_checks_and_private_marketplace.sql', import.meta.url),
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

console.log('Database role and marketplace privacy checks passed.');
