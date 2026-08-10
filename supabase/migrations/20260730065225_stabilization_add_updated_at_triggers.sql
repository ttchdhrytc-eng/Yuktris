-- Create a shared updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables that have updated_at column but no trigger
DO $$
DECLARE
  t_record RECORD;
BEGIN
  FOR t_record IN
    SELECT t.tablename 
    FROM pg_tables t
    JOIN information_schema.columns c ON c.table_name = t.tablename AND c.table_schema = 'public'
    WHERE t.schemaname = 'public'
      AND c.column_name = 'updated_at'
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger tg
        JOIN pg_class cls ON cls.oid = tg.tgrelid
        WHERE cls.relname = t.tablename AND tg.tgname LIKE '%updated_at%'
      )
  LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t_record.tablename);
      RAISE NOTICE 'Created updated_at trigger on %', t_record.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %: %', t_record.tablename, SQLERRM;
    END;
  END LOOP;
END;
$$;