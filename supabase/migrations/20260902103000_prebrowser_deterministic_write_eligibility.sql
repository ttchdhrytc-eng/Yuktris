BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=pg_catalog,public;

CREATE FUNCTION public.validate_linkedin_write_deterministic_eligibility(
 p_task_id uuid,p_attempt_id uuid,p_workspace_id uuid,p_account_id uuid,p_action_type text,p_target text,
 p_idempotency_key text,p_project_ref text,p_authorization_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE q public.browser_execution_queue%ROWTYPE;a public.linkedin_accounts%ROWTYPE;h public.linkedin_account_health%ROWTYPE;
 r public.linkedin_rate_limits%ROWTYPE;u public.linkedin_daily_usage%ROWTYPE;pa public.linkedin_production_acceptance_authorizations%ROWTYPE;
 v_job uuid;v_auth jsonb;v_schedule jsonb;v_semantic text;v_used integer;v_limit integer;v_total_limit integer;v_local timestamp;v_code text:='allowed';v_normal_pilot boolean;
BEGIN
 IF current_user NOT IN('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required';END IF;
 SELECT * INTO q FROM public.browser_execution_queue WHERE id=p_task_id AND status='running' AND attempt_id=p_attempt_id AND workspace_id=p_workspace_id AND account_id=p_account_id;
 IF NOT FOUND OR q.worker_id IS NULL OR q.action_type<>p_action_type OR q.idempotency_key<>p_idempotency_key OR p_action_type NOT IN('connection_request','send_message','follow_up_message','like_post','follow_company') OR nullif(trim(p_target),'') IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','queue_or_payload_binding_denied');END IF;
 IF p_authorization_id IS NOT NULL THEN
  SELECT * INTO pa FROM public.linkedin_production_acceptance_authorizations WHERE id=p_authorization_id;
  IF NOT FOUND OR pa.project_ref<>p_project_ref OR pa.status<>'executing' OR pa.expires_at<=now() OR pa.queue_item_id<>q.id OR pa.attempt_id<>q.attempt_id OR pa.worker_id<>q.worker_id OR pa.workspace_id<>q.workspace_id OR pa.linkedin_account_id<>q.account_id OR pa.action_type<>q.action_type OR pa.idempotency_key<>q.idempotency_key OR pa.canonical_target_url<>lower(trim(p_target)) OR nullif(trim(pa.expected_display_name),'') IS NULL OR (q.action_params->>'expected_display_name') IS DISTINCT FROM pa.expected_display_name OR q.action_params->>'production_acceptance_authorization_id'<>pa.id::text OR coalesce((q.action_params->>'persistent_context_required')::boolean,false) IS NOT TRUE OR coalesce((q.action_params->>'acceptance_test_mode')::boolean,false) IS NOT TRUE OR q.action_params?'note' OR q.action_params?'message' OR pa.preflighted_at IS NOT NULL OR pa.consumed_at IS NOT NULL THEN RETURN jsonb_build_object('allowed',false,'code','production_acceptance_deterministic_binding_denied');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_browser_contexts c WHERE c.id=pa.persistent_context_id AND c.workspace_id=pa.workspace_id AND c.account_id=pa.linkedin_account_id AND c.provider_context_id=pa.provider_context_id AND c.provider='browserbase' AND c.status='active' AND c.deleted_at IS NULL) THEN RETURN jsonb_build_object('allowed',false,'code','bound_context_not_active');END IF;
 ELSE
  IF coalesce(q.action_params->>'job_id','')!~*'^[0-9a-f-]{36}$' THEN RETURN jsonb_build_object('allowed',false,'code','campaign_schedule_missing');END IF;
  v_job:=(q.action_params->>'job_id')::uuid;
  v_schedule:=public.campaign_outreach_preflight(p_workspace_id,v_job);
  IF coalesce((v_schedule->>'allowed')::boolean,false) IS NOT TRUE THEN RETURN jsonb_build_object('allowed',false,'code',coalesce(v_schedule->>'code','campaign_schedule_required'),'schedule',v_schedule);END IF;
  v_normal_pilot:=coalesce((q.action_params->>'normal_campaign_pilot')::boolean,false);
  IF v_normal_pilot THEN
   v_auth:=public.normal_campaign_target_authorization(p_workspace_id,p_account_id,v_job,p_action_type,p_target,p_project_ref);
   IF coalesce((v_auth->>'allowed')::boolean,false) IS NOT TRUE THEN RETURN jsonb_build_object('allowed',false,'code',coalesce(v_auth->>'code','normal_campaign_target_denied'));END IF;
  END IF;
 END IF;
 SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','account_ownership_denied');END IF;
 IF a.status='paused' THEN v_code:='account_paused';ELSIF a.connection_state='requires_action' THEN v_code:='verification_required';ELSIF a.status IN('restricted','banned') OR a.connection_status='restricted' THEN v_code:='linkedin_restricted';ELSIF a.connection_status='cooldown' THEN v_code:='cooldown_active';ELSIF a.connection_state<>'connected' OR a.session_status<>'connected' OR a.health_status<>'healthy' THEN v_code:='verification_required';ELSIF coalesce(a.risk_score,0)>0.7 THEN v_code:='linkedin_restricted';ELSIF a.actions_this_hour>=a.hourly_action_limit THEN v_code:='hourly_limit_reached';END IF;
 SELECT * INTO h FROM public.linkedin_account_health WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id ORDER BY updated_at DESC LIMIT 1;
 IF v_code='allowed' AND FOUND AND(h.health_status IN('critical','down') OR h.cooldown_until>now()) THEN v_code:=CASE WHEN h.cooldown_until>now() THEN 'cooldown_active' ELSE 'linkedin_restricted' END;END IF;
 SELECT * INTO r FROM public.linkedin_rate_limits WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id AND action_type=p_action_type;
 IF v_code='allowed' AND FOUND AND r.cooldown_until>now() THEN v_code:='cooldown_active';ELSIF v_code='allowed' AND FOUND AND(r.daily_used>=r.daily_limit OR r.weekly_used>=r.weekly_limit) THEN v_code:='rate_limited';END IF;
 v_local:=now() AT TIME ZONE coalesce(a.timezone,'UTC');
 SELECT * INTO u FROM public.linkedin_daily_usage WHERE linkedin_account_id=p_account_id AND usage_date=v_local::date;
 v_used:=CASE WHEN p_action_type='connection_request' THEN coalesce(u.connections_sent,0) ELSE coalesce(u.messages_sent,0) END;v_limit:=CASE WHEN p_action_type='connection_request' THEN a.daily_connection_limit ELSE a.daily_message_limit END;v_total_limit:=coalesce((a.metadata->>'daily_total_action_limit')::integer,a.daily_connection_limit+a.daily_message_limit);
 IF v_code='allowed' AND(v_used>=v_limit OR coalesce(u.total_actions,0)>=v_total_limit) THEN v_code:='daily_limit_reached';END IF;
 IF v_code='allowed' AND a.last_activity_at IS NOT NULL AND a.last_activity_at+make_interval(secs=>coalesce((a.metadata->>'minimum_write_interval_seconds')::integer,30))>now() THEN v_code:='cooldown_active';END IF;
 v_semantic:=encode(extensions.digest(concat_ws(E'\x1f',p_workspace_id,p_account_id,p_action_type,lower(trim(p_target)),p_idempotency_key),'sha256'),'hex');
 IF v_code='allowed' AND EXISTS(SELECT 1 FROM public.linkedin_write_audit WHERE semantic_key=v_semantic) THEN v_code:='duplicate_action';END IF;
 RETURN jsonb_build_object('allowed',v_code='allowed','code',v_code,'deterministic',true,'audit_created',false);
END$$;

CREATE OR REPLACE FUNCTION public.preflight_production_linkedin_acceptance_write_without_expected_name(
  p_task_id uuid,p_attempt_id uuid,p_workspace_id uuid,p_account_id uuid,p_action_type text,p_target text,
  p_idempotency_key text,p_project_ref text,p_campaign_id uuid DEFAULT NULL,p_contact_id uuid DEFAULT NULL,
  p_authorization_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE;account public.linkedin_accounts%ROWTYPE;c public.linkedin_browser_contexts%ROWTYPE;h public.linkedin_account_health%ROWTYPE;u public.linkedin_daily_usage%ROWTYPE;r public.linkedin_rate_limits%ROWTYPE;result jsonb;v_code text:='allowed';v_audit uuid;v_semantic text;v_local timestamp;v_used integer;v_limit integer;v_total_limit integer;
BEGIN
 IF current_user NOT IN('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required';END IF;
 SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_authorization_id FOR UPDATE;
 IF NOT FOUND OR a.status<>'executing' OR a.queue_item_id<>p_task_id OR a.workspace_id<>p_workspace_id OR a.linkedin_account_id<>p_account_id OR a.action_type<>p_action_type OR a.action_type<>'connection_request' OR a.canonical_target_url<>lower(trim(p_target)) OR a.idempotency_key<>p_idempotency_key OR a.project_ref<>p_project_ref OR a.expires_at<=now() OR a.attempt_id<>p_attempt_id OR a.preflighted_at IS NOT NULL OR a.consumed_at IS NOT NULL OR p_campaign_id IS NOT NULL OR p_contact_id IS NOT NULL THEN RETURN jsonb_build_object('allowed',false,'code','production_acceptance_binding_denied','already_done',coalesce(a.consumed_at IS NOT NULL,false));END IF;
 SELECT * INTO c FROM public.linkedin_browser_contexts WHERE id=a.persistent_context_id AND workspace_id=a.workspace_id AND account_id=a.linkedin_account_id AND provider_context_id=a.provider_context_id AND status IN('active','in_use') AND deleted_at IS NULL;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_task_id AND q.persistent_context_id=a.persistent_context_id AND q.status='running' AND q.attempt_id=p_attempt_id) THEN RETURN jsonb_build_object('allowed',false,'code','bound_browser_context_not_reused','already_done',false);END IF;
 UPDATE public.linkedin_production_acceptance_authorizations SET preflighted_at=now(),consumed_at=now(),updated_at=now() WHERE id=a.id;
 SELECT * INTO account FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'account_ownership_denied';END IF;
 v_semantic:=encode(extensions.digest(concat_ws(E'\x1f',p_workspace_id,p_account_id,p_action_type,lower(trim(p_target)),p_idempotency_key),'sha256'),'hex');SELECT id INTO v_audit FROM public.linkedin_write_audit WHERE semantic_key=v_semantic;
 IF FOUND THEN result:=jsonb_build_object('allowed',false,'code','duplicate_action','audit_id',v_audit,'already_done',EXISTS(SELECT 1 FROM public.linkedin_write_audit WHERE id=v_audit AND execution_result='success'));
 ELSE
  IF account.status='paused' THEN v_code:='account_paused';ELSIF account.connection_state='requires_action' THEN v_code:='verification_required';ELSIF account.status IN('restricted','banned') OR account.connection_status='restricted' THEN v_code:='linkedin_restricted';ELSIF account.connection_status='cooldown' THEN v_code:='cooldown_active';ELSIF account.connection_state<>'connected' OR account.session_status<>'connected' OR account.health_status<>'healthy' THEN v_code:='verification_required';ELSIF coalesce(account.risk_score,0)>0.7 THEN v_code:='linkedin_restricted';ELSIF account.actions_this_hour>=account.hourly_action_limit THEN v_code:='hourly_limit_reached';END IF;
  SELECT * INTO h FROM public.linkedin_account_health WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id ORDER BY updated_at DESC LIMIT 1;IF v_code='allowed' AND FOUND AND(h.health_status IN('critical','down') OR h.cooldown_until>now()) THEN v_code:=CASE WHEN h.cooldown_until>now() THEN 'cooldown_active' ELSE 'linkedin_restricted' END;END IF;
  SELECT * INTO r FROM public.linkedin_rate_limits WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id AND action_type='connection_request' FOR UPDATE;IF v_code='allowed' AND FOUND AND r.cooldown_until>now() THEN v_code:='cooldown_active';ELSIF v_code='allowed' AND FOUND AND(r.daily_used>=r.daily_limit OR r.weekly_used>=r.weekly_limit) THEN v_code:='rate_limited';END IF;
  v_local:=now() AT TIME ZONE coalesce(account.timezone,'UTC');SELECT * INTO u FROM public.linkedin_daily_usage WHERE linkedin_account_id=p_account_id AND usage_date=v_local::date FOR UPDATE;v_used:=coalesce(u.connections_sent,0);v_limit:=account.daily_connection_limit;v_total_limit:=coalesce((account.metadata->>'daily_total_action_limit')::integer,account.daily_connection_limit+account.daily_message_limit);
  IF v_code='allowed' AND(v_used>=v_limit OR coalesce(u.total_actions,0)>=v_total_limit) THEN v_code:='daily_limit_reached';END IF;IF v_code='allowed' AND account.last_activity_at IS NOT NULL AND account.last_activity_at+make_interval(secs=>coalesce((account.metadata->>'minimum_write_interval_seconds')::integer,30))>now() THEN v_code:='cooldown_active';END IF;
  INSERT INTO public.linkedin_write_audit(task_id,workspace_id,linkedin_account_id,idempotency_key,semantic_key,target_identifier,action_type,preflight_result,execution_started_at) VALUES(p_task_id,p_workspace_id,p_account_id,p_idempotency_key,v_semantic,a.canonical_target_url,'connection_request',v_code,CASE WHEN v_code='allowed' THEN now() END) RETURNING id INTO v_audit;result:=jsonb_build_object('allowed',v_code='allowed','code',v_code,'audit_id',v_audit,'already_done',false);
 END IF;
 IF coalesce((result->>'allowed')::boolean,false) IS NOT TRUE THEN UPDATE public.linkedin_production_acceptance_authorizations SET status='failed',completed_at=now(),outcome=result,updated_at=now() WHERE id=a.id;END IF;RETURN result||jsonb_build_object('production_acceptance_authorization_id',a.id);
END$$;

REVOKE ALL ON FUNCTION public.validate_linkedin_write_deterministic_eligibility(uuid,uuid,uuid,uuid,text,text,text,text,uuid),public.preflight_production_linkedin_acceptance_write_without_expected_name(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_linkedin_write_deterministic_eligibility(uuid,uuid,uuid,uuid,text,text,text,text,uuid),public.preflight_production_linkedin_acceptance_write_without_expected_name(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid) TO service_role;
COMMIT;
