-- WhatsApp phone identity must resolve to exactly one active FabricTrad
-- account. Buyers and sellers can share one account through capabilities; two
-- active accounts must not claim the same normalized Indian mobile number.

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_active_phone_identity_unique_idx
  ON public.user_profiles (
    (right(regexp_replace(phone, '[^0-9]', '', 'g'), 10))
  )
  WHERE is_active = true
    AND phone IS NOT NULL
    AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) ~ '^[6-9][0-9]{9}$';
