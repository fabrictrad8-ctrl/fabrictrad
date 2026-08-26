-- SECURITY DEFINER trigger functions should execute only through their triggers,
-- not as externally callable RPCs through Supabase's exposed public schema.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
  end loop;
end;
$$;
