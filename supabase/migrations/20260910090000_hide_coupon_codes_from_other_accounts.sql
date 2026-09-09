-- Any signed-in user could read every active campaign row, including the `code`
-- column, so a random buyer could harvest a seller's private, usage-limited
-- coupon codes and burn the redemptions at that seller's expense.
--
-- Rows that carry a code are now visible only to the account that created them
-- and to admins. Auto-applied campaigns (code is null) stay readable, since
-- those are already visible to buyers as an applied discount and the UI uses
-- them to explain automatic offers.
--
-- Redemption is unaffected: resolve_active_discount() is SECURITY DEFINER and
-- bypasses RLS, so entering a valid code still works without the buyer ever
-- needing to SELECT the row. No buyer-facing code reads this table.
drop policy if exists discount_campaigns_authenticated_read on public.discount_campaigns;

create policy discount_campaigns_authenticated_read on public.discount_campaigns
for select
using (
  (
    code is null
    and status = 'active'
    and current_date >= start_date
    and current_date <= end_date
    and (usage_limit is null or usage_count < usage_limit)
  )
  or created_by = auth.uid()
  or public.is_admin()
);
