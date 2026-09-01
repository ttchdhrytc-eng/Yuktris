BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.linkedin_production_acceptance_authorizations'::regclass
      AND conname='production_acceptance_target_once'
  ) THEN
    ALTER TABLE public.linkedin_production_acceptance_authorizations
      ADD CONSTRAINT production_acceptance_target_once UNIQUE (
        project_ref,workspace_id,linkedin_account_id,canonical_target_url,action_type
      );
  END IF;
END $$;

COMMIT;
