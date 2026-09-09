-- Recover only stranded, never-started initial acquisition. No jobs or browser work
-- are created by this migration; the bounded maintenance tick owns recovery.
UPDATE public.icps i SET next_refresh_at = now()
WHERE i.prospecting_status = 'queued' AND i.acquisition_phase = 'initial_acquisition'
  AND i.initial_acquisition_batches_completed = 0 AND i.next_refresh_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.prospect_replenishment_jobs j
    WHERE j.icp_id = i.id AND j.status IN ('queued','processing','cooldown'));

-- Service-only: caller authorization remains in linkedin-v1-pipeline.
-- Serialize the durable handoff on the ICP; retain the existing unique active-job
-- index and claim/lease function. Sender identity is not an inventory prerequisite.
CREATE OR REPLACE FUNCTION public.enqueue_prospect_replenishment(
  p_workspace_id uuid, p_icp_id uuid, p_reason text DEFAULT 'scheduled_refresh'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.icps%ROWTYPE; j public.prospect_replenishment_jobs%ROWTYPE; stamp timestamptz; key text;
BEGIN
  SELECT * INTO i FROM public.icps WHERE id=p_icp_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'icp_not_found'; END IF;
  IF p_reason NOT IN ('onboarding_confirmed','icp_activated','targeting_changed','inventory_below_threshold','scheduled_refresh','explicit_activation') THEN
    RAISE EXCEPTION 'invalid_replenishment_reason';
  END IF;
  SELECT * INTO j FROM public.prospect_replenishment_jobs
    WHERE icp_id=i.id AND status IN ('queued','processing','cooldown') LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('job_id',j.id,'duplicate_trigger_coalesced',true); END IF;
  IF p_reason='scheduled_refresh' AND
    (i.prospecting_status NOT IN ('queued','up_to_date') OR i.next_refresh_at IS NULL OR i.next_refresh_at>now()) THEN
    RETURN jsonb_build_object('job_id',null);
  END IF;
  stamp := CASE WHEN p_reason='targeting_changed' THEN now() ELSE coalesce(i.next_refresh_at, now()) END;
  -- A stable scheduled epoch prevents a second job in the completion/update gap.
  key := i.id::text || ':inventory:' || stamp::text;
  INSERT INTO public.prospect_replenishment_jobs(workspace_id,icp_id,linkedin_account_id,idempotency_key,reason)
    VALUES(p_workspace_id,i.id,NULL,key,p_reason)
    ON CONFLICT DO NOTHING RETURNING * INTO j;
  IF NOT FOUND THEN
    SELECT * INTO j FROM public.prospect_replenishment_jobs
      WHERE icp_id=i.id AND (status IN ('queued','processing','cooldown') OR idempotency_key=key)
      ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'replenishment_enqueue_failed'; END IF;
    RETURN jsonb_build_object('job_id',j.id,'duplicate_trigger_coalesced',true);
  END IF;
  UPDATE public.icps SET prospecting_status='queued', discovery_error=NULL, next_refresh_at=stamp,
    acquisition_phase=CASE WHEN p_reason='targeting_changed' THEN 'initial_acquisition' ELSE acquisition_phase END,
    initial_acquisition_batches_completed=CASE WHEN p_reason='targeting_changed' THEN 0 ELSE initial_acquisition_batches_completed END
    WHERE id=i.id;
  RETURN jsonb_build_object('job_id',j.id,'duplicate_trigger_coalesced',false);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_prospect_replenishment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_prospect_replenishment(uuid,uuid,text) TO service_role;

-- Bounded due-state query, not a workspace/account scan. Active jobs suppress
-- fresh ICP scheduling, including processing leases and future cooldowns.
CREATE OR REPLACE FUNCTION public.due_prospect_replenishment_workspaces()
RETURNS TABLE(workspace_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH due_jobs AS (
    SELECT j.workspace_id, j.next_attempt_at AS due_at FROM public.prospect_replenishment_jobs j
    WHERE j.status IN ('queued','cooldown') AND j.next_attempt_at<=now()
    ORDER BY j.next_attempt_at,j.id LIMIT 100
  ), due_icps AS (
    SELECT i.workspace_id, i.next_refresh_at AS due_at FROM public.icps i
    WHERE i.prospecting_status IN ('queued','up_to_date') AND i.next_refresh_at<=now()
      AND NOT EXISTS (SELECT 1 FROM public.prospect_replenishment_jobs j
        WHERE j.icp_id=i.id AND j.status IN ('queued','processing','cooldown'))
    ORDER BY i.next_refresh_at,i.id LIMIT 100
  )
  SELECT d.workspace_id FROM (SELECT * FROM due_jobs UNION ALL SELECT * FROM due_icps) d
  GROUP BY d.workspace_id ORDER BY min(d.due_at),d.workspace_id LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.due_prospect_replenishment_workspaces() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.due_prospect_replenishment_workspaces() TO service_role;

-- Use the same eligibility rule inside a workspace so a future cooldown or
-- processing job cannot hide another due ICP from this bounded tick.
CREATE OR REPLACE FUNCTION public.due_prospect_replenishment_icp(p_workspace_id uuid)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT i.id FROM public.icps i WHERE i.workspace_id=p_workspace_id
    AND i.prospecting_status IN ('queued','up_to_date') AND i.next_refresh_at<=now()
    AND NOT EXISTS (SELECT 1 FROM public.prospect_replenishment_jobs j
      WHERE j.icp_id=i.id AND j.status IN ('queued','processing','cooldown'))
    ORDER BY i.next_refresh_at,i.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.due_prospect_replenishment_icp(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.due_prospect_replenishment_icp(uuid) TO service_role;
