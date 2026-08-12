/* Keep the authorized Live View available for the bounded human-auth window. */

CREATE OR REPLACE FUNCTION public.get_linkedin_login_access(
  p_workspace_id uuid,
  p_account_id uuid
) RETURNS TABLE(login_url text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_session_id text;
  v_connected_at timestamptz;
  v_connection_state text;
  v_url text;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT a.browserbase_session_id, a.browser_connected_at, a.connection_state
  INTO v_session_id, v_connected_at, v_connection_state
  FROM public.linkedin_accounts a
  WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'LinkedIn account not found'; END IF;
  IF v_session_id IS NULL OR v_connected_at IS NULL
    OR v_connection_state NOT IN ('pending','authenticating','requires_action') THEN
    RETURN;
  END IF;

  v_expires_at := v_connected_at + interval '30 minutes';
  IF now() >= v_expires_at THEN RETURN; END IF;

  SELECT i.metadata->>'browserbase_live_url' INTO v_url
  FROM public.linkedin_auth_interactions i
  WHERE i.workspace_id=p_workspace_id
    AND i.account_id=p_account_id
    AND i.metadata->>'browserbase_session_id'=v_session_id
    AND nullif(i.metadata->>'browserbase_live_url','') IS NOT NULL
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_url IS NULL
    OR v_url !~* '^https://([a-z0-9-]+\.)*browserbase\.com/'
    OR v_url ~* '(^|[?&])(apiKey|api_key|connectUrl|wsUrl)=' THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT v_url, v_expires_at;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_linkedin_login_access(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linkedin_login_access(uuid,uuid) TO authenticated;
