-- ON CALL-only browser privilege hardening.
-- Remove PostgreSQL capabilities that the browser application does not need while
-- preserving existing SELECT/INSERT/UPDATE/DELETE contracts and RLS behavior.

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND left(c.relname, 3) = 'oc_'
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
      target.schema_name,
      target.table_name
    );
  END LOOP;
END
$$;
