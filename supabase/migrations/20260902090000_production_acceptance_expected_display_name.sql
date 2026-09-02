BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

ALTER TABLE public.linkedin_production_acceptance_authorizations
  ADD COLUMN expected_display_name text;

ALTER TABLE public.linkedin_production_acceptance_authorizations
  ADD CONSTRAINT production_acceptance_expected_display_name_nonempty
  CHECK (expected_display_name IS NULL OR nullif(trim(expected_display_name), '') IS NOT NULL);

DROP FUNCTION public.prepare_production_linkedin_acceptance(text,uuid,uuid,text,timestamptz,text);

CREATE FUNCTION public.prepare_production_linkedin_acceptance(
  p_project_ref text,
  p_workspace_id uuid,
  p_account_id uuid,
  p_canonical_target_url text,
  p_expected_display_name text,
  p_expires_at timestamptz,
  p_approval_reference text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_accounts%ROWTYPE; c public.linkedin_browser_contexts%ROWTYPE; v_id uuid; v_target text; v_name text;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  IF p_project_ref <> 'aljpmtuekghwzrnuwkat' THEN RAISE EXCEPTION 'production_project_binding_mismatch'; END IF;
  v_target:=lower(regexp_replace(trim(p_canonical_target_url),'/+$',''));
  v_name:=regexp_replace(trim(p_expected_display_name),'\s+',' ','g');
  IF v_target !~ '^https://www[.]linkedin[.]com/in/[a-z0-9%_-]+$' THEN RAISE EXCEPTION 'exact_canonical_linkedin_profile_url_required'; END IF;
  IF nullif(v_name,'') IS NULL THEN RAISE EXCEPTION 'expected_display_name_required'; END IF;
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
    canonical_target_url,expected_display_name,action_type,idempotency_key,approval_reference,expires_at
  ) VALUES(
    p_project_ref,p_workspace_id,p_account_id,c.id,c.provider_context_id,v_target,v_name,'connection_request',
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
  IF nullif(trim(a.expected_display_name),'') IS NULL THEN RAISE EXCEPTION 'expected_display_name_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_browser_contexts c WHERE c.id=a.persistent_context_id
      AND c.workspace_id=a.workspace_id AND c.account_id=a.linkedin_account_id AND c.provider_context_id=a.provider_context_id
      AND c.status='active' AND c.deleted_at IS NULL) THEN RAISE EXCEPTION 'bound_browser_context_not_reusable'; END IF;
  INSERT INTO public.browser_execution_queue(
    workspace_id,account_id,action_type,action_params,priority,priority_label,status,max_retries,
    max_infrastructure_retries,scheduled_at,idempotency_key,metadata
  ) VALUES(
    a.workspace_id,a.linkedin_account_id,'connection_request',jsonb_build_object(
      'profile_url',a.canonical_target_url,
      'expected_display_name',a.expected_display_name,
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

-- The original preflight remains the complete rate/health/idempotency implementation.
-- Rename it and put an expected-name binding check in front of it so queue tampering
-- cannot bypass the durable authorization before the write audit is consumed.
ALTER FUNCTION public.preflight_production_linkedin_acceptance_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)
  RENAME TO preflight_production_linkedin_acceptance_write_without_expected_name;

REVOKE ALL ON FUNCTION public.preflight_production_linkedin_acceptance_write_without_expected_name(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.preflight_production_linkedin_acceptance_write(
  p_task_id uuid,p_attempt_id uuid,p_workspace_id uuid,p_account_id uuid,p_action_type text,p_target text,
  p_idempotency_key text,p_project_ref text,p_campaign_id uuid DEFAULT NULL,p_contact_id uuid DEFAULT NULL,
  p_authorization_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_authorization_id;
  IF NOT FOUND OR nullif(trim(a.expected_display_name),'') IS NULL
     OR NOT EXISTS(
       SELECT 1 FROM public.browser_execution_queue q
       WHERE q.id=p_task_id
         AND (q.action_params->>'expected_display_name') IS NOT DISTINCT FROM a.expected_display_name
     ) THEN
    RETURN jsonb_build_object('allowed',false,'code','production_acceptance_expected_identity_binding_denied','already_done',false);
  END IF;
  RETURN public.preflight_production_linkedin_acceptance_write_without_expected_name(
    p_task_id,p_attempt_id,p_workspace_id,p_account_id,p_action_type,p_target,p_idempotency_key,p_project_ref,
    p_campaign_id,p_contact_id,p_authorization_id
  );
END $$;

REVOKE ALL ON FUNCTION public.prepare_production_linkedin_acceptance(text,uuid,uuid,text,text,timestamptz,text),
  public.arm_production_linkedin_acceptance(uuid),
  public.preflight_production_linkedin_acceptance_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_production_linkedin_acceptance(text,uuid,uuid,text,text,timestamptz,text),
  public.arm_production_linkedin_acceptance(uuid),
  public.preflight_production_linkedin_acceptance_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)
  TO service_role;

COMMIT;
