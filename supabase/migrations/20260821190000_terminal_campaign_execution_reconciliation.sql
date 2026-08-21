/* Deterministically close stale-running campaigns whose executable work is terminal. */
CREATE OR REPLACE FUNCTION public.reconcile_customer_campaign_execution_state(
  p_workspace_id uuid,
  p_campaign_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE changed integer := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Workspace access denied';
  END IF;

  WITH terminal_campaigns AS (
    SELECT c.id
    FROM public.customer_campaigns c
    WHERE c.workspace_id=p_workspace_id
      AND (p_campaign_id IS NULL OR c.id=p_campaign_id)
      AND c.status='running'
      AND EXISTS (
        SELECT 1 FROM public.linkedin_execution_jobs j
        WHERE j.workspace_id=c.workspace_id AND j.action_payload->>'source_campaign_id'=c.id::text
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.linkedin_execution_jobs j
        WHERE j.workspace_id=c.workspace_id AND j.action_payload->>'source_campaign_id'=c.id::text
          AND j.status IN ('queued','scheduled','retry','retrying','running','pending')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.linkedin_execution_jobs j
        WHERE j.workspace_id=c.workspace_id AND j.action_payload->>'source_campaign_id'=c.id::text
          AND j.status='completed'
      )
  ), terminal_jobs AS (
    UPDATE public.linkedin_execution_jobs j
    SET scheduled_at=NULL,
        max_retries=least(max_retries,retry_count),
        updated_at=now()
    FROM terminal_campaigns tc
    WHERE j.workspace_id=p_workspace_id
      AND j.action_payload->>'source_campaign_id'=tc.id::text
      AND j.status IN ('failed','cancelled','paused')
    RETURNING j.id,j.sequence_id
  ), stopped_states AS (
    UPDATE public.linkedin_sequence_state ss
    SET step_status='stopped', stopped_reason='parent_execution_failed', next_action_at=NULL,
        completed_at=coalesce(completed_at,now()), updated_at=now()
    WHERE ss.workspace_id=p_workspace_id
      AND EXISTS (SELECT 1 FROM terminal_jobs tj WHERE tj.sequence_id=ss.sequence_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.linkedin_execution_jobs active
        WHERE active.workspace_id=ss.workspace_id AND active.sequence_id=ss.sequence_id
          AND active.status IN ('queued','scheduled','retry','retrying','running','pending','completed')
      )
    RETURNING ss.sequence_id
  ), stopped_sequences AS (
    UPDATE public.linkedin_sequences s SET status='paused',updated_at=now()
    WHERE s.workspace_id=p_workspace_id AND EXISTS (SELECT 1 FROM stopped_states x WHERE x.sequence_id=s.id)
    RETURNING s.id
  ), stopped_queues AS (
    UPDATE public.browser_execution_queue q
    SET status=CASE WHEN q.status='completed' THEN q.status ELSE 'failed' END,
        scheduled_at=NULL,next_retry_at=NULL,max_retries=least(max_retries,retry_count),updated_at=now()
    WHERE q.workspace_id=p_workspace_id
      AND q.status<>'completed'
      AND EXISTS (SELECT 1 FROM terminal_jobs tj WHERE q.action_params->>'job_id'=tj.id::text)
    RETURNING q.id
  )
  UPDATE public.customer_campaigns c
  SET status='failed',
      status_reason='Discovery completed, but no LinkedIn action succeeded and no executable work remains.',
      failure_code='all_initial_actions_failed',
      blocker='Review campaign prospects before explicitly preparing new outreach.',
      updated_at=now()
  FROM terminal_campaigns tc
  WHERE c.id=tc.id;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_customer_campaign_execution_state(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_customer_campaign_execution_state(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.reconcile_customer_campaign_after_job_terminal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE source_id uuid;
BEGIN
  IF NEW.status IN ('failed','cancelled','paused','completed')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    BEGIN source_id := (NEW.action_payload->>'source_campaign_id')::uuid;
    EXCEPTION WHEN OTHERS THEN source_id := NULL; END;
    IF source_id IS NOT NULL THEN
      PERFORM public.reconcile_customer_campaign_execution_state(NEW.workspace_id,source_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reconcile_customer_campaign_after_job_terminal_trigger ON public.linkedin_execution_jobs;
CREATE TRIGGER reconcile_customer_campaign_after_job_terminal_trigger
AFTER UPDATE OF status ON public.linkedin_execution_jobs
FOR EACH ROW EXECUTE FUNCTION public.reconcile_customer_campaign_after_job_terminal();

SELECT public.reconcile_customer_campaign_execution_state(
  'dadeb070-8381-4fb7-906c-33cf8e3da198'::uuid,
  'f4ee741d-f3b8-47b8-ba67-770f44b58c00'::uuid
);
