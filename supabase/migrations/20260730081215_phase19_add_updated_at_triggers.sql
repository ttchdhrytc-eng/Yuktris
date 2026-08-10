/*
# Phase 19 — Add updated_at triggers for all 26 new Production Operations tables

Adds set_updated_at triggers to every table created in Parts 1 and 2.
Uses the existing public.set_updated_at() function.
*/

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'system_logs','application_logs','system_performance_metrics','distributed_traces',
      'queue_jobs','queue_workers','worker_health','cache_metrics','cost_tracking','resource_usage',
      'security_events','security_alerts','mfa_sessions','feature_flags','feature_rollouts',
      'release_versions','deployment_history','environment_configs',
      'backup_jobs','backup_history','restore_history',
      'system_health','system_incidents','incident_timelines','platform_metrics','system_settings'
    )
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = pg_tables.tablename AND table_schema = 'public' AND column_name = 'updated_at')
    AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cls ON cls.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = cls.relnamespace WHERE n.nspname = 'public' AND cls.relname = pg_tables.tablename AND tg.tgname = 'set_updated_at')
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