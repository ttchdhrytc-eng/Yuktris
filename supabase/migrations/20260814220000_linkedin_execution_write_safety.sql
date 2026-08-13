/* Authoritative LinkedIn write preflight, staging allowlist, audit, and exactly-once accounting. */

CREATE TABLE public.linkedin_safe_write_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  project_ref text NOT NULL,
  target_identifier text NOT NULL,
  allowed_action_types text[] NOT NULL DEFAULT '{}'::text[],
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,linkedin_account_id,project_ref,target_identifier)
);

CREATE TABLE public.linkedin_write_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.browser_execution_queue(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  semantic_key text NOT NULL UNIQUE,
  target_identifier text NOT NULL,
  action_type text NOT NULL,
  preflight_result text NOT NULL,
  execution_started_at timestamptz,
  execution_completed_at timestamptz,
  execution_result text,
  linkedin_classification text,
  campaign_id uuid,
  contact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.linkedin_safe_write_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_write_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY linkedin_safe_targets_member_select ON public.linkedin_safe_write_targets FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY linkedin_write_audit_member_select ON public.linkedin_write_audit FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_safe_write_targets, public.linkedin_write_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.linkedin_safe_write_targets, public.linkedin_write_audit TO authenticated;
GRANT ALL ON public.linkedin_safe_write_targets, public.linkedin_write_audit TO service_role;

CREATE OR REPLACE FUNCTION public.preflight_linkedin_write(
  p_task_id uuid, p_attempt_id uuid, p_workspace_id uuid, p_account_id uuid,
  p_action_type text, p_target text, p_idempotency_key text, p_project_ref text,
  p_campaign_id uuid DEFAULT NULL, p_contact_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  a public.linkedin_accounts%ROWTYPE; h public.linkedin_account_health%ROWTYPE;
  u public.linkedin_daily_usage%ROWTYPE; r public.linkedin_rate_limits%ROWTYPE;
  v_code text := 'allowed'; v_audit uuid; v_semantic text; v_used integer; v_limit integer;
  v_local timestamp; v_day text; v_total_limit integer;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_action_type NOT IN ('connection_request','send_message','follow_up_message','like_post','follow_company')
     OR nullif(trim(p_target),'') IS NULL OR nullif(trim(p_idempotency_key),'') IS NULL THEN v_code := 'invalid_request'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_task_id AND q.workspace_id=p_workspace_id
      AND q.account_id=p_account_id AND q.attempt_id=p_attempt_id AND q.status='running') THEN RAISE EXCEPTION 'queue ownership denied'; END IF;
  SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account ownership denied'; END IF;
  v_semantic := encode(digest(concat_ws(E'\x1f',p_workspace_id,p_account_id,p_action_type,lower(trim(p_target)),p_idempotency_key),'sha256'),'hex');
  SELECT id INTO v_audit FROM public.linkedin_write_audit WHERE semantic_key=v_semantic;
  IF FOUND THEN RETURN jsonb_build_object('allowed',false,'code','duplicate_action','audit_id',v_audit,'already_done',
    EXISTS(SELECT 1 FROM public.linkedin_write_audit WHERE id=v_audit AND execution_result='success')); END IF;

  IF a.status='paused' THEN v_code := 'account_paused';
  ELSIF a.connection_state='requires_action' THEN v_code := 'verification_required';
  ELSIF a.status IN ('restricted','banned') OR a.connection_status='restricted' THEN v_code := 'linkedin_restricted';
  ELSIF a.connection_status='cooldown' THEN v_code := 'cooldown_active';
  ELSIF a.connection_state<>'connected' OR a.session_status<>'connected' THEN v_code := 'verification_required';
  ELSIF coalesce(a.risk_score,0)>0.7 THEN v_code := 'linkedin_restricted'; END IF;

  SELECT * INTO h FROM public.linkedin_account_health WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id ORDER BY updated_at DESC LIMIT 1;
  IF v_code='allowed' AND FOUND AND (h.health_status IN ('critical','down') OR h.cooldown_until>now()) THEN
    v_code := CASE WHEN h.cooldown_until>now() THEN 'cooldown_active' ELSE 'linkedin_restricted' END;
  END IF;
  SELECT * INTO r FROM public.linkedin_rate_limits WHERE linkedin_account_id=p_account_id AND workspace_id=p_workspace_id AND action_type=p_action_type FOR UPDATE;
  IF v_code='allowed' AND FOUND AND r.cooldown_until>now() THEN v_code := 'cooldown_active';
  ELSIF v_code='allowed' AND FOUND AND (r.daily_used>=r.daily_limit OR r.weekly_used>=r.weekly_limit) THEN v_code := 'rate_limited'; END IF;

  v_local := now() AT TIME ZONE coalesce(a.timezone,'UTC');
  v_day := lower(trim(to_char(v_local,'Day')));
  IF v_code='allowed' AND (NOT v_day=ANY(coalesce(a.working_days,'{}'))
      OR v_local::time < a.working_hours_start::time OR v_local::time >= a.working_hours_end::time) THEN v_code := 'outside_working_hours'; END IF;
  SELECT * INTO u FROM public.linkedin_daily_usage WHERE linkedin_account_id=p_account_id AND usage_date=v_local::date FOR UPDATE;
  v_used := CASE WHEN p_action_type='connection_request' THEN coalesce(u.connections_sent,0) ELSE coalesce(u.messages_sent,0) END;
  v_limit := CASE WHEN p_action_type='connection_request' THEN a.daily_connection_limit ELSE a.daily_message_limit END;
  v_total_limit := coalesce((a.metadata->>'daily_total_action_limit')::integer,a.daily_connection_limit+a.daily_message_limit);
  IF v_code='allowed' AND (v_used>=v_limit OR coalesce(u.total_actions,0)>=v_total_limit) THEN v_code := 'daily_limit_reached'; END IF;
  IF v_code='allowed' AND a.last_activity_at IS NOT NULL
     AND a.last_activity_at + make_interval(secs=>coalesce((a.metadata->>'minimum_write_interval_seconds')::integer,30)) > now()
    THEN v_code := 'cooldown_active'; END IF;

  IF v_code='allowed' THEN
    IF p_project_ref='vdiqfiuqckaxdjkadinu' THEN
      IF NOT EXISTS(SELECT 1 FROM public.linkedin_safe_write_targets s WHERE s.workspace_id=p_workspace_id
          AND s.linkedin_account_id=p_account_id AND s.project_ref=p_project_ref AND s.target_identifier=lower(trim(p_target))
          AND s.enabled AND p_action_type=ANY(s.allowed_action_types)) THEN v_code := 'unsafe_target'; END IF;
    ELSIF NOT ((p_contact_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.contacts c WHERE c.id=p_contact_id AND c.workspace_id=p_workspace_id))
       OR (p_campaign_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.campaigns c WHERE c.id=p_campaign_id AND c.workspace_id=p_workspace_id))) THEN
      v_code := 'unsafe_target';
    END IF;
  END IF;

  INSERT INTO public.linkedin_write_audit(task_id,workspace_id,linkedin_account_id,idempotency_key,semantic_key,
    target_identifier,action_type,preflight_result,execution_started_at,campaign_id,contact_id)
  VALUES(p_task_id,p_workspace_id,p_account_id,p_idempotency_key,v_semantic,lower(trim(p_target)),p_action_type,v_code,
    CASE WHEN v_code='allowed' THEN now() END,p_campaign_id,p_contact_id) RETURNING id INTO v_audit;
  RETURN jsonb_build_object('allowed',v_code='allowed','code',v_code,'audit_id',v_audit,'already_done',false);
END $$;

CREATE OR REPLACE FUNCTION public.finalize_linkedin_write(p_audit_id uuid,p_success boolean,p_classification text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE w public.linkedin_write_audit%ROWTYPE; v_day date;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO w FROM public.linkedin_write_audit WHERE id=p_audit_id FOR UPDATE;
  IF NOT FOUND OR w.preflight_result<>'allowed' OR w.execution_result IS NOT NULL THEN RAISE EXCEPTION 'write finalization denied'; END IF;
  UPDATE public.linkedin_write_audit SET execution_completed_at=now(),execution_result=CASE WHEN p_success THEN 'success' ELSE 'failed' END,
    linkedin_classification=left(coalesce(p_classification,'unknown'),80) WHERE id=p_audit_id;
  IF NOT p_success THEN
    IF p_classification IN ('verification_required','checkpoint','challenge') THEN
      UPDATE public.linkedin_accounts SET status='paused',connection_state='requires_action',last_error='LinkedIn verification required' WHERE id=w.linkedin_account_id;
    END IF;
    RETURN;
  END IF;
  v_day := (now() AT TIME ZONE coalesce((SELECT timezone FROM public.linkedin_accounts WHERE id=w.linkedin_account_id),'UTC'))::date;
  INSERT INTO public.linkedin_daily_usage(workspace_id,linkedin_account_id,usage_date,connections_sent,messages_sent,total_actions)
  VALUES(w.workspace_id,w.linkedin_account_id,v_day,CASE WHEN w.action_type='connection_request' THEN 1 ELSE 0 END,
    CASE WHEN w.action_type IN ('send_message','follow_up_message') THEN 1 ELSE 0 END,1)
  ON CONFLICT(linkedin_account_id,usage_date) DO UPDATE SET
    connections_sent=public.linkedin_daily_usage.connections_sent+excluded.connections_sent,
    messages_sent=public.linkedin_daily_usage.messages_sent+excluded.messages_sent,total_actions=public.linkedin_daily_usage.total_actions+1,updated_at=now();
  UPDATE public.linkedin_rate_limits SET daily_used=daily_used+1,weekly_used=weekly_used+1,updated_at=now()
    WHERE linkedin_account_id=w.linkedin_account_id AND action_type=w.action_type;
END $$;

REVOKE ALL ON FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_linkedin_write(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_linkedin_write(uuid,boolean,text) TO service_role;
