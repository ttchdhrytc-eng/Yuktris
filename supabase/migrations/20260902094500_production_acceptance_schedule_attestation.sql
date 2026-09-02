BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

CREATE FUNCTION public.validate_production_acceptance_schedule_exemption(
  p_task_id uuid,
  p_attempt_id uuid,
  p_worker_id text,
  p_authorization_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE;
  q public.browser_execution_queue%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_authorization_id;
  SELECT * INTO q FROM public.browser_execution_queue WHERE id=p_task_id;
  IF NOT FOUND OR a.id IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','acceptance_binding_missing');
  END IF;
  IF a.project_ref<>'aljpmtuekghwzrnuwkat' OR a.status<>'executing' OR a.expires_at<=now()
     OR a.queue_item_id<>q.id OR a.attempt_id<>p_attempt_id OR a.worker_id<>p_worker_id
     OR a.preflighted_at IS NOT NULL OR a.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','authorization_lifecycle_binding_denied');
  END IF;
  IF q.status<>'running' OR q.attempt_id<>p_attempt_id OR q.worker_id<>p_worker_id
     OR q.workspace_id<>a.workspace_id OR q.account_id<>a.linkedin_account_id
     OR q.action_type<>'connection_request' OR q.idempotency_key<>a.idempotency_key
     OR q.max_retries<>0 OR q.max_infrastructure_retries<>0 THEN
    RETURN jsonb_build_object('allowed',false,'code','queue_claim_binding_denied');
  END IF;
  IF q.action_params->>'production_acceptance_authorization_id'<>a.id::text
     OR lower(trim(q.action_params->>'profile_url'))<>a.canonical_target_url
     OR (q.action_params->>'expected_display_name') IS DISTINCT FROM a.expected_display_name
     OR coalesce((q.action_params->>'persistent_context_required')::boolean,false) IS NOT TRUE
     OR coalesce((q.action_params->>'acceptance_test_mode')::boolean,false) IS NOT TRUE
     OR q.action_params ? 'note' OR q.action_params ? 'message'
     OR nullif(trim(a.expected_display_name),'') IS NULL
     OR nullif(trim(a.approval_reference),'') IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','exact_acceptance_payload_binding_denied');
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.linkedin_browser_contexts c
    WHERE c.id=a.persistent_context_id AND c.workspace_id=a.workspace_id
      AND c.account_id=a.linkedin_account_id AND c.provider_context_id=a.provider_context_id
      AND c.provider='browserbase' AND c.status='active' AND c.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('allowed',false,'code','bound_context_not_active');
  END IF;
  RETURN jsonb_build_object('allowed',true,'code','production_acceptance_schedule_exempt',
    'authorization_id',a.id,'queue_item_id',q.id);
END $$;

REVOKE ALL ON FUNCTION public.validate_production_acceptance_schedule_exemption(uuid,uuid,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_production_acceptance_schedule_exemption(uuid,uuid,text,uuid)
  TO service_role;

COMMIT;
