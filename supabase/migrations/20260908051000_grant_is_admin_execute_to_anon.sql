-- Postgres evaluates every permissive RLS policy on a query, even ones that
-- would not end up granting access. A table combining an is_admin()-gated ALL
-- policy with a public SELECT policy previously 401'd for anon callers,
-- because anon lacked EXECUTE on is_admin() even though the separate public
-- SELECT policy would have independently permitted the read.
grant execute on function public.is_admin() to anon;
