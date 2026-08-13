/* Stored-credential reconnect: fully qualified, fail-closed, and single-attempt. */
CREATE OR REPLACE FUNCTION public.start_linkedin_connection_with_stored_credentials(
  p_workspace_id uuid, p_account_id uuid, p_idempotency_key text DEFAULT NULL
) RETURNS TABLE(account_id uuid,queue_item_id uuid,queue_status text,reused boolean,credentials_configured boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_start record;
  v_credential_status text;
  v_context public.linkedin_browser_contexts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.linkedin_accounts AS a
    WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id
  ) THEN
    RAISE EXCEPTION 'linkedin_account_not_found';
  END IF;

  SELECT c.credentials_status INTO v_credential_status
  FROM public.linkedin_credentials AS c
  WHERE c.account_id=p_account_id AND c.workspace_id=p_workspace_id;
  IF v_credential_status IS NULL THEN
    RAISE EXCEPTION 'linkedin_credentials_missing';
  END IF;
  IF v_credential_status NOT IN ('configured','valid') THEN
    RAISE EXCEPTION 'linkedin_credentials_disabled';
  END IF;

  SELECT c.* INTO v_context
  FROM public.linkedin_browser_contexts AS c
  WHERE c.account_id=p_account_id AND c.workspace_id=p_workspace_id
    AND c.provider='browserbase' AND c.deleted_at IS NULL
  ORDER BY c.generation DESC LIMIT 1;
  IF v_context.id IS NULL THEN
    RAISE EXCEPTION 'linkedin_context_missing';
  END IF;
  IF v_context.provider_context_id IS NULL
    OR v_context.status NOT IN ('active','in_use') THEN
    RAISE EXCEPTION 'linkedin_context_unavailable';
  END IF;
  IF v_context.lease_expires_at>now() AND NOT EXISTS (
    SELECT 1 FROM public.browser_execution_queue AS active_q
    WHERE active_q.id=v_context.active_queue_item_id
      AND active_q.workspace_id=p_workspace_id AND active_q.account_id=p_account_id
      AND active_q.action_type='linkedin_connect'
      AND active_q.status IN ('pending','retry','running','waiting')
  ) THEN
    RAISE EXCEPTION 'linkedin_context_leased';
  END IF;

  SELECT * INTO v_start FROM public.start_linkedin_connection(
    p_workspace_id=>p_workspace_id,
    p_linkedin_email=>NULL,
    p_display_name=>NULL,
    p_expected_profile_url=>NULL,
    p_existing_account_id=>p_account_id,
    p_idempotency_key=>coalesce(nullif(trim(p_idempotency_key),''),gen_random_uuid()::text)
  );
  IF v_start.account_id IS NULL OR v_start.queue_item_id IS NULL THEN
    RAISE EXCEPTION 'linkedin_connection_attempt_missing';
  END IF;

  UPDATE public.browser_execution_queue AS q SET max_retries=0
  WHERE q.id=v_start.queue_item_id AND q.workspace_id=p_workspace_id
    AND q.account_id=p_account_id AND q.action_type='linkedin_connect';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'linkedin_connection_queue_mismatch';
  END IF;

  RETURN QUERY SELECT v_start.account_id,v_start.queue_item_id,v_start.queue_status,v_start.attempt_reused,true;
END $$;

REVOKE EXECUTE ON FUNCTION public.start_linkedin_connection_with_stored_credentials(uuid,uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_linkedin_connection_with_stored_credentials(uuid,uuid,text)
  TO authenticated;
