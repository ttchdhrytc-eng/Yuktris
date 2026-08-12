/* Allow V1 LinkedIn login to discover identity inside Browserbase, then bind it once. */

CREATE OR REPLACE FUNCTION public.start_linkedin_connection(
  p_workspace_id uuid, p_linkedin_email text, p_display_name text DEFAULT NULL,
  p_expected_profile_url text DEFAULT NULL, p_existing_account_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS TABLE(account_id uuid, queue_item_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_account_id uuid; v_queue_id uuid; v_profile text; v_email text; v_display_name text;
  v_key text; v_existing_queue record; v_existing_profile text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_email := nullif(lower(trim(p_linkedin_email)), '');
  v_display_name := nullif(trim(p_display_name), '');
  v_profile := nullif(trim(p_expected_profile_url), '');
  IF v_profile IS NOT NULL AND v_profile !~* '^https://([a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9_%.-]+/?$' THEN
    RAISE EXCEPTION 'A valid LinkedIn profile URL is required';
  END IF;

  v_key := nullif(trim(p_idempotency_key), '');
  IF v_key IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text || ':connection:' || v_key, 0));
    SELECT q.id, q.account_id, q.action_params INTO v_existing_queue
    FROM public.browser_execution_queue q
    WHERE q.workspace_id=p_workspace_id AND q.idempotency_key=v_key
    FOR UPDATE;
    IF FOUND THEN
      IF v_existing_queue.action_params->>'linkedin_email' IS DISTINCT FROM v_email
        OR v_existing_queue.action_params->>'requested_expected_profile_url' IS DISTINCT FROM v_profile
        OR v_existing_queue.action_params->>'display_name' IS DISTINCT FROM v_display_name
        OR (v_existing_queue.action_params->>'existing_account_id')::uuid IS DISTINCT FROM p_existing_account_id THEN
        RAISE EXCEPTION 'idempotency key conflicts with a different connection request';
      END IF;
      RETURN QUERY SELECT v_existing_queue.account_id, v_existing_queue.id;
      RETURN;
    END IF;
  ELSE
    v_key := gen_random_uuid()::text;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_workspace_id::text || ':linkedin:' || coalesce(p_existing_account_id::text, v_email, v_key), 0));

  IF p_existing_account_id IS NOT NULL THEN
    SELECT id, expected_profile_url INTO v_account_id, v_existing_profile
    FROM public.linkedin_accounts
    WHERE id=p_existing_account_id AND workspace_id=p_workspace_id FOR UPDATE;
    IF v_account_id IS NULL THEN RAISE EXCEPTION 'LinkedIn account not found'; END IF;
    IF v_existing_profile IS NOT NULL AND v_profile IS NOT NULL
      AND lower(trim(trailing '/' from v_existing_profile)) <> lower(trim(trailing '/' from v_profile)) THEN
      RAISE EXCEPTION 'expected LinkedIn profile conflicts with the connected account';
    END IF;
    v_profile := coalesce(v_existing_profile, v_profile);
    UPDATE public.linkedin_accounts SET account_name=coalesce(v_display_name,account_name),
      linkedin_email=coalesce(v_email,linkedin_email), expected_profile_url=v_profile,
      connection_state='pending', status='pending_login', session_status='disconnected',
      last_error=NULL, browserbase_session_id=NULL, browser_connected_at=NULL, updated_at=now()
    WHERE id=v_account_id;
  ELSE
    IF v_email IS NOT NULL THEN
      SELECT id, expected_profile_url INTO v_account_id, v_existing_profile
      FROM public.linkedin_accounts
      WHERE workspace_id=p_workspace_id AND lower(linkedin_email)=v_email
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    END IF;
    IF v_account_id IS NULL THEN
      INSERT INTO public.linkedin_accounts
        (workspace_id, account_name, linkedin_email, expected_profile_url, status, session_status, connection_state)
      VALUES (p_workspace_id, coalesce(v_display_name,v_email,'LinkedIn account'),
        v_email, v_profile, 'pending_login', 'disconnected', 'pending')
      RETURNING id INTO v_account_id;
    ELSE
      IF v_existing_profile IS NOT NULL AND v_profile IS NOT NULL
        AND lower(trim(trailing '/' from v_existing_profile)) <> lower(trim(trailing '/' from v_profile)) THEN
        RAISE EXCEPTION 'expected LinkedIn profile conflicts with the connected account';
      END IF;
      v_profile := coalesce(v_existing_profile, v_profile);
      UPDATE public.linkedin_accounts SET expected_profile_url=v_profile, connection_state='pending',
        status='pending_login', session_status='disconnected', last_error=NULL,
        browserbase_session_id=NULL, browser_connected_at=NULL, updated_at=now()
      WHERE id=v_account_id;
    END IF;
  END IF;

  INSERT INTO public.browser_execution_queue
    (workspace_id, account_id, action_type, action_params, priority, priority_label, status, idempotency_key)
  VALUES (p_workspace_id, v_account_id, 'linkedin_connect',
    jsonb_build_object('linkedin_email',v_email,'expected_profile_url',v_profile,
      'requested_expected_profile_url',nullif(trim(p_expected_profile_url),''),
      'display_name',v_display_name,'existing_account_id',p_existing_account_id),
    1, 'critical', 'pending', v_key)
  RETURNING id INTO v_queue_id;

  INSERT INTO public.linkedin_session_events(workspace_id,account_id,event_type,event_data)
  VALUES (p_workspace_id,v_account_id,'created',jsonb_build_object('action','linkedin_connect'));
  RETURN QUERY SELECT v_account_id,v_queue_id;
END $$;

CREATE OR REPLACE FUNCTION public.bind_linkedin_account_identity(
  p_workspace_id uuid, p_account_id uuid, p_profile_url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_profile text := nullif(trim(p_profile_url), '');
  v_existing text;
BEGIN
  IF v_profile IS NULL OR v_profile !~* '^https://www\.linkedin\.com/in/[A-Za-z0-9_%.-]+/?$' THEN
    RAISE EXCEPTION 'A valid authenticated LinkedIn personal profile URL is required';
  END IF;

  SELECT coalesce(expected_profile_url, profile_url) INTO v_existing
  FROM public.linkedin_accounts
  WHERE id=p_account_id AND workspace_id=p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LinkedIn account not found in workspace'; END IF;

  IF v_existing IS NOT NULL
    AND lower(trim(trailing '/' from v_existing)) <> lower(trim(trailing '/' from v_profile)) THEN
    RAISE EXCEPTION 'Authenticated LinkedIn profile does not match the account being connected';
  END IF;

  UPDATE public.linkedin_accounts
  SET expected_profile_url=v_profile, profile_url=v_profile, updated_at=now()
  WHERE id=p_account_id AND workspace_id=p_workspace_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.start_linkedin_connection(uuid,text,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_linkedin_connection(uuid,text,text,text,uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bind_linkedin_account_identity(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_linkedin_account_identity(uuid,uuid,text) TO service_role;
