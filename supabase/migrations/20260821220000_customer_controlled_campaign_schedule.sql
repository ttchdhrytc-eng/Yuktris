BEGIN;

CREATE OR REPLACE FUNCTION public.campaign_operating_days(p_value text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE days text[]; day text;
BEGIN
  IF lower(trim(p_value)) IN ('monday–friday','monday-friday') THEN
    RETURN ARRAY['monday','tuesday','wednesday','thursday','friday'];
  END IF;
  days:=regexp_split_to_array(lower(replace(coalesce(p_value,''),' ','')),',');
  IF cardinality(days)=0 THEN RETURN '{}'::text[]; END IF;
  FOREACH day IN ARRAY days LOOP
    IF day NOT IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday') THEN RETURN '{}'::text[]; END IF;
  END LOOP;
  RETURN ARRAY(SELECT DISTINCT x FROM unnest(days) x);
END $$;

CREATE OR REPLACE FUNCTION public.campaign_schedule_validation(
  p_operating_days text,p_start_time time,p_end_time time,p_timezone text
) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE days text[]:=public.campaign_operating_days(p_operating_days);
BEGIN
  IF cardinality(days)=0 THEN RETURN jsonb_build_object('valid',false,'code','sending_days_required'); END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL OR p_start_time>=p_end_time THEN RETURN jsonb_build_object('valid',false,'code','invalid_sending_hours'); END IF;
  IF nullif(trim(p_timezone),'') IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) THEN
    RETURN jsonb_build_object('valid',false,'code','invalid_outreach_timezone');
  END IF;
  RETURN jsonb_build_object('valid',true,'code','valid');
END $$;

CREATE OR REPLACE FUNCTION public.next_campaign_outreach_at(p_campaign_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE; d timestamptz; local_time timestamp; day_name text;
  start_time time;end_time time;allowed_days text[];validation jsonb;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  start_time:=split_part(replace(c.operating_hours,'–','-'),'-',1)::time;
  end_time:=split_part(replace(c.operating_hours,'–','-'),'-',2)::time;
  allowed_days:=public.campaign_operating_days(c.operating_days);
  validation:=public.campaign_schedule_validation(c.operating_days,start_time,end_time,c.outreach_timezone);
  IF NOT coalesce((validation->>'valid')::boolean,false) THEN RETURN NULL; END IF;
  d:=date_trunc('minute',greatest(p_not_before,now()));
  FOR i IN 0..20160 LOOP
    local_time:=d AT TIME ZONE c.outreach_timezone;
    day_name:=lower(trim(to_char(local_time,'Day')));
    IF day_name=ANY(allowed_days) AND local_time::time>=start_time AND local_time::time<end_time THEN RETURN d; END IF;
    d:=d+interval '1 minute';
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN invalid_parameter_value OR datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;

/* Compatibility name now delegates to the campaign-only authority. */
CREATE OR REPLACE FUNCTION public.next_campaign_account_outreach_at(p_campaign_id uuid,p_account_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE WHEN EXISTS(SELECT 1 FROM public.customer_campaigns c WHERE c.id=p_campaign_id AND c.linkedin_account_id=p_account_id)
    THEN public.next_campaign_outreach_at(p_campaign_id,p_not_before) ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.campaign_account_window_validation(p_campaign_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE; due timestamptz;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'code','campaign_not_found'); END IF;
  due:=public.next_campaign_outreach_at(c.id,p_not_before);
  IF due IS NULL THEN RETURN jsonb_build_object('valid',false,'code','invalid_campaign_schedule','message','Choose at least one sending day, valid hours, and an IANA timezone.'); END IF;
  RETURN jsonb_build_object('valid',true,'code','valid','scheduled_at',due);
END $$;

CREATE OR REPLACE FUNCTION public.campaign_outreach_preflight(p_workspace_id uuid,p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.linkedin_execution_jobs%ROWTYPE;c public.customer_campaigns%ROWTYPE;source_id uuid;due timestamptz;
BEGIN
  SELECT * INTO j FROM public.linkedin_execution_jobs WHERE id=p_job_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','job_not_found'); END IF;
  IF j.status IN ('failed','cancelled','completed') THEN RETURN jsonb_build_object('allowed',false,'code','terminal_job'); END IF;
  BEGIN source_id:=(j.action_payload->>'source_campaign_id')::uuid;EXCEPTION WHEN OTHERS THEN source_id:=NULL;END;
  IF source_id IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','campaign_schedule_missing'); END IF;
  SELECT * INTO c FROM public.customer_campaigns WHERE id=source_id AND workspace_id=p_workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','campaign_schedule_missing'); END IF;
  IF c.status='paused' THEN RETURN jsonb_build_object('allowed',false,'code','campaign_paused'); END IF;
  IF c.status NOT IN ('running','ready')
     AND NOT (c.status='failed' AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)) THEN
    RETURN jsonb_build_object('allowed',false,'code','campaign_not_runnable');
  END IF;
  due:=public.next_campaign_outreach_at(c.id,now());
  IF due IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','invalid_campaign_schedule'); END IF;
  IF due>now()+interval '5 seconds' THEN
    UPDATE public.linkedin_execution_jobs SET status='scheduled',scheduled_at=due,error_message='Waiting for next sending window',updated_at=now() WHERE id=j.id;
    RETURN jsonb_build_object('allowed',false,'code','outside_sending_window','scheduled_at',due);
  END IF;
  RETURN jsonb_build_object('allowed',true,'code','allowed');
END $$;

CREATE OR REPLACE FUNCTION public.update_customer_campaign_schedule(
  p_workspace_id uuid,p_campaign_id uuid,p_operating_days text,p_start_time time,p_end_time time,p_timezone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE;validation jsonb;due timestamptz;hours text;
BEGIN
  IF auth.role()<>'service_role' AND NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'Workspace access denied';END IF;
  validation:=public.campaign_schedule_validation(p_operating_days,p_start_time,p_end_time,p_timezone);
  IF NOT coalesce((validation->>'valid')::boolean,false) THEN RETURN validation;END IF;
  hours:=to_char(p_start_time,'HH24:MI')||'–'||to_char(p_end_time,'HH24:MI');
  UPDATE public.customer_campaigns SET operating_days=array_to_string(public.campaign_operating_days(p_operating_days),','),operating_hours=hours,
    outreach_timezone=p_timezone,updated_at=now() WHERE id=p_campaign_id AND workspace_id=p_workspace_id RETURNING * INTO c;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'code','campaign_not_found');END IF;
  due:=public.next_campaign_outreach_at(c.id,now());
  UPDATE public.linkedin_execution_jobs j SET scheduled_at=due,status=CASE WHEN c.status='paused' THEN 'paused' ELSE 'scheduled' END,
    error_message=CASE WHEN c.status='paused' THEN 'Campaign paused' WHEN due>now()+interval '5 seconds' THEN 'Waiting for next sending window' ELSE NULL END,updated_at=now()
  WHERE j.workspace_id=p_workspace_id AND j.action_payload->>'source_campaign_id'=c.id::text AND j.status IN ('queued','scheduled','retry','retrying','paused');
  UPDATE public.browser_execution_queue q SET scheduled_at=due,status=CASE WHEN c.status='paused' THEN 'waiting' ELSE 'pending' END,
    next_retry_at=NULL,started_at=NULL,worker_id=NULL,attempt_id=NULL,lease_expires_at=NULL,error=CASE WHEN c.status='paused' THEN 'Campaign paused' ELSE 'Schedule updated' END,updated_at=now()
  WHERE q.workspace_id=p_workspace_id AND q.status IN ('pending','waiting','retry') AND q.action_params->>'job_id' ~* '^[0-9a-f-]{36}$' AND EXISTS(
    SELECT 1 FROM public.linkedin_execution_jobs j WHERE j.id=(q.action_params->>'job_id')::uuid AND j.action_payload->>'source_campaign_id'=c.id::text);
  RETURN jsonb_build_object('valid',true,'code','updated','scheduled_at',due,'campaign_status',c.status);
END $$;

CREATE OR REPLACE FUNCTION public.set_customer_campaign_paused(p_workspace_id uuid,p_campaign_id uuid,p_paused boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE;due timestamptz;
BEGIN
  IF auth.role()<>'service_role' AND NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'Workspace access denied';END IF;
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','campaign_not_found');END IF;
  IF c.status IN ('completed','failed') THEN RETURN jsonb_build_object('ok',false,'code','terminal_campaign');END IF;
  IF p_paused THEN
    UPDATE public.customer_campaigns SET status='paused',status_reason='Paused. No LinkedIn writes will run until you resume.',updated_at=now() WHERE id=c.id;
    UPDATE public.linkedin_execution_jobs SET status='paused',scheduled_at=NULL,error_message='Campaign paused',updated_at=now()
      WHERE workspace_id=p_workspace_id AND action_payload->>'source_campaign_id'=c.id::text AND status IN ('queued','scheduled','retry','retrying');
    UPDATE public.browser_execution_queue q SET status='waiting',scheduled_at=NULL,next_retry_at=NULL,error='Campaign paused',worker_id=NULL,attempt_id=NULL,lease_expires_at=NULL,updated_at=now()
      WHERE q.workspace_id=p_workspace_id AND q.status IN ('pending','retry','waiting') AND q.action_params->>'job_id' ~* '^[0-9a-f-]{36}$' AND EXISTS(SELECT 1 FROM public.linkedin_execution_jobs j WHERE j.id=(q.action_params->>'job_id')::uuid AND j.action_payload->>'source_campaign_id'=c.id::text);
    RETURN jsonb_build_object('ok',true,'code','paused');
  END IF;
  due:=public.next_campaign_outreach_at(c.id,now());
  IF due IS NULL THEN RETURN jsonb_build_object('ok',false,'code','invalid_campaign_schedule');END IF;
  UPDATE public.customer_campaigns SET status='running',status_reason=CASE WHEN due>now()+interval '5 seconds' THEN 'Waiting for next sending window.' ELSE 'Outreach is running in the background.' END,updated_at=now() WHERE id=c.id;
  UPDATE public.linkedin_execution_jobs SET status='scheduled',scheduled_at=due,error_message=CASE WHEN due>now()+interval '5 seconds' THEN 'Waiting for next sending window' ELSE NULL END,updated_at=now()
    WHERE workspace_id=p_workspace_id AND action_payload->>'source_campaign_id'=c.id::text AND status='paused';
  UPDATE public.browser_execution_queue q SET status='pending',scheduled_at=due,next_retry_at=NULL,error='Campaign resumed',updated_at=now()
    WHERE q.workspace_id=p_workspace_id AND q.status='waiting' AND q.action_params->>'job_id' ~* '^[0-9a-f-]{36}$' AND EXISTS(SELECT 1 FROM public.linkedin_execution_jobs j WHERE j.id=(q.action_params->>'job_id')::uuid AND j.action_payload->>'source_campaign_id'=c.id::text);
  RETURN jsonb_build_object('ok',true,'code','resumed','scheduled_at',due);
END $$;

/* Rebuild the write-safety function without account scheduling; all other controls remain. */
CREATE OR REPLACE FUNCTION public.preflight_linkedin_write_without_acceptance_override(
  p_task_id uuid,p_attempt_id uuid,p_workspace_id uuid,p_account_id uuid,p_action_type text,p_target text,
  p_idempotency_key text,p_project_ref text,p_campaign_id uuid DEFAULT NULL,p_contact_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE a public.linkedin_accounts%ROWTYPE;h public.linkedin_account_health%ROWTYPE;u public.linkedin_daily_usage%ROWTYPE;r public.linkedin_rate_limits%ROWTYPE;
  v_code text:='allowed';v_audit uuid;v_semantic text;v_used integer;v_limit integer;v_local timestamp;v_total_limit integer;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required';END IF;
  IF p_action_type NOT IN ('connection_request','send_message','follow_up_message','like_post','follow_company') OR nullif(trim(p_target),'') IS NULL OR nullif(trim(p_idempotency_key),'') IS NULL THEN v_code:='invalid_request';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_task_id AND q.workspace_id=p_workspace_id AND q.account_id=p_account_id AND q.attempt_id=p_attempt_id AND q.status='running') THEN RAISE EXCEPTION 'queue ownership denied';END IF;
  SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account ownership denied';END IF;
  v_semantic:=encode(digest(concat_ws(E'\x1f',p_workspace_id,p_account_id,p_action_type,lower(trim(p_target)),p_idempotency_key),'sha256'),'hex');
  SELECT id INTO v_audit FROM public.linkedin_write_audit WHERE semantic_key=v_semantic;
  IF FOUND THEN RETURN jsonb_build_object('allowed',false,'code','duplicate_action','audit_id',v_audit,'already_done',EXISTS(SELECT 1 FROM public.linkedin_write_audit WHERE id=v_audit AND execution_result='success'));END IF;
  IF a.status='paused' THEN v_code:='account_paused';
  ELSIF a.connection_state='requires_action' THEN v_code:='verification_required';
  ELSIF a.status IN ('restricted','banned') OR a.connection_status='restricted' THEN v_code:='linkedin_restricted';
  ELSIF a.connection_status='cooldown' THEN v_code:='cooldown_active';
  ELSIF a.connection_state<>'connected' OR a.session_status<>'connected' THEN v_code:='verification_required';
  ELSIF coalesce(a.risk_score,0)>0.7 THEN v_code:='linkedin_restricted';END IF;
  SELECT * INTO h FROM public.linkedin_account_health WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id ORDER BY updated_at DESC LIMIT 1;
  IF v_code='allowed' AND FOUND AND(h.health_status IN('critical','down') OR h.cooldown_until>now()) THEN v_code:=CASE WHEN h.cooldown_until>now() THEN 'cooldown_active' ELSE 'linkedin_restricted' END;END IF;
  SELECT * INTO r FROM public.linkedin_rate_limits WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id AND action_type=p_action_type FOR UPDATE;
  IF v_code='allowed' AND FOUND AND r.cooldown_until>now() THEN v_code:='cooldown_active';ELSIF v_code='allowed' AND FOUND AND(r.daily_used>=r.daily_limit OR r.weekly_used>=r.weekly_limit) THEN v_code:='rate_limited';END IF;
  v_local:=now() AT TIME ZONE coalesce(a.timezone,'UTC');
  SELECT * INTO u FROM public.linkedin_daily_usage WHERE linkedin_account_id=p_account_id AND usage_date=v_local::date FOR UPDATE;
  v_used:=CASE WHEN p_action_type='connection_request' THEN coalesce(u.connections_sent,0) ELSE coalesce(u.messages_sent,0) END;
  v_limit:=CASE WHEN p_action_type='connection_request' THEN a.daily_connection_limit ELSE a.daily_message_limit END;
  v_total_limit:=coalesce((a.metadata->>'daily_total_action_limit')::integer,a.daily_connection_limit+a.daily_message_limit);
  IF v_code='allowed' AND(v_used>=v_limit OR coalesce(u.total_actions,0)>=v_total_limit) THEN v_code:='daily_limit_reached';END IF;
  IF v_code='allowed' AND a.last_activity_at IS NOT NULL AND a.last_activity_at+make_interval(secs=>coalesce((a.metadata->>'minimum_write_interval_seconds')::integer,30))>now() THEN v_code:='cooldown_active';END IF;
  IF v_code='allowed' THEN
    IF p_project_ref='vdiqfiuqckaxdjkadinu' THEN
      IF NOT EXISTS(SELECT 1 FROM public.linkedin_safe_write_targets s WHERE s.workspace_id=p_workspace_id AND s.linkedin_account_id=p_account_id AND s.project_ref=p_project_ref AND s.target_identifier=lower(trim(p_target)) AND s.enabled AND p_action_type=ANY(s.allowed_action_types)) THEN v_code:='unsafe_target';END IF;
    ELSIF NOT((p_contact_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.contacts c WHERE c.id=p_contact_id AND c.workspace_id=p_workspace_id)) OR(p_campaign_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=p_campaign_id AND c.workspace_id=p_workspace_id))) THEN v_code:='unsafe_target';END IF;
  END IF;
  INSERT INTO public.linkedin_write_audit(task_id,workspace_id,linkedin_account_id,idempotency_key,semantic_key,target_identifier,action_type,preflight_result,execution_started_at,campaign_id,contact_id)
  VALUES(p_task_id,p_workspace_id,p_account_id,p_idempotency_key,v_semantic,lower(trim(p_target)),p_action_type,v_code,CASE WHEN v_code='allowed' THEN now() END,p_campaign_id,p_contact_id) RETURNING id INTO v_audit;
  RETURN jsonb_build_object('allowed',v_code='allowed','code',v_code,'audit_id',v_audit,'already_done',false);
END $$;

REVOKE ALL ON FUNCTION public.campaign_schedule_validation(text,time,time,text),public.update_customer_campaign_schedule(uuid,uuid,text,time,time,text),public.set_customer_campaign_paused(uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campaign_schedule_validation(text,time,time,text),public.update_customer_campaign_schedule(uuid,uuid,text,time,time,text),public.set_customer_campaign_paused(uuid,uuid,boolean) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.preflight_linkedin_write_without_acceptance_override(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preflight_linkedin_write_without_acceptance_override(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) TO service_role;

COMMIT;
