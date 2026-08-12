/* Queue-scoped Live View authorization and same-attempt recovery requests. */

DROP FUNCTION IF EXISTS public.get_linkedin_login_access(uuid,uuid);
CREATE FUNCTION public.get_linkedin_login_access(
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
  IF now() >= least(v_connected_at + interval '30 minutes', v_event_at + interval '10 minutes') THEN RETURN; END IF;
  RETURN QUERY SELECT v_url, least(v_connected_at + interval '30 minutes', v_event_at + interval '10 minutes');
END $$;
REVOKE EXECUTE ON FUNCTION public.get_linkedin_login_access(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linkedin_login_access(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.request_linkedin_auth_surface_recovery(
  p_workspace_id uuid, p_account_id uuid, p_queue_item_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_queue_item_id
    AND q.workspace_id=p_workspace_id AND q.account_id=p_account_id AND q.action_type='linkedin_connect'
    AND q.status='running' AND q.lease_expires_at>now()) THEN RAISE EXCEPTION 'active LinkedIn connection attempt not found'; END IF;
  SELECT i.id INTO v_id FROM public.linkedin_auth_interactions i WHERE i.queue_item_id=p_queue_item_id
    AND i.interaction_type='auth_surface_recovery' AND i.status='pending' AND i.expires_at>now() ORDER BY i.created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.linkedin_auth_interactions(workspace_id,account_id,queue_item_id,interaction_type,step,message,status,expires_at)
    VALUES(p_workspace_id,p_account_id,p_queue_item_id,'auth_surface_recovery','live_view_disconnected',
      'Customer requested same-session secure-browser recovery','pending',now()+interval '30 seconds') RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_linkedin_auth_surface_recovery(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_linkedin_auth_surface_recovery(uuid,uuid,uuid) TO authenticated;
