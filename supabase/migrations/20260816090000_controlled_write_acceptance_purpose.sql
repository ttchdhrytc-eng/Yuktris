/* Explicit first-write purpose; still bypasses only staging working hours. */
ALTER TABLE public.linkedin_write_acceptance_overrides DROP CONSTRAINT linkedin_write_acceptance_overrides_purpose_check;
ALTER TABLE public.linkedin_write_acceptance_overrides ADD CONSTRAINT linkedin_write_acceptance_overrides_purpose_check
  CHECK (purpose IN ('controlled_acceptance','controlled_write_acceptance'));

CREATE OR REPLACE FUNCTION public.preflight_linkedin_write(
  p_task_id uuid,p_attempt_id uuid,p_workspace_id uuid,p_account_id uuid,p_action_type text,p_target text,
  p_idempotency_key text,p_project_ref text,p_campaign_id uuid DEFAULT NULL,p_contact_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE v_result jsonb;v_override uuid;v_audit uuid;a public.linkedin_accounts%ROWTYPE;u public.linkedin_daily_usage%ROWTYPE;
  v_local timestamp;v_used integer;v_limit integer;v_total integer;
BEGIN
  v_result:=public.preflight_linkedin_write_without_acceptance_override(p_task_id,p_attempt_id,p_workspace_id,p_account_id,p_action_type,p_target,p_idempotency_key,p_project_ref,p_campaign_id,p_contact_id);
  IF v_result->>'code'<>'outside_working_hours' THEN RETURN v_result;END IF;
  IF p_project_ref<>'vdiqfiuqckaxdjkadinu' THEN RETURN v_result;END IF;
  SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id FOR UPDATE;
  v_local:=now() AT TIME ZONE coalesce(a.timezone,'UTC');
  SELECT * INTO u FROM public.linkedin_daily_usage WHERE linkedin_account_id=p_account_id AND usage_date=v_local::date FOR UPDATE;
  v_used:=CASE WHEN p_action_type='connection_request' THEN coalesce(u.connections_sent,0) ELSE coalesce(u.messages_sent,0) END;
  v_limit:=CASE WHEN p_action_type='connection_request' THEN a.daily_connection_limit ELSE a.daily_message_limit END;
  v_total:=coalesce((a.metadata->>'daily_total_action_limit')::integer,a.daily_connection_limit+a.daily_message_limit);
  IF v_used>=v_limit OR coalesce(u.total_actions,0)>=v_total THEN RETURN v_result;END IF;
  IF a.last_activity_at IS NOT NULL AND a.last_activity_at+make_interval(secs=>coalesce((a.metadata->>'minimum_write_interval_seconds')::integer,30))>now() THEN RETURN v_result;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_safe_write_targets s WHERE s.workspace_id=p_workspace_id AND s.linkedin_account_id=p_account_id
    AND s.project_ref=p_project_ref AND s.target_identifier=lower(trim(p_target)) AND s.enabled AND p_action_type=ANY(s.allowed_action_types)) THEN RETURN v_result;END IF;
  SELECT id INTO v_override FROM public.linkedin_write_acceptance_overrides o WHERE o.project_ref=p_project_ref AND o.workspace_id=p_workspace_id
    AND o.linkedin_account_id=p_account_id AND o.target_identifier=lower(trim(p_target)) AND o.action_type=p_action_type
    AND o.purpose='controlled_write_acceptance' AND o.expires_at>now() AND o.consumed_at IS NULL AND o.disabled_at IS NULL
    AND(o.reserved_task_id IS NULL OR(o.reserved_task_id=p_task_id AND o.reserved_idempotency_key=p_idempotency_key)) ORDER BY o.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN v_result;END IF;
  v_audit:=(v_result->>'audit_id')::uuid;
  UPDATE public.linkedin_write_acceptance_overrides SET reserved_task_id=p_task_id,reserved_idempotency_key=p_idempotency_key WHERE id=v_override;
  UPDATE public.linkedin_write_audit SET preflight_result='allowed',execution_started_at=now(),acceptance_override_id=v_override WHERE id=v_audit;
  RETURN jsonb_build_object('allowed',true,'code','allowed','audit_id',v_audit,'already_done',false,'acceptance_override_id',v_override);
END $$;
REVOKE ALL ON FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) TO service_role;
