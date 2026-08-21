-- Keep the database as the approval authority while accepting seller clients
-- that still send approval_status='approved' when the seller presses Publish.
-- Such attempts are normalized to a review submission instead of being allowed
-- to self-approve or rejected with a misleading environment error.
create or replace function public.protect_product_review_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.admin_review_notes is not null then
      raise exception 'Product review notes are managed by FabricTrad.' using errcode = '42501';
    end if;

    -- Older/current seller clients used "approved" as a publish intent. Do not
    -- let a seller approve their own listing; convert it to the review queue.
    if new.approval_status = 'approved' then
      new.approval_status := 'pending';
    end if;

    if new.approval_status not in ('not_submitted', 'pending') then
      raise exception 'Product approval fields are managed by FabricTrad.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.admin_review_notes is distinct from old.admin_review_notes then
    raise exception 'Product review notes are managed by FabricTrad.' using errcode = '42501';
  end if;

  if new.approval_status = 'approved'
     and new.approval_status is distinct from old.approval_status then
    -- Treat seller-side "approve" as resubmission for review, never approval.
    new.approval_status := 'pending';
  elsif new.approval_status = 'rejected'
     and new.approval_status is distinct from old.approval_status then
    raise exception 'Only FabricTrad can approve or reject products.' using errcode = '42501';
  end if;

  return new;
end;
$$;
