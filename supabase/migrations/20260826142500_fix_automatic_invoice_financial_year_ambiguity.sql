-- Automatic invoice functions declared a PL/pgSQL variable named financial_year,
-- which collided with seller_invoice_sequences.financial_year inside ON CONFLICT.
-- Patch both catalogue and bulk invoice functions to use v_financial_year instead.

do $$
declare
  fn text;
  patched text;
  signature regprocedure;
begin
  foreach signature in array array[
    'public.issue_paid_catalog_tax_invoice_system(uuid,text,timestamp with time zone)'::regprocedure,
    'public.issue_paid_bulk_tax_invoice_system(uuid,text,timestamp with time zone)'::regprocedure
  ]
  loop
    select pg_get_functiondef(signature) into fn;
    patched := fn;
    patched := replace(patched, E'  financial_year text;', E'  v_financial_year text;');
    patched := replace(patched, E'  financial_year := right(fy_start::text, 2) || ''-'' || right((fy_start + 1)::text, 2);', E'  v_financial_year := right(fy_start::text, 2) || ''-'' || right((fy_start + 1)::text, 2);');
    patched := replace(patched, E'  values (seller_row.id, financial_year, 1)', E'  values (seller_row.id, v_financial_year, 1)');
    patched := replace(patched, E'  generated_invoice_number := ''FT/'' || financial_year || ''/'' || lpad(sequence_number::text, 6, ''0'');', E'  generated_invoice_number := ''FT/'' || v_financial_year || ''/'' || lpad(sequence_number::text, 6, ''0'');');
    patched := replace(patched, E'    generated_invoice_number, financial_year, seller_row.user_id, ''issued'',', E'    generated_invoice_number, v_financial_year, seller_row.user_id, ''issued'',');

    if patched = fn then
      raise exception 'Invoice function % did not match the expected patch points', signature::text;
    end if;
    if patched like '%  financial_year text;%' or patched like '%values (seller_row.id, financial_year, 1)%' then
      raise exception 'Invoice function % still contains an ambiguous financial_year variable reference', signature::text;
    end if;

    execute patched;
  end loop;
end;
$$;
