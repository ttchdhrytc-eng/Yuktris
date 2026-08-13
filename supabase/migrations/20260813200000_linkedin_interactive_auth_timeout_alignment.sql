/* Keep queue-scoped Live View authorization aligned with the bounded 30-minute
   human LinkedIn authentication lifecycle. */

CREATE OR REPLACE FUNCTION public.get_linkedin_login_access(
  p_workspace_id uuid, p_account_id uuid, p_queue_item_id uuid
) RETURNS TABLE(login_url text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_session_id text; v_connected_at timestamptz; v_url text; v_event_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_queue_item_id
    AND q.workspace_id=p_workspace_id AND q.account_id=p_account_id AND q.action_type='linkedin_connect'
    AND q.status IN ('pending','retry','running','waiting')) THEN RETURN; END IF;
  SELECT a.browserbase_session_id,a.browser_connected_at INTO v_session_id,v_connected_at
  FROM public.linkedin_accounts a WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id;
  IF v_session_id IS NULL OR v_connected_at IS NULL THEN RETURN; END IF;
  SELECT i.metadata->>'browserbase_live_url',i.created_at INTO v_url,v_event_at
  FROM public.linkedin_auth_interactions i WHERE i.workspace_id=p_workspace_id AND i.account_id=p_account_id
    AND i.queue_item_id=p_queue_item_id AND i.interaction_type='progress' AND i.step='auth_surface_ready'
    AND i.status='completed' AND i.metadata->>'browserbase_session_id'=v_session_id
  ORDER BY i.created_at DESC LIMIT 1;
  IF v_url IS NULL OR v_event_at < v_connected_at OR v_url !~* '^https://([a-z0-9-]+\.)*browserbase\.com/'
    OR v_url ~* '(^|[?&])(apiKey|api_key|connectUrl|wsUrl)=' THEN RETURN; END IF;
  IF now() >= least(v_connected_at + interval '30 minutes', v_event_at + interval '30 minutes') THEN RETURN; END IF;
  RETURN QUERY SELECT v_url, least(v_connected_at + interval '30 minutes', v_event_at + interval '30 minutes');
END $$;

REVOKE EXECUTE ON FUNCTION public.get_linkedin_login_access(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linkedin_login_access(uuid,uuid,uuid) TO authenticated;
