BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

CREATE TABLE public.linkedin_production_acceptance_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_ref text NOT NULL CHECK (project_ref = 'aljpmtuekghwzrnuwkat'),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE RESTRICT,
  persistent_context_id uuid NOT NULL REFERENCES public.linkedin_browser_contexts(id) ON DELETE RESTRICT,
  provider_context_id text NOT NULL,
  canonical_target_url text NOT NULL,
  action_type text NOT NULL CHECK (action_type = 'connection_request'),
  idempotency_key text NOT NULL UNIQUE,
  approval_reference text NOT NULL,
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN (
    'prepared','armed','executing','succeeded','failed','outcome_unknown','expired','revoked'
  )),
  expires_at timestamptz NOT NULL,
  queue_item_id uuid UNIQUE REFERENCES public.browser_execution_queue(id) ON DELETE RESTRICT,
  worker_id text,
  attempt_id uuid,
  preflighted_at timestamptz,
  consumed_at timestamptz,
  completed_at timestamptz,
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_acceptance_canonical_target CHECK (
    canonical_target_url ~ '^https://www[.]linkedin[.]com/in/[A-Za-z0-9%_-]+$'
  ),
  CONSTRAINT production_acceptance_expiry CHECK (expires_at > created_at),
  CONSTRAINT production_acceptance_target_once UNIQUE (
    project_ref,workspace_id,linkedin_account_id,canonical_target_url,action_type
  )
);

CREATE UNIQUE INDEX one_active_production_linkedin_acceptance
  ON public.linkedin_production_acceptance_authorizations(project_ref)
  WHERE status IN ('prepared','armed','executing');

ALTER TABLE public.linkedin_production_acceptance_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_production_acceptance_authorizations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.linkedin_production_acceptance_authorizations TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_production_linkedin_acceptance(
  p_project_ref text,
  p_workspace_id uuid,
  p_account_id uuid,
  p_canonical_target_url text,
  p_expires_at timestamptz,
  p_approval_reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_accounts%ROWTYPE; c public.linkedin_browser_contexts%ROWTYPE; v_id uuid; v_target text;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  IF p_project_ref <> 'aljpmtuekghwzrnuwkat' THEN RAISE EXCEPTION 'production_project_binding_mismatch'; END IF;
  v_target:=lower(regexp_replace(trim(p_canonical_target_url),'/+$',''));
  IF v_target !~ '^https://www[.]linkedin[.]com/in/[a-z0-9%_-]+$' THEN RAISE EXCEPTION 'exact_canonical_linkedin_profile_url_required'; END IF;
  IF p_expires_at <= now()+interval '5 minutes' OR p_expires_at > now()+interval '24 hours' THEN RAISE EXCEPTION 'acceptance_expiration_out_of_range'; END IF;
  IF nullif(trim(p_approval_reference),'') IS NULL THEN RAISE EXCEPTION 'explicit_human_approval_reference_required'; END IF;
  SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND OR a.status<>'active' OR a.connection_state<>'connected' OR a.session_status<>'connected'
     OR a.health_status<>'healthy' THEN RAISE EXCEPTION 'sender_account_not_healthy_connected'; END IF;
  SELECT * INTO c FROM public.linkedin_browser_contexts
    WHERE workspace_id=p_workspace_id AND account_id=p_account_id AND status='active'
      AND provider='browserbase' AND provider_context_id IS NOT NULL AND deleted_at IS NULL
    ORDER BY generation DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reusable_production_browser_context_required'; END IF;
  INSERT INTO public.linkedin_production_acceptance_authorizations(
    project_ref,workspace_id,linkedin_account_id,persistent_context_id,provider_context_id,
    canonical_target_url,action_type,idempotency_key,approval_reference,expires_at
  ) VALUES(
    p_project_ref,p_workspace_id,p_account_id,c.id,c.provider_context_id,v_target,'connection_request',
    'production-acceptance:'||gen_random_uuid()::text,trim(p_approval_reference),p_expires_at
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('authorization_id',v_id,'status','prepared','executable',false,'expires_at',p_expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.arm_production_linkedin_acceptance(p_authorization_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE; q_id uuid;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_authorization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'production_acceptance_authorization_not_found'; END IF;
  IF a.status<>'prepared' OR a.queue_item_id IS NOT NULL OR a.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'production_acceptance_not_prepared'; END IF;
  IF a.expires_at<=now() THEN UPDATE public.linkedin_production_acceptance_authorizations SET status='expired',updated_at=now() WHERE id=a.id; RAISE EXCEPTION 'production_acceptance_expired'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_browser_contexts c WHERE c.id=a.persistent_context_id
      AND c.workspace_id=a.workspace_id AND c.account_id=a.linkedin_account_id AND c.provider_context_id=a.provider_context_id
      AND c.status='active' AND c.deleted_at IS NULL) THEN RAISE EXCEPTION 'bound_browser_context_not_reusable'; END IF;
  INSERT INTO public.browser_execution_queue(
    workspace_id,account_id,action_type,action_params,priority,priority_label,status,max_retries,
    max_infrastructure_retries,scheduled_at,idempotency_key,metadata
  ) VALUES(
    a.workspace_id,a.linkedin_account_id,'connection_request',jsonb_build_object(
      'profile_url',a.canonical_target_url,
      'production_acceptance_authorization_id',a.id,
      'persistent_context_required',true,
      'acceptance_test_mode',true
    ),1,'critical','pending',0,0,now(),a.idempotency_key,jsonb_build_object(
      'purpose','production_single_action_acceptance','normal_campaign_outbound',false
    )
  ) RETURNING id INTO q_id;
  UPDATE public.linkedin_production_acceptance_authorizations SET status='armed',queue_item_id=q_id,updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('authorization_id',a.id,'queue_item_id',q_id,'status','armed');
END $$;

CREATE OR REPLACE FUNCTION public.claim_production_linkedin_acceptance_task(
  p_worker_id text,p_authorization_id uuid,p_lease_seconds integer DEFAULT 90
) RETURNS TABLE(id uuid,workspace_id uuid,account_id uuid,worker_id text,session_id uuid,agent_id uuid,
 action_type text,action_params jsonb,priority integer,priority_label text,status text,retry_count integer,
 max_retries integer,next_retry_at timestamptz,error text,result jsonb,scheduled_at timestamptz,
 started_at timestamptz,completed_at timestamptz,duration_ms integer,metadata jsonb,created_at timestamptz,
 updated_at timestamptz,attempt_id uuid,lease_expires_at timestamptz,idempotency_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE; q public.browser_execution_queue%ROWTYPE;
  v_attempt uuid:=gen_random_uuid(); v_lease integer:=greatest(60,least(p_lease_seconds,600)); claimed uuid;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  IF NOT public.is_process_unique_worker_identity(p_worker_id) THEN RAISE EXCEPTION 'invalid_process_unique_worker_identity'; END IF;
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE linkedin_production_acceptance_authorizations.id=p_authorization_id FOR UPDATE;
  IF NOT FOUND OR a.status<>'armed' OR a.queue_item_id IS NULL OR a.consumed_at IS NOT NULL THEN RETURN; END IF;
  IF a.expires_at<=now() THEN
    UPDATE public.linkedin_production_acceptance_authorizations SET status='expired',updated_at=now() WHERE linkedin_production_acceptance_authorizations.id=a.id;
    UPDATE public.browser_execution_queue SET status='cancelled',error='Production acceptance authorization expired',completed_at=now(),updated_at=now() WHERE browser_execution_queue.id=a.queue_item_id AND browser_execution_queue.status='pending';
    RETURN;
  END IF;
  SELECT * INTO q FROM public.browser_execution_queue WHERE browser_execution_queue.id=a.queue_item_id FOR UPDATE;
  IF NOT FOUND OR q.status<>'pending' OR q.action_type<>'connection_request' OR q.account_id<>a.linkedin_account_id
     OR q.workspace_id<>a.workspace_id OR q.idempotency_key<>a.idempotency_key
     OR q.action_params->>'production_acceptance_authorization_id'<>a.id::text
     OR lower(trim(q.action_params->>'profile_url'))<>a.canonical_target_url OR q.max_retries<>0 OR q.max_infrastructure_retries<>0 THEN
    UPDATE public.linkedin_production_acceptance_authorizations SET status='failed',outcome=jsonb_build_object('code','queue_binding_mismatch'),completed_at=now(),updated_at=now() WHERE linkedin_production_acceptance_authorizations.id=a.id;
    RETURN;
  END IF;
  DELETE FROM public.linkedin_account_browser_leases l WHERE l.lease_expires_at<=now();
  INSERT INTO public.linkedin_account_browser_leases(account_id,workspace_id,queue_item_id,worker_id,attempt_id,lease_expires_at)
  VALUES(a.linkedin_account_id,a.workspace_id,q.id,p_worker_id,v_attempt,now()+make_interval(secs=>v_lease))
  ON CONFLICT ON CONSTRAINT linkedin_account_browser_leases_pkey DO UPDATE SET workspace_id=excluded.workspace_id,
    queue_item_id=excluded.queue_item_id,worker_id=excluded.worker_id,attempt_id=excluded.attempt_id,
    lease_expires_at=excluded.lease_expires_at,updated_at=now()
  WHERE public.linkedin_account_browser_leases.lease_expires_at<=now() RETURNING queue_item_id INTO claimed;
  IF claimed IS DISTINCT FROM q.id THEN RETURN; END IF;
  UPDATE public.browser_execution_queue SET status='running',worker_id=p_worker_id,attempt_id=v_attempt,
    lease_expires_at=now()+make_interval(secs=>v_lease),started_at=now(),updated_at=now() WHERE browser_execution_queue.id=q.id;
  UPDATE public.linkedin_production_acceptance_authorizations SET status='executing',worker_id=p_worker_id,
    attempt_id=v_attempt,updated_at=now() WHERE linkedin_production_acceptance_authorizations.id=a.id;
  RETURN QUERY SELECT x.id,x.workspace_id,x.account_id,x.worker_id,x.session_id,x.agent_id,x.action_type,x.action_params,
    x.priority,x.priority_label,x.status,x.retry_count,x.max_retries,x.next_retry_at,x.error,x.result,x.scheduled_at,
    x.started_at,x.completed_at,x.duration_ms,x.metadata,x.created_at,x.updated_at,x.attempt_id,x.lease_expires_at,x.idempotency_key
    FROM public.browser_execution_queue x WHERE x.id=q.id;
END $$;

CREATE OR REPLACE FUNCTION public.preflight_production_linkedin_acceptance_write(
  p_task_id uuid,p_attempt_id uuid,p_workspace_id uuid,p_account_id uuid,p_action_type text,p_target text,
  p_idempotency_key text,p_project_ref text,p_campaign_id uuid DEFAULT NULL,p_contact_id uuid DEFAULT NULL,
  p_authorization_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE; account public.linkedin_accounts%ROWTYPE;
  c public.linkedin_browser_contexts%ROWTYPE; h public.linkedin_account_health%ROWTYPE;
  u public.linkedin_daily_usage%ROWTYPE; r public.linkedin_rate_limits%ROWTYPE;
  result jsonb; v_code text:='allowed'; v_audit uuid; v_semantic text; v_local timestamp;
  v_day text; v_used integer; v_limit integer; v_total_limit integer;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_authorization_id FOR UPDATE;
  IF NOT FOUND OR a.status<>'executing' OR a.queue_item_id<>p_task_id OR a.workspace_id<>p_workspace_id
     OR a.linkedin_account_id<>p_account_id OR a.action_type<>p_action_type OR a.action_type<>'connection_request'
     OR a.canonical_target_url<>lower(trim(p_target)) OR a.idempotency_key<>p_idempotency_key
     OR a.project_ref<>p_project_ref OR a.expires_at<=now() OR a.attempt_id<>p_attempt_id
     OR a.preflighted_at IS NOT NULL OR a.consumed_at IS NOT NULL OR p_campaign_id IS NOT NULL OR p_contact_id IS NOT NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','production_acceptance_binding_denied','already_done',coalesce(a.consumed_at IS NOT NULL,false));
  END IF;
  SELECT * INTO c FROM public.linkedin_browser_contexts WHERE id=a.persistent_context_id AND workspace_id=a.workspace_id
    AND account_id=a.linkedin_account_id AND provider_context_id=a.provider_context_id AND status IN('active','in_use') AND deleted_at IS NULL;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_task_id
      AND q.persistent_context_id=a.persistent_context_id AND q.status='running' AND q.attempt_id=p_attempt_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','bound_browser_context_not_reused','already_done',false);
  END IF;
  UPDATE public.linkedin_production_acceptance_authorizations SET preflighted_at=now(),consumed_at=now(),updated_at=now() WHERE id=a.id;
  SELECT * INTO account FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_ownership_denied'; END IF;
  v_semantic:=encode(extensions.digest(concat_ws(E'\x1f',p_workspace_id,p_account_id,p_action_type,lower(trim(p_target)),p_idempotency_key),'sha256'),'hex');
  SELECT id INTO v_audit FROM public.linkedin_write_audit WHERE semantic_key=v_semantic;
  IF FOUND THEN
    result:=jsonb_build_object('allowed',false,'code','duplicate_action','audit_id',v_audit,'already_done',
      EXISTS(SELECT 1 FROM public.linkedin_write_audit WHERE id=v_audit AND execution_result='success'));
  ELSE
    IF account.status='paused' THEN v_code:='account_paused';
    ELSIF account.connection_state='requires_action' THEN v_code:='verification_required';
    ELSIF account.status IN('restricted','banned') OR account.connection_status='restricted' THEN v_code:='linkedin_restricted';
    ELSIF account.connection_status='cooldown' THEN v_code:='cooldown_active';
    ELSIF account.connection_state<>'connected' OR account.session_status<>'connected' OR account.health_status<>'healthy' THEN v_code:='verification_required';
    ELSIF coalesce(account.risk_score,0)>0.7 THEN v_code:='linkedin_restricted';
    ELSIF account.actions_this_hour>=account.hourly_action_limit THEN v_code:='hourly_limit_reached'; END IF;
    SELECT * INTO h FROM public.linkedin_account_health WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id ORDER BY updated_at DESC LIMIT 1;
    IF v_code='allowed' AND FOUND AND(h.health_status IN('critical','down') OR h.cooldown_until>now()) THEN
      v_code:=CASE WHEN h.cooldown_until>now() THEN 'cooldown_active' ELSE 'linkedin_restricted' END;
    END IF;
    SELECT * INTO r FROM public.linkedin_rate_limits WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id AND action_type='connection_request' FOR UPDATE;
    IF v_code='allowed' AND FOUND AND r.cooldown_until>now() THEN v_code:='cooldown_active';
    ELSIF v_code='allowed' AND FOUND AND(r.daily_used>=r.daily_limit OR r.weekly_used>=r.weekly_limit) THEN v_code:='rate_limited'; END IF;
    v_local:=now() AT TIME ZONE coalesce(account.timezone,'UTC');
    v_day:=lower(trim(to_char(v_local,'Day')));
    IF v_code='allowed' AND(NOT v_day=ANY(coalesce(account.working_days,'{}'))
      OR v_local::time<account.working_hours_start::time OR v_local::time>=account.working_hours_end::time) THEN v_code:='outside_working_hours'; END IF;
    SELECT * INTO u FROM public.linkedin_daily_usage WHERE linkedin_account_id=p_account_id AND usage_date=v_local::date FOR UPDATE;
    v_used:=coalesce(u.connections_sent,0); v_limit:=account.daily_connection_limit;
    v_total_limit:=coalesce((account.metadata->>'daily_total_action_limit')::integer,account.daily_connection_limit+account.daily_message_limit);
    IF v_code='allowed' AND(v_used>=v_limit OR coalesce(u.total_actions,0)>=v_total_limit) THEN v_code:='daily_limit_reached'; END IF;
    IF v_code='allowed' AND account.last_activity_at IS NOT NULL
      AND account.last_activity_at+make_interval(secs=>coalesce((account.metadata->>'minimum_write_interval_seconds')::integer,30))>now() THEN v_code:='cooldown_active'; END IF;
    INSERT INTO public.linkedin_write_audit(task_id,workspace_id,linkedin_account_id,idempotency_key,semantic_key,
      target_identifier,action_type,preflight_result,execution_started_at)
    VALUES(p_task_id,p_workspace_id,p_account_id,p_idempotency_key,v_semantic,a.canonical_target_url,'connection_request',v_code,
      CASE WHEN v_code='allowed' THEN now() END) RETURNING id INTO v_audit;
    result:=jsonb_build_object('allowed',v_code='allowed','code',v_code,'audit_id',v_audit,'already_done',false);
  END IF;
  IF coalesce((result->>'allowed')::boolean,false) IS NOT TRUE THEN
    UPDATE public.linkedin_production_acceptance_authorizations SET status='failed',completed_at=now(),outcome=result,updated_at=now() WHERE id=a.id;
  END IF;
  RETURN result||jsonb_build_object('production_acceptance_authorization_id',a.id);
END $$;

CREATE OR REPLACE FUNCTION public.finalize_production_linkedin_acceptance_write(
  p_audit_id uuid,p_result_code text,p_write_verified boolean,p_classification text,p_evidence jsonb DEFAULT '{}'::jsonb,
  p_authorization_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_authorization_id FOR UPDATE;
  IF NOT FOUND OR a.status<>'executing' OR a.consumed_at IS NULL OR a.preflighted_at IS NULL
     OR NOT EXISTS(SELECT 1 FROM public.linkedin_write_audit w WHERE w.id=p_audit_id AND w.task_id=a.queue_item_id
       AND w.workspace_id=a.workspace_id AND w.linkedin_account_id=a.linkedin_account_id AND w.idempotency_key=a.idempotency_key
       AND w.target_identifier=a.canonical_target_url AND w.action_type='connection_request') THEN RAISE EXCEPTION 'production_acceptance_finalization_denied'; END IF;
  PERFORM public.finalize_linkedin_write_outcome(p_audit_id,p_result_code,p_write_verified,p_classification,p_evidence);
  UPDATE public.linkedin_production_acceptance_authorizations SET
    status=CASE WHEN p_result_code='success' AND p_write_verified THEN 'succeeded'
      WHEN p_result_code='outcome_unknown' OR coalesce((p_evidence->>'interaction_crossed')::boolean,false) THEN 'outcome_unknown'
      ELSE 'failed' END,
    completed_at=now(),outcome=coalesce(p_evidence,'{}'::jsonb)||jsonb_build_object(
      'result_code',p_result_code,'write_verified',p_write_verified,'classification',p_classification
    ),updated_at=now() WHERE id=a.id;
END $$;

CREATE OR REPLACE FUNCTION public.terminalize_production_linkedin_acceptance_from_queue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE auth_id uuid; final_status text;
BEGIN
  IF NEW.status NOT IN ('completed','failed','cancelled','escalated') OR NEW.status IS NOT DISTINCT FROM OLD.status
     OR coalesce(NEW.action_params->>'production_acceptance_authorization_id','') !~* '^[0-9a-f-]{36}$' THEN RETURN NEW; END IF;
  auth_id:=(NEW.action_params->>'production_acceptance_authorization_id')::uuid;
  final_status:=CASE WHEN coalesce(NEW.result->>'result_code','')='outcome_unknown' OR NEW.interaction_crossed THEN 'outcome_unknown'
    WHEN NEW.status='completed' AND coalesce((NEW.result->>'write_verified')::boolean,false) THEN 'succeeded' ELSE 'failed' END;
  UPDATE public.linkedin_production_acceptance_authorizations SET status=final_status,completed_at=coalesce(completed_at,now()),
    outcome=coalesce(outcome,'{}'::jsonb)||coalesce(NEW.result,'{}'::jsonb),updated_at=now()
    WHERE id=auth_id AND status IN('armed','executing');
  RETURN NEW;
END $$;

CREATE TRIGGER terminalize_production_linkedin_acceptance
AFTER UPDATE OF status ON public.browser_execution_queue
FOR EACH ROW EXECUTE FUNCTION public.terminalize_production_linkedin_acceptance_from_queue();

REVOKE ALL ON FUNCTION public.prepare_production_linkedin_acceptance(text,uuid,uuid,text,timestamptz,text),
  public.arm_production_linkedin_acceptance(uuid),
  public.claim_production_linkedin_acceptance_task(text,uuid,integer),
  public.preflight_production_linkedin_acceptance_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid),
  public.finalize_production_linkedin_acceptance_write(uuid,text,boolean,text,jsonb,uuid),
  public.terminalize_production_linkedin_acceptance_from_queue() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_production_linkedin_acceptance(text,uuid,uuid,text,timestamptz,text),
  public.arm_production_linkedin_acceptance(uuid),
  public.claim_production_linkedin_acceptance_task(text,uuid,integer),
  public.preflight_production_linkedin_acceptance_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid),
  public.finalize_production_linkedin_acceptance_write(uuid,text,boolean,text,jsonb,uuid),
  public.terminalize_production_linkedin_acceptance_from_queue() TO service_role;

COMMIT;
