/* One-use staging acceptance override. It can bypass only working hours. */

CREATE TABLE public.linkedin_write_acceptance_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_ref text NOT NULL CHECK (project_ref = 'vdiqfiuqckaxdjkadinu'),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  target_identifier text NOT NULL,
  action_type text NOT NULL CHECK (action_type = 'connection_request'),
  purpose text NOT NULL CHECK (purpose = 'controlled_acceptance'),
  expires_at timestamptz NOT NULL,
  reserved_task_id uuid REFERENCES public.browser_execution_queue(id) ON DELETE SET NULL,
  reserved_idempotency_key text,
  consumed_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at <= created_at + interval '30 minutes')
);
ALTER TABLE public.linkedin_write_acceptance_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_write_acceptance_overrides FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.linkedin_write_acceptance_overrides TO service_role;

ALTER TABLE public.linkedin_write_audit
  ADD COLUMN acceptance_override_id uuid REFERENCES public.linkedin_write_acceptance_overrides(id) ON DELETE SET NULL;

ALTER FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid)
  RENAME TO preflight_linkedin_write_without_acceptance_override;

CREATE FUNCTION public.preflight_linkedin_write(
  p_task_id uuid, p_attempt_id uuid, p_workspace_id uuid, p_account_id uuid,
  p_action_type text, p_target text, p_idempotency_key text, p_project_ref text,
  p_campaign_id uuid DEFAULT NULL, p_contact_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE
  v_result jsonb; v_override uuid; v_audit uuid; a public.linkedin_accounts%ROWTYPE;
  u public.linkedin_daily_usage%ROWTYPE; v_local timestamp; v_used integer; v_limit integer; v_total integer;
BEGIN
  v_result := public.preflight_linkedin_write_without_acceptance_override(
    p_task_id,p_attempt_id,p_workspace_id,p_account_id,p_action_type,p_target,p_idempotency_key,p_project_ref,p_campaign_id,p_contact_id);
  IF v_result->>'code' <> 'outside_working_hours' THEN RETURN v_result; END IF;
  IF p_project_ref <> 'vdiqfiuqckaxdjkadinu' THEN RETURN v_result; END IF;

  SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id FOR UPDATE;
  v_local := now() AT TIME ZONE coalesce(a.timezone,'UTC');
  SELECT * INTO u FROM public.linkedin_daily_usage WHERE linkedin_account_id=p_account_id AND usage_date=v_local::date FOR UPDATE;
  v_used := CASE WHEN p_action_type='connection_request' THEN coalesce(u.connections_sent,0) ELSE coalesce(u.messages_sent,0) END;
  v_limit := CASE WHEN p_action_type='connection_request' THEN a.daily_connection_limit ELSE a.daily_message_limit END;
  v_total := coalesce((a.metadata->>'daily_total_action_limit')::integer,a.daily_connection_limit+a.daily_message_limit);
  IF v_used>=v_limit OR coalesce(u.total_actions,0)>=v_total THEN RETURN v_result; END IF;
  IF a.last_activity_at IS NOT NULL AND a.last_activity_at + make_interval(secs=>coalesce((a.metadata->>'minimum_write_interval_seconds')::integer,30)) > now() THEN RETURN v_result; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.linkedin_safe_write_targets s WHERE s.workspace_id=p_workspace_id
      AND s.linkedin_account_id=p_account_id AND s.project_ref=p_project_ref
      AND s.target_identifier=lower(trim(p_target)) AND s.enabled AND p_action_type=ANY(s.allowed_action_types)) THEN RETURN v_result; END IF;

  SELECT id INTO v_override FROM public.linkedin_write_acceptance_overrides o
   WHERE o.project_ref=p_project_ref AND o.workspace_id=p_workspace_id AND o.linkedin_account_id=p_account_id
     AND o.target_identifier=lower(trim(p_target)) AND o.action_type=p_action_type
     AND o.purpose='controlled_acceptance' AND o.expires_at>now() AND o.consumed_at IS NULL AND o.disabled_at IS NULL
     AND (o.reserved_task_id IS NULL OR (o.reserved_task_id=p_task_id AND o.reserved_idempotency_key=p_idempotency_key))
   ORDER BY o.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN v_result; END IF;
  v_audit := (v_result->>'audit_id')::uuid;
  UPDATE public.linkedin_write_acceptance_overrides SET reserved_task_id=p_task_id,reserved_idempotency_key=p_idempotency_key WHERE id=v_override;
  UPDATE public.linkedin_write_audit SET preflight_result='allowed',execution_started_at=now(),acceptance_override_id=v_override WHERE id=v_audit;
  RETURN jsonb_build_object('allowed',true,'code','allowed','audit_id',v_audit,'already_done',false,'acceptance_override_id',v_override);
END $$;

ALTER FUNCTION public.finalize_linkedin_write(uuid,boolean,text) RENAME TO finalize_linkedin_write_without_acceptance_override;
CREATE FUNCTION public.finalize_linkedin_write(p_audit_id uuid,p_success boolean,p_classification text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_override uuid;
BEGIN
  SELECT acceptance_override_id INTO v_override FROM public.linkedin_write_audit WHERE id=p_audit_id;
  PERFORM public.finalize_linkedin_write_without_acceptance_override(p_audit_id,p_success,p_classification);
  IF v_override IS NOT NULL THEN UPDATE public.linkedin_write_acceptance_overrides SET consumed_at=now(),disabled_at=now() WHERE id=v_override; END IF;
END $$;

REVOKE ALL ON FUNCTION public.preflight_linkedin_write_without_acceptance_override(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_linkedin_write_without_acceptance_override(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finalize_linkedin_write(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_linkedin_write(uuid,boolean,text) TO service_role;
