BEGIN;

ALTER TABLE public.browser_execution_queue
  ADD COLUMN IF NOT EXISTS infrastructure_retry_count integer NOT NULL DEFAULT 0 CHECK (infrastructure_retry_count >= 0),
  ADD COLUMN IF NOT EXISTS max_infrastructure_retries integer NOT NULL DEFAULT 2 CHECK (max_infrastructure_retries BETWEEN 0 AND 5);

CREATE TABLE IF NOT EXISTS public.linkedin_infrastructure_recovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  queue_item_id uuid NOT NULL REFERENCES public.browser_execution_queue(id) ON DELETE RESTRICT,
  execution_job_id uuid REFERENCES public.linkedin_execution_jobs(id) ON DELETE RESTRICT,
  expired_worker_id text,
  expired_attempt_id uuid,
  interaction_stage text NOT NULL,
  interaction_crossed boolean NOT NULL,
  recovery_number integer NOT NULL,
  disposition text NOT NULL CHECK (disposition IN ('safe_preinteraction_requeue','terminal_preinteraction_exhausted','terminal_outcome_unknown')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS linkedin_infrastructure_recovery_once
  ON public.linkedin_infrastructure_recovery_events(queue_item_id,expired_attempt_id,recovery_number);
ALTER TABLE public.linkedin_infrastructure_recovery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS linkedin_infrastructure_recovery_events_member_select ON public.linkedin_infrastructure_recovery_events;
CREATE POLICY linkedin_infrastructure_recovery_events_member_select ON public.linkedin_infrastructure_recovery_events
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_infrastructure_recovery_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_infrastructure_recovery_events TO authenticated;
GRANT ALL ON public.linkedin_infrastructure_recovery_events TO service_role;

CREATE OR REPLACE FUNCTION public.recover_expired_browser_queue_leases(p_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.browser_execution_queue%ROWTYPE; v_job uuid; v_disposition text; recovered integer:=0;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required';END IF;
  FOR q IN SELECT * FROM public.browser_execution_queue
    WHERE status='running' AND lease_expires_at IS NOT NULL AND lease_expires_at<=now()
    ORDER BY lease_expires_at FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(p_limit,200))
  LOOP
    v_job:=NULL;
    IF coalesce(q.action_params->>'job_id','')~*'^[0-9a-f-]{36}$' THEN v_job:=(q.action_params->>'job_id')::uuid;END IF;
    IF q.interaction_crossed THEN
      v_disposition:='terminal_outcome_unknown';
      UPDATE public.browser_execution_queue SET status='failed',completed_at=now(),next_retry_at=NULL,
        error='External interaction boundary crossed before worker ownership was lost',
        result=jsonb_build_object('result_code','outcome_unknown','write_verified',false,'retry_allowed',false,'interaction_crossed',true,'interaction_stage',q.interaction_stage),
        worker_id=NULL,attempt_id=NULL,lease_expires_at=NULL,interaction_stage='terminal',updated_at=now() WHERE id=q.id;
    ELSIF q.infrastructure_retry_count<q.max_infrastructure_retries THEN
      v_disposition:='safe_preinteraction_requeue';
      UPDATE public.browser_execution_queue SET status='retry',infrastructure_retry_count=infrastructure_retry_count+1,
        next_retry_at=now(),completed_at=NULL,error='Safe infrastructure recovery before external interaction',
        result=jsonb_build_object('result_code','infrastructure_recovery','write_verified',false,'retry_allowed',true,'interaction_crossed',false,'interaction_stage',q.interaction_stage),
        worker_id=NULL,attempt_id=NULL,lease_expires_at=NULL,started_at=NULL,updated_at=now() WHERE id=q.id;
    ELSE
      v_disposition:='terminal_preinteraction_exhausted';
      UPDATE public.browser_execution_queue SET status='failed',completed_at=now(),next_retry_at=NULL,
        error='Infrastructure recovery budget exhausted before external interaction',
        result=jsonb_build_object('result_code','failed','write_verified',false,'retry_allowed',false,'interaction_crossed',false,'interaction_stage',q.interaction_stage,'infrastructure_recovery_exhausted',true),
        worker_id=NULL,attempt_id=NULL,lease_expires_at=NULL,interaction_stage='terminal',updated_at=now() WHERE id=q.id;
    END IF;
    DELETE FROM public.linkedin_account_browser_leases WHERE account_id=q.account_id AND queue_item_id=q.id AND attempt_id=q.attempt_id;
    INSERT INTO public.linkedin_infrastructure_recovery_events(workspace_id,queue_item_id,execution_job_id,expired_worker_id,expired_attempt_id,
      interaction_stage,interaction_crossed,recovery_number,disposition,evidence)
    VALUES(q.workspace_id,q.id,v_job,q.worker_id,q.attempt_id,q.interaction_stage,q.interaction_crossed,
      q.infrastructure_retry_count+CASE WHEN v_disposition='safe_preinteraction_requeue' THEN 1 ELSE 0 END,v_disposition,
      jsonb_build_object('queue_lease_expired_at',q.lease_expires_at,'database_recovered_at',now(),'write_retry_count',q.retry_count,'write_max_retries',q.max_retries));
    IF v_job IS NOT NULL THEN
      UPDATE public.linkedin_execution_jobs SET
        status=CASE WHEN v_disposition='safe_preinteraction_requeue' THEN 'running' ELSE 'failed' END,
        completed_at=CASE WHEN v_disposition='safe_preinteraction_requeue' THEN NULL ELSE now() END,
        error_message=CASE WHEN v_disposition='safe_preinteraction_requeue' THEN 'Safe infrastructure recovery before external interaction' ELSE
          CASE WHEN v_disposition='terminal_outcome_unknown' THEN 'External interaction outcome unknown after ownership loss' ELSE 'Infrastructure recovery budget exhausted before external interaction' END END,
        result_payload=CASE WHEN v_disposition='safe_preinteraction_requeue' THEN result_payload ELSE
          jsonb_build_object('result_code',CASE WHEN v_disposition='terminal_outcome_unknown' THEN 'outcome_unknown' ELSE 'failed' END,'write_verified',false,
            'retry_allowed',false,'interaction_crossed',q.interaction_crossed,'interaction_stage',q.interaction_stage,'queue_item_id',q.id) END,
        updated_at=now() WHERE id=v_job AND status IN('queued','scheduled','running');
    END IF;
    recovered:=recovered+1;
  END LOOP;
  RETURN recovered;
END $$;

CREATE OR REPLACE FUNCTION public.claim_queue_task(p_worker_id text,p_lease_seconds integer DEFAULT 90)
RETURNS TABLE(id uuid,workspace_id uuid,account_id uuid,worker_id text,session_id uuid,agent_id uuid,
 action_type text,action_params jsonb,priority integer,priority_label text,status text,retry_count integer,
 max_retries integer,next_retry_at timestamptz,error text,result jsonb,scheduled_at timestamptz,
 started_at timestamptz,completed_at timestamptz,duration_ms integer,metadata jsonb,created_at timestamptz,
 updated_at timestamptz,attempt_id uuid,lease_expires_at timestamptz,idempotency_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE candidate record; claimed_id uuid; new_attempt uuid; lease_seconds integer:=greatest(60,least(p_lease_seconds,600));
BEGIN
  PERFORM public.recover_expired_browser_queue_leases(50);
  DELETE FROM public.linkedin_account_browser_leases l WHERE l.lease_expires_at<=now();
  FOR candidate IN SELECT q.id,q.workspace_id,q.account_id FROM public.browser_execution_queue q
    WHERE (q.status='pending' AND (q.scheduled_at IS NULL OR q.scheduled_at<=now()))
       OR (q.status='retry' AND q.next_retry_at IS NOT NULL AND q.next_retry_at<=now())
    ORDER BY q.priority,q.created_at FOR UPDATE SKIP LOCKED
  LOOP
    claimed_id:=NULL;new_attempt:=gen_random_uuid();
    IF candidate.account_id IS NOT NULL THEN
      INSERT INTO public.linkedin_account_browser_leases(account_id,workspace_id,queue_item_id,worker_id,attempt_id,lease_expires_at)
      VALUES(candidate.account_id,candidate.workspace_id,candidate.id,p_worker_id,new_attempt,now()+make_interval(secs=>lease_seconds))
      ON CONFLICT ON CONSTRAINT linkedin_account_browser_leases_pkey DO UPDATE SET workspace_id=excluded.workspace_id,
        queue_item_id=excluded.queue_item_id,worker_id=excluded.worker_id,attempt_id=excluded.attempt_id,
        lease_expires_at=excluded.lease_expires_at,updated_at=now()
      WHERE public.linkedin_account_browser_leases.lease_expires_at<=now() RETURNING queue_item_id INTO claimed_id;
      IF claimed_id IS DISTINCT FROM candidate.id THEN CONTINUE;END IF;
    END IF;
    UPDATE public.browser_execution_queue SET status='running',worker_id=p_worker_id,attempt_id=new_attempt,
      lease_expires_at=now()+make_interval(secs=>lease_seconds),started_at=now(),completed_at=NULL,next_retry_at=NULL,
      error=NULL,duration_ms=NULL,result=NULL,updated_at=now() WHERE browser_execution_queue.id=candidate.id RETURNING browser_execution_queue.id INTO claimed_id;
    EXIT;
  END LOOP;
  IF claimed_id IS NULL THEN RETURN;END IF;
  RETURN QUERY SELECT q.id,q.workspace_id,q.account_id,q.worker_id,q.session_id,q.agent_id,q.action_type,q.action_params,q.priority,
    q.priority_label,q.status,q.retry_count,q.max_retries,q.next_retry_at,q.error,q.result,q.scheduled_at,q.started_at,q.completed_at,
    q.duration_ms,q.metadata,q.created_at,q.updated_at,q.attempt_id,q.lease_expires_at,q.idempotency_key
    FROM public.browser_execution_queue q WHERE q.id=claimed_id;
END $$;

REVOKE ALL ON FUNCTION public.recover_expired_browser_queue_leases(integer),public.claim_queue_task(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_expired_browser_queue_leases(integer),public.claim_queue_task(text,integer) TO service_role;

COMMIT;
