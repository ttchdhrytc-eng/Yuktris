BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,public;

/*
 * last_activity_at is operational liveness only.  It is intentionally touched
 * by worker/session heartbeats and read-only automation.  External-action
 * cooldowns use this separate, monotonic evidence clock.
 */
ALTER TABLE public.linkedin_accounts
  ADD COLUMN IF NOT EXISTS last_external_action_at timestamptz;

COMMENT ON COLUMN public.linkedin_accounts.last_activity_at IS
  'Operational account/session liveness. Never use for LinkedIn write cooldown eligibility.';
COMMENT ON COLUMN public.linkedin_accounts.last_external_action_at IS
  'Monotonic external LinkedIn mutation boundary/outcome evidence used for minimum-write-interval cooldowns.';

/* Preserve cooldown protection for any historical successful or ambiguous write. */
WITH historical_external_action AS (
  SELECT linkedin_account_id, max(coalesce(execution_completed_at,execution_started_at,created_at)) AS occurred_at
  FROM public.linkedin_write_audit
  WHERE execution_result IN ('success','outcome_unknown') OR interaction_crossed IS TRUE
  GROUP BY linkedin_account_id
), historical_boundary AS (
  SELECT linkedin_account_id,max(created_at) AS occurred_at
  FROM public.linkedin_write_interaction_events
  WHERE interaction_crossed IS TRUE
  GROUP BY linkedin_account_id
), evidence AS (
  SELECT linkedin_account_id,max(occurred_at) AS occurred_at FROM (
    SELECT * FROM historical_external_action UNION ALL SELECT * FROM historical_boundary
  ) x GROUP BY linkedin_account_id
)
UPDATE public.linkedin_accounts a
SET last_external_action_at=greatest(coalesce(a.last_external_action_at,'-infinity'::timestamptz),e.occurred_at)
FROM evidence e WHERE e.linkedin_account_id=a.id;

/* Advance at the certified may-mutate boundary, before the external click. */
CREATE OR REPLACE FUNCTION public.advance_linkedin_external_action_from_boundary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.interaction_crossed IS TRUE THEN
    UPDATE public.linkedin_accounts
    SET last_external_action_at=greatest(coalesce(last_external_action_at,'-infinity'::timestamptz),NEW.created_at)
    WHERE id=NEW.linkedin_account_id AND workspace_id=NEW.workspace_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS advance_linkedin_external_action_from_boundary_trigger ON public.linkedin_write_interaction_events;
CREATE TRIGGER advance_linkedin_external_action_from_boundary_trigger
AFTER INSERT ON public.linkedin_write_interaction_events
FOR EACH ROW WHEN (NEW.interaction_crossed IS TRUE)
EXECUTE FUNCTION public.advance_linkedin_external_action_from_boundary();

/* Success and outcome_unknown remain cooldown-protected even on recovery paths. */
CREATE OR REPLACE FUNCTION public.advance_linkedin_external_action_from_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.execution_result IN ('success','outcome_unknown')
     AND (OLD.execution_result IS DISTINCT FROM NEW.execution_result) THEN
    UPDATE public.linkedin_accounts
    SET last_external_action_at=greatest(
      coalesce(last_external_action_at,'-infinity'::timestamptz),
      coalesce(NEW.execution_completed_at,NEW.execution_started_at,now()))
    WHERE id=NEW.linkedin_account_id AND workspace_id=NEW.workspace_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS advance_linkedin_external_action_from_audit_trigger ON public.linkedin_write_audit;
CREATE TRIGGER advance_linkedin_external_action_from_audit_trigger
AFTER UPDATE OF execution_result ON public.linkedin_write_audit
FOR EACH ROW
EXECUTE FUNCTION public.advance_linkedin_external_action_from_audit();

/*
 * Patch every currently effective production cooldown reader in place.  Using
 * pg_get_functiondef preserves all independently certified bindings, limits,
 * scheduling, authorization, and exactly-once logic from the preceding
 * migrations while changing only the misclassified timestamp.
 */
DO $$
DECLARE
  signature regprocedure;
  definition text;
  corrected text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.preflight_linkedin_write_without_acceptance_override(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid)'::regprocedure,
    'public.validate_linkedin_write_deterministic_eligibility(uuid,uuid,uuid,uuid,text,text,text,text,uuid)'::regprocedure,
    'public.preflight_production_linkedin_acceptance_write_without_expected_name(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'::regprocedure
  ] LOOP
    definition:=pg_get_functiondef(signature);
    corrected:=replace(definition,'.last_activity_at','.last_external_action_at');
    IF corrected=definition THEN
      RAISE EXCEPTION 'Expected liveness/cooldown collision not found in %',signature;
    END IF;
    IF corrected LIKE '%.last_activity_at%' THEN
      RAISE EXCEPTION 'Uncorrected liveness timestamp remains in %',signature;
    END IF;
    EXECUTE corrected;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.advance_linkedin_external_action_from_boundary(),
  public.advance_linkedin_external_action_from_audit() FROM PUBLIC,anon,authenticated;

COMMIT;
