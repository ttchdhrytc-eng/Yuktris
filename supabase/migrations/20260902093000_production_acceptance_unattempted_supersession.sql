BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

ALTER TABLE public.linkedin_production_acceptance_authorizations
  DROP CONSTRAINT production_acceptance_target_once,
  DROP CONSTRAINT linkedin_production_acceptance_authorizations_status_check;

ALTER TABLE public.linkedin_production_acceptance_authorizations
  ADD COLUMN supersedes_authorization_id uuid UNIQUE
    REFERENCES public.linkedin_production_acceptance_authorizations(id) ON DELETE RESTRICT,
  ADD COLUMN superseded_by uuid UNIQUE
    REFERENCES public.linkedin_production_acceptance_authorizations(id) ON DELETE RESTRICT,
  ADD COLUMN superseded_at timestamptz,
  ADD CONSTRAINT linkedin_production_acceptance_authorizations_status_check CHECK (status IN (
    'prepared','armed','executing','succeeded','failed','outcome_unknown','expired','revoked','superseded'
  )),
  ADD CONSTRAINT production_acceptance_supersession_shape CHECK (
    (status='superseded' AND superseded_at IS NOT NULL)
    OR (status<>'superseded' AND superseded_at IS NULL AND superseded_by IS NULL)
  );

CREATE UNIQUE INDEX production_acceptance_current_reservation_once
  ON public.linkedin_production_acceptance_authorizations(
    project_ref,workspace_id,linkedin_account_id,canonical_target_url,action_type
  ) WHERE superseded_at IS NULL;

CREATE OR REPLACE FUNCTION public.production_linkedin_acceptance_replacement_eligibility(p_existing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE; v_code text:='eligible';
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_existing_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('eligible',false,'code','authorization_missing'); END IF;

  IF a.status<>'prepared' THEN v_code:='not_pristine_prepared';
  ELSIF a.expires_at>now() THEN v_code:='authorization_not_expired';
  ELSIF a.queue_item_id IS NOT NULL OR a.worker_id IS NOT NULL OR a.attempt_id IS NOT NULL
     OR a.preflighted_at IS NOT NULL OR a.consumed_at IS NOT NULL OR a.completed_at IS NOT NULL THEN
    v_code:='execution_lifecycle_evidence_present';
  ELSIF a.superseded_at IS NOT NULL OR a.superseded_by IS NOT NULL THEN v_code:='already_superseded';
  ELSIF lower(coalesce(a.outcome->>'interaction_crossed','false'))='true' THEN v_code:='interaction_crossed_evidence_present';
  ELSIF lower(coalesce(a.outcome->>'result_code','')) IN ('outcome_unknown','ambiguous') THEN v_code:='ambiguous_outcome_present';
  ELSIF lower(coalesce(a.outcome->>'write_verified','false'))='true' THEN v_code:='successful_write_evidence_present';
  ELSIF a.outcome IS NULL OR a.outcome<>'{}'::jsonb THEN v_code:='outcome_or_uncertain_evidence_present';
  ELSIF EXISTS(
    SELECT 1 FROM public.browser_execution_queue q
    WHERE q.workspace_id=a.workspace_id AND q.account_id=a.linkedin_account_id AND q.action_type=a.action_type
      AND (
        q.action_params->>'production_acceptance_authorization_id'=a.id::text
        OR q.idempotency_key=a.idempotency_key
        OR lower(trim(q.action_params->>'profile_url'))=a.canonical_target_url
      )
  ) THEN v_code:='queue_evidence_present';
  ELSIF EXISTS(
    SELECT 1 FROM public.browser_execution_history h
    WHERE h.workspace_id=a.workspace_id AND h.account_id=a.linkedin_account_id AND h.action_type=a.action_type
      AND (
        h.action_params->>'production_acceptance_authorization_id'=a.id::text
        OR lower(trim(h.action_params->>'profile_url'))=a.canonical_target_url
      )
  ) THEN v_code:='queue_history_evidence_present';
  ELSIF EXISTS(
    SELECT 1 FROM public.linkedin_write_audit w
    WHERE w.workspace_id=a.workspace_id AND w.linkedin_account_id=a.linkedin_account_id
      AND w.action_type=a.action_type AND lower(trim(w.target_identifier))=a.canonical_target_url
  ) THEN v_code:='external_write_audit_present';
  ELSIF EXISTS(
    SELECT 1 FROM public.linkedin_write_interaction_events e
    JOIN public.browser_execution_queue q ON q.id=e.queue_item_id
    WHERE e.workspace_id=a.workspace_id AND e.linkedin_account_id=a.linkedin_account_id
      AND q.action_type=a.action_type
      AND (
        q.action_params->>'production_acceptance_authorization_id'=a.id::text
        OR lower(trim(q.action_params->>'profile_url'))=a.canonical_target_url
      )
  ) THEN v_code:='interaction_event_present';
  ELSIF EXISTS(
    SELECT 1 FROM public.linkedin_connection_acceptance_events ae
    JOIN public.contacts contact ON contact.id=ae.contact_id
    WHERE ae.workspace_id=a.workspace_id AND ae.linkedin_account_id=a.linkedin_account_id
      AND lower(regexp_replace(trim(contact.linkedin_url),'/+$',''))=a.canonical_target_url
  ) THEN v_code:='relationship_evidence_present';
  END IF;

  RETURN jsonb_build_object('eligible',v_code='eligible','code',v_code,'authorization_id',a.id);
END $$;

DROP FUNCTION public.prepare_production_linkedin_acceptance(text,uuid,uuid,text,text,timestamptz,text);

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
DECLARE
  account public.linkedin_accounts%ROWTYPE; context public.linkedin_browser_contexts%ROWTYPE;
  previous public.linkedin_production_acceptance_authorizations%ROWTYPE;
  eligibility jsonb; v_id uuid; v_target text; v_name text;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required'; END IF;
  IF p_project_ref<>'aljpmtuekghwzrnuwkat' THEN RAISE EXCEPTION 'production_project_binding_mismatch'; END IF;
  v_target:=lower(regexp_replace(trim(p_canonical_target_url),'/+$',''));
  v_name:=regexp_replace(trim(p_expected_display_name),'\s+',' ','g');
  IF v_target!~'^https://www[.]linkedin[.]com/in/[a-z0-9%_-]+$' THEN RAISE EXCEPTION 'exact_canonical_linkedin_profile_url_required'; END IF;
  IF nullif(v_name,'') IS NULL THEN RAISE EXCEPTION 'expected_display_name_required'; END IF;
  IF p_expires_at<=now()+interval '5 minutes' OR p_expires_at>now()+interval '24 hours' THEN RAISE EXCEPTION 'acceptance_expiration_out_of_range'; END IF;
  IF nullif(trim(p_approval_reference),'') IS NULL THEN RAISE EXCEPTION 'explicit_human_approval_reference_required'; END IF;

  SELECT * INTO account FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND OR account.status<>'active' OR account.connection_state<>'connected'
     OR account.session_status<>'connected' OR account.health_status<>'healthy' THEN
    RAISE EXCEPTION 'sender_account_not_healthy_connected';
  END IF;
  SELECT * INTO context FROM public.linkedin_browser_contexts
    WHERE workspace_id=p_workspace_id AND account_id=p_account_id AND status='active'
      AND provider='browserbase' AND provider_context_id IS NOT NULL AND deleted_at IS NULL
    ORDER BY generation DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reusable_production_browser_context_required'; END IF;

  SELECT * INTO previous FROM public.linkedin_production_acceptance_authorizations
    WHERE project_ref=p_project_ref AND workspace_id=p_workspace_id AND linkedin_account_id=p_account_id
      AND canonical_target_url=v_target AND action_type='connection_request' AND superseded_at IS NULL
    FOR UPDATE;
  IF FOUND THEN
    eligibility:=public.production_linkedin_acceptance_replacement_eligibility(previous.id);
    IF coalesce((eligibility->>'eligible')::boolean,false) IS NOT TRUE THEN
      RAISE EXCEPTION 'production_acceptance_replacement_denied:%',eligibility->>'code';
    END IF;
    IF trim(p_approval_reference)=trim(previous.approval_reference) THEN
      RAISE EXCEPTION 'fresh_human_approval_reference_required';
    END IF;
    UPDATE public.linkedin_production_acceptance_authorizations
      SET status='superseded',superseded_at=now(),updated_at=now()
      WHERE id=previous.id;
  END IF;

  INSERT INTO public.linkedin_production_acceptance_authorizations(
    project_ref,workspace_id,linkedin_account_id,persistent_context_id,provider_context_id,
    canonical_target_url,expected_display_name,action_type,idempotency_key,approval_reference,expires_at,
    supersedes_authorization_id
  ) VALUES(
    p_project_ref,p_workspace_id,p_account_id,context.id,context.provider_context_id,
    v_target,v_name,'connection_request','production-acceptance:'||gen_random_uuid()::text,
    trim(p_approval_reference),p_expires_at,previous.id
  ) RETURNING id INTO v_id;

  IF previous.id IS NOT NULL THEN
    UPDATE public.linkedin_production_acceptance_authorizations SET superseded_by=v_id,updated_at=now()
      WHERE id=previous.id;
  END IF;
  RETURN jsonb_build_object('authorization_id',v_id,'status','prepared','executable',false,
    'expires_at',p_expires_at,'supersedes_authorization_id',previous.id);
END $$;

REVOKE UPDATE,DELETE,TRUNCATE ON public.linkedin_production_acceptance_authorizations FROM service_role;
REVOKE ALL ON FUNCTION public.production_linkedin_acceptance_replacement_eligibility(uuid),
  public.prepare_production_linkedin_acceptance(text,uuid,uuid,text,text,timestamptz,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.production_linkedin_acceptance_replacement_eligibility(uuid),
  public.prepare_production_linkedin_acceptance(text,uuid,uuid,text,text,timestamptz,text)
  TO service_role;

COMMIT;
