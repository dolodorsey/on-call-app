-- RLS does not protect TRUNCATE. No authenticated marketplace client should
-- ever hold TRUNCATE on ON CALL or S.O.S. product tables in the shared project.
do $$
declare r record;
begin
  for r in
    select quote_ident(n.nspname) as s, quote_ident(c.relname) as t
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and (c.relname like 'oc\_%' escape '\' or c.relname like 'sos\_%' escape '\')
  loop
    execute format('revoke truncate on table %s.%s from authenticated',r.s,r.t);
  end loop;
end $$;