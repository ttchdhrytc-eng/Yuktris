-- Add workspace_id indexes to all tables that have workspace_id but no index
DO $$
DECLARE
  t_record RECORD;
BEGIN
  FOR t_record IN
    SELECT t.tablename
    FROM pg_tables t
    JOIN information_schema.columns c ON c.table_name = t.tablename AND c.table_schema = 'public'
    WHERE t.schemaname = 'public'
      AND c.column_name = 'workspace_id'
      AND NOT EXISTS (
        SELECT 1 FROM pg_indexes i
        WHERE i.schemaname = 'public' AND i.tablename = t.tablename
        AND i.indexdef ILIKE '%workspace_id%'
      )
  LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_workspace_id ON public.%I (workspace_id);', t_record.tablename, t_record.tablename);
      RAISE NOTICE 'Created workspace_id index on %', t_record.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %: %', t_record.tablename, SQLERRM;
    END;
  END LOOP;
END;
$$;