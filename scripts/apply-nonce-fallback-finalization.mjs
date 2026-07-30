import { readFile, writeFile } from 'node:fs/promises';

async function replace(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Expected block not found in ${path}`);
  await writeFile(path, source.replace(before, after));
}

const migrationPath = 'supabase/migrations/20260730213000_signup_nonce_registration_fallback.sql';
let migration = await readFile(migrationPath, 'utf8');
const validationBlock = `  IF NOT public.is_valid_registration_nonce(p_user_id, p_nonce) THEN\n    RAISE EXCEPTION 'Registration verification expired or invalid' USING ERRCODE = '42501';\n  END IF;\n\n  SELECT * INTO auth_user FROM auth.users WHERE id = p_user_id;`;
const elevatedBlock = `  IF NOT public.is_valid_registration_nonce(p_user_id, p_nonce) THEN\n    RAISE EXCEPTION 'Registration verification expired or invalid' USING ERRCODE = '42501';\n  END IF;\n\n  -- Trigger guards use auth.role(). Elevate only this verified transaction so\n  -- the security-definer functions can create protected onboarding records.\n  PERFORM set_config('request.jwt.claim.role', 'service_role', true);\n\n  SELECT * INTO auth_user FROM auth.users WHERE id = p_user_id;`;
const occurrences = migration.split(validationBlock).length - 1;
if (occurrences !== 2) throw new Error(`Expected two nonce validation blocks, found ${occurrences}`);
migration = migration.replaceAll(validationBlock, elevatedBlock);
await writeFile(migrationPath, migration);

await replace(
  '.github/workflows/quality.yml',
  `            supabase/migrations/20260730212000_catalog_order_inventory_reservation.sql\n          )`,
  `            supabase/migrations/20260730212000_catalog_order_inventory_reservation.sql\n            supabase/migrations/20260730213000_signup_nonce_registration_fallback.sql\n          )`
);

await replace(
  '.github/workflows/quality.yml',
  `          grep -Fq "SET search_path = ''" supabase/migrations/20260730210000_account_role_profile_provisioning.sql\n          grep -Fq 'PENDING_STATUSES.has(seller.status)' src/app/admin-portal/components/AdminSellers.tsx`,
  `          grep -Fq "SET search_path = ''" supabase/migrations/20260730210000_account_role_profile_provisioning.sql\n          grep -Fq 'get_signup_account_by_nonce' src/app/api/auth/provision-account/route.ts\n          grep -Fq 'submit_seller_registration_with_nonce' src/app/api/registration/seller/finalize/route.ts\n          grep -Fq 'CREATE OR REPLACE FUNCTION public.get_signup_account_by_nonce' supabase/migrations/20260730213000_signup_nonce_registration_fallback.sql\n          grep -Fq 'CREATE OR REPLACE FUNCTION public.submit_seller_registration_with_nonce' supabase/migrations/20260730213000_signup_nonce_registration_fallback.sql\n          grep -Fq "set_config('request.jwt.claim.role', 'service_role', true)" supabase/migrations/20260730213000_signup_nonce_registration_fallback.sql\n          grep -Fq 'seller_signup_nonce_document_upload' supabase/migrations/20260730213000_signup_nonce_registration_fallback.sql\n          grep -Fq 'PENDING_STATUSES.has(seller.status)' src/app/admin-portal/components/AdminSellers.tsx`
);

console.log('Nonce fallback finalization patches applied.');
