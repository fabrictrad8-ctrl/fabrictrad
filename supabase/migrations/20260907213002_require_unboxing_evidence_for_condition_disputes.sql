-- Buyers must supply both an unboxing video AND at least one photo to raise a
-- complaint about the physical condition of what they received (damage or
-- quality). This is enforced at the database level, not just in the UI, so it
-- can never be silently bypassed by a future form change.
alter table public.disputes
  add column if not exists unboxing_photo_urls jsonb not null default '[]'::jsonb,
  add column if not exists has_unboxing_photos boolean not null default false;

alter table public.disputes
  drop constraint if exists disputes_unboxing_evidence_required;
alter table public.disputes
  add constraint disputes_unboxing_evidence_required
  check (
    dispute_type not in ('damage_claim', 'quality_issue')
    or (has_unboxing_video and has_unboxing_photos)
  );
