DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = pg_tables.tablename AND table_schema = 'public' AND column_name = 'updated_at')
    AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cls ON cls.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = cls.relnamespace WHERE n.nspname = 'public' AND cls.relname = pg_tables.tablename AND tg.tgname LIKE '%updated_at%')
  LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t.tablename);
      RAISE NOTICE 'Created updated_at trigger on %', t.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %: %', t.tablename, SQLERRM;
    END;
  END LOOP;
END;
$$;