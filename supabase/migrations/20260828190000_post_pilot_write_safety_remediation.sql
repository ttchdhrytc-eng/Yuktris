BEGIN;

ALTER TABLE public.browser_execution_queue
  ADD COLUMN IF NOT EXISTS interaction_stage text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS interaction_crossed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS browserbase_session_id text,
  ADD COLUMN IF NOT EXISTS persistent_context_id uuid;

ALTER TABLE public.linkedin_write_audit
  ADD COLUMN IF NOT EXISTS interaction_stage text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS interaction_crossed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outcome_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retry_allowed boolean;

CREATE TABLE IF NOT EXISTS public.linkedin_write_interaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  queue_item_id uuid NOT NULL REFERENCES public.browser_execution_queue(id) ON DELETE RESTRICT,
  execution_job_id uuid REFERENCES public.linkedin_execution_jobs(id) ON DELETE RESTRICT,
  write_audit_id uuid REFERENCES public.linkedin_write_audit(id) ON DELETE RESTRICT,
  worker_id text NOT NULL,
  attempt_id uuid NOT NULL,
  browserbase_session_id text,
  persistent_context_id uuid,
  interaction_stage text NOT NULL,
  interaction_crossed boolean NOT NULL DEFAULT false,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(queue_item_id,attempt_id,interaction_stage)
);
ALTER TABLE public.linkedin_write_interaction_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS linkedin_write_interaction_events_member_select ON public.linkedin_write_interaction_events;
CREATE POLICY linkedin_write_interaction_events_member_select ON public.linkedin_write_interaction_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_write_interaction_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_write_interaction_events TO authenticated;
GRANT ALL ON public.linkedin_write_interaction_events TO service_role;

CREATE OR REPLACE FUNCTION public.record_browser_attempt_correlation(
  p_task_id uuid,p_worker_id text,p_attempt_id uuid,p_browserbase_session_id text,p_persistent_context_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required';END IF;
  UPDATE public.browser_execution_queue SET
    browserbase_session_id=nullif(trim(p_browserbase_session_id),''),persistent_context_id=p_persistent_context_id,updated_at=now()
  WHERE id=p_task_id AND status='running' AND worker_id=p_worker_id AND attempt_id=p_attempt_id AND lease_expires_at>now();
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.record_linkedin_write_interaction_stage(
  p_task_id uuid,p_worker_id text,p_attempt_id uuid,p_stage text,p_interaction_crossed boolean,p_evidence jsonb DEFAULT '{}'::jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.browser_execution_queue%ROWTYPE;v_job uuid;v_audit uuid;stages text[]:=ARRAY[
  'not_started','profile_verified','relationship_verified','connect_control_resolved','before_connect_click','connect_clicked',
  'confirmation_present','before_confirmation_click','confirmation_click_attempted','confirmation_clicked','before_message_send',
  'message_send_attempted','message_sent','post_write_verification','terminal'];
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required';END IF;
  IF array_position(stages,p_stage) IS NULL THEN RAISE EXCEPTION 'invalid interaction stage';END IF;
  SELECT * INTO q FROM public.browser_execution_queue WHERE id=p_task_id AND status='running' AND worker_id=p_worker_id
    AND attempt_id=p_attempt_id AND lease_expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false;END IF;
  IF array_position(stages,p_stage)<array_position(stages,q.interaction_stage) THEN RAISE EXCEPTION 'interaction stage regression denied';END IF;
  IF coalesce(q.action_params->>'job_id','')~*'^[0-9a-f-]{36}$' THEN v_job:=(q.action_params->>'job_id')::uuid;END IF;
  SELECT id INTO v_audit FROM public.linkedin_write_audit WHERE task_id=q.id ORDER BY created_at DESC LIMIT 1;
  UPDATE public.browser_execution_queue SET interaction_stage=p_stage,
    interaction_crossed=interaction_crossed OR p_interaction_crossed,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('interaction_stage',p_stage,'interaction_crossed',interaction_crossed OR p_interaction_crossed),updated_at=now()
  WHERE id=q.id;
  IF v_audit IS NOT NULL THEN UPDATE public.linkedin_write_audit SET interaction_stage=p_stage,
    interaction_crossed=interaction_crossed OR p_interaction_crossed,
    outcome_evidence=coalesce(outcome_evidence,'{}'::jsonb)||coalesce(p_evidence,'{}'::jsonb)
    WHERE id=v_audit AND execution_result IS NULL;END IF;
  INSERT INTO public.linkedin_write_interaction_events(workspace_id,linkedin_account_id,queue_item_id,execution_job_id,write_audit_id,
    worker_id,attempt_id,browserbase_session_id,persistent_context_id,interaction_stage,interaction_crossed,evidence)
  VALUES(q.workspace_id,q.account_id,q.id,v_job,v_audit,p_worker_id,p_attempt_id,q.browserbase_session_id,q.persistent_context_id,p_stage,
    q.interaction_crossed OR p_interaction_crossed,coalesce(p_evidence,'{}'::jsonb))
  ON CONFLICT(queue_item_id,attempt_id,interaction_stage) DO NOTHING;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_linkedin_write_outcome(
  p_audit_id uuid,p_result_code text,p_write_verified boolean,p_classification text,p_evidence jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE w public.linkedin_write_audit%ROWTYPE;v_day date;v_result text;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required';END IF;
  SELECT * INTO w FROM public.linkedin_write_audit WHERE id=p_audit_id FOR UPDATE;
  IF NOT FOUND OR w.preflight_result<>'allowed' OR w.execution_result IS NOT NULL THEN RAISE EXCEPTION 'write finalization denied';END IF;
  v_result:=CASE WHEN p_result_code='success' AND p_write_verified THEN 'success' WHEN p_result_code='outcome_unknown' THEN 'outcome_unknown' ELSE 'failed' END;
  UPDATE public.linkedin_write_audit SET execution_completed_at=now(),execution_result=v_result,
    linkedin_classification=left(coalesce(p_classification,'unknown'),80),outcome_evidence=coalesce(p_evidence,'{}'::jsonb),
    interaction_stage='terminal',interaction_crossed=interaction_crossed OR coalesce((p_evidence->>'interaction_crossed')::boolean,false),
    retry_allowed=CASE WHEN v_result='outcome_unknown' THEN false ELSE coalesce((p_evidence->>'retry_allowed')::boolean,false) END
  WHERE id=p_audit_id;
  IF v_result<>'success' THEN
    IF p_classification IN ('verification_required','checkpoint','challenge') THEN UPDATE public.linkedin_accounts SET status='paused',connection_state='requires_action',last_error='LinkedIn verification required' WHERE id=w.linkedin_account_id;END IF;
    RETURN;
  END IF;
  v_day:=(now() AT TIME ZONE coalesce((SELECT timezone FROM public.linkedin_accounts WHERE id=w.linkedin_account_id),'UTC'))::date;
  INSERT INTO public.linkedin_daily_usage(workspace_id,linkedin_account_id,usage_date,connections_sent,messages_sent,total_actions)
  VALUES(w.workspace_id,w.linkedin_account_id,v_day,CASE WHEN w.action_type='connection_request' THEN 1 ELSE 0 END,
    CASE WHEN w.action_type IN('send_message','follow_up_message') THEN 1 ELSE 0 END,1)
  ON CONFLICT(linkedin_account_id,usage_date) DO UPDATE SET connections_sent=public.linkedin_daily_usage.connections_sent+excluded.connections_sent,
    messages_sent=public.linkedin_daily_usage.messages_sent+excluded.messages_sent,total_actions=public.linkedin_daily_usage.total_actions+1,updated_at=now();
  UPDATE public.linkedin_rate_limits SET daily_used=daily_used+1,weekly_used=weekly_used+1,updated_at=now()
    WHERE linkedin_account_id=w.linkedin_account_id AND action_type=w.action_type;
END $$;

CREATE OR REPLACE FUNCTION public.fail_queue_task_with_result(
  p_task_id uuid,p_worker_id text,p_attempt_id uuid,p_error text,p_duration_ms integer,p_retryable boolean,p_result jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.browser_execution_queue%ROWTYPE;v_job uuid;v_next timestamptz;v_status text;v_unknown boolean;
BEGIN
  SELECT * INTO q FROM public.browser_execution_queue WHERE id=p_task_id AND status='running' AND worker_id=p_worker_id
    AND attempt_id=p_attempt_id AND lease_expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'queue claim ownership lost';END IF;
  IF coalesce(q.action_params->>'job_id','')~*'^[0-9a-f-]{36}$' THEN v_job:=(q.action_params->>'job_id')::uuid;END IF;
  v_unknown:=q.interaction_crossed OR coalesce(p_result->>'result_code','')='outcome_unknown';
  IF p_retryable AND NOT v_unknown AND q.retry_count<q.max_retries THEN v_status:='retry';v_next:=now()+least(60*power(2,q.retry_count),3600)*interval '1 second';ELSE v_status:='failed';END IF;
  IF v_unknown THEN p_result:=coalesce(p_result,'{}'::jsonb)||jsonb_build_object('result_code','outcome_unknown','write_verified',false,'retry_allowed',false,'interaction_crossed',true);END IF;
  UPDATE public.browser_execution_queue SET status=v_status,error=p_error,result=coalesce(p_result,'{}'::jsonb),
    retry_count=CASE WHEN v_status='retry' THEN retry_count+1 ELSE retry_count END,next_retry_at=v_next,completed_at=now(),duration_ms=p_duration_ms,
    worker_id=CASE WHEN v_status='retry' THEN NULL ELSE worker_id END,attempt_id=CASE WHEN v_status='retry' THEN NULL ELSE attempt_id END,
    lease_expires_at=NULL,interaction_stage=CASE WHEN v_status='failed' THEN 'terminal' ELSE interaction_stage END,updated_at=now() WHERE id=q.id;
  INSERT INTO public.browser_execution_history(workspace_id,queue_id,action_type,action_params,status,result,error,duration_ms,started_at,completed_at)
  VALUES(q.workspace_id,q.id,q.action_type,q.action_params,v_status,p_result,p_error,p_duration_ms,q.started_at,now());
  IF v_job IS NOT NULL THEN
    UPDATE public.linkedin_execution_jobs SET status=CASE WHEN v_status='retry' THEN 'scheduled' ELSE 'failed' END,
      scheduled_at=CASE WHEN v_status='retry' THEN v_next ELSE scheduled_at END,completed_at=CASE WHEN v_status='failed' THEN now() ELSE NULL END,
      retry_count=CASE WHEN v_status='retry' THEN retry_count+1 ELSE retry_count END,duration_ms=p_duration_ms,error_message=p_error,
      result_payload=coalesce(p_result,'{}'::jsonb)||jsonb_build_object('queue_item_id',q.id,'idempotency_key',q.idempotency_key,'queue_status',v_status,'attempt_id',p_attempt_id),updated_at=now()
    WHERE id=v_job AND workspace_id=q.workspace_id AND status IN('queued','scheduled','running');
    UPDATE public.linkedin_action_history SET action_result=CASE WHEN v_status='retry' THEN 'pending' ELSE 'failed' END,
      response_payload=coalesce(p_result,'{}'::jsonb)||jsonb_build_object('queue_item_id',q.id,'idempotency_key',q.idempotency_key,'queue_status',v_status),
      duration_ms=p_duration_ms,error_message=p_error WHERE execution_job_id=v_job AND workspace_id=q.workspace_id AND action_result='pending';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_linkedin_write_stale_recovery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_job uuid;v_audit uuid;v_evidence jsonb;
BEGIN
  IF OLD.status='running' AND NEW.status IN('retry','failed') AND OLD.interaction_crossed
     AND (OLD.lease_expires_at<=now() OR NEW.worker_id IS NULL OR NEW.attempt_id IS NULL) THEN
    v_evidence:=jsonb_build_object('result_code','outcome_unknown','write_verified',false,'retry_allowed',false,'interaction_crossed',true,
      'interaction_stage',OLD.interaction_stage,'recovery_reason',coalesce(NEW.error,'worker_or_lease_lost_after_interaction'));
    NEW.status:='failed';NEW.next_retry_at:=NULL;NEW.completed_at:=now();NEW.result:=v_evidence;NEW.error:='External interaction boundary crossed before worker ownership was lost';NEW.interaction_stage:='terminal';
    IF coalesce(OLD.action_params->>'job_id','')~*'^[0-9a-f-]{36}$' THEN v_job:=(OLD.action_params->>'job_id')::uuid;END IF;
    SELECT id INTO v_audit FROM public.linkedin_write_audit WHERE task_id=OLD.id AND execution_result IS NULL ORDER BY created_at DESC LIMIT 1;
    IF v_audit IS NOT NULL THEN UPDATE public.linkedin_write_audit SET execution_completed_at=now(),execution_result='outcome_unknown',linkedin_classification='ownership_lost_after_interaction',
      interaction_stage='terminal',interaction_crossed=true,retry_allowed=false,outcome_evidence=v_evidence WHERE id=v_audit;END IF;
    IF v_job IS NOT NULL THEN
      UPDATE public.linkedin_execution_jobs SET status='failed',completed_at=now(),error_message=NEW.error,
        result_payload=v_evidence||jsonb_build_object('queue_item_id',OLD.id,'attempt_id',OLD.attempt_id),updated_at=now() WHERE id=v_job AND status IN('queued','scheduled','running');
      UPDATE public.linkedin_action_history SET action_result='failed',response_payload=v_evidence||jsonb_build_object('queue_item_id',OLD.id),error_message=NEW.error
        WHERE execution_job_id=v_job AND action_result='pending';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_linkedin_write_stale_recovery_trigger ON public.browser_execution_queue;
CREATE TRIGGER guard_linkedin_write_stale_recovery_trigger BEFORE UPDATE OF status ON public.browser_execution_queue
FOR EACH ROW EXECUTE FUNCTION public.guard_linkedin_write_stale_recovery();

REVOKE ALL ON FUNCTION public.record_browser_attempt_correlation(uuid,text,uuid,text,uuid),
 public.record_linkedin_write_interaction_stage(uuid,text,uuid,text,boolean,jsonb),
 public.finalize_linkedin_write_outcome(uuid,text,boolean,text,jsonb),
 public.fail_queue_task_with_result(uuid,text,uuid,text,integer,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_browser_attempt_correlation(uuid,text,uuid,text,uuid),
 public.record_linkedin_write_interaction_stage(uuid,text,uuid,text,boolean,jsonb),
 public.finalize_linkedin_write_outcome(uuid,text,boolean,text,jsonb),
 public.fail_queue_task_with_result(uuid,text,uuid,text,integer,boolean,jsonb) TO service_role;

COMMIT;
