/* Phase 2A: secure LinkedIn connection start, worker RPCs, and queue leases. */

ALTER TABLE public.browser_execution_queue
  ADD COLUMN IF NOT EXISTS attempt_id uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.linkedin_accounts
  ADD COLUMN IF NOT EXISTS expected_profile_url text;

-- Rows claimed before leases existed cannot prove current ownership. Reset them
-- transactionally so they can be safely claimed with a fresh attempt and lease.
UPDATE public.browser_execution_queue SET
  status='pending', worker_id=NULL, attempt_id=NULL, lease_expires_at=NULL,
  started_at=NULL, completed_at=NULL, duration_ms=NULL, result=NULL,
  next_retry_at=NULL, error='Reset during queue lease migration', updated_at=now()
WHERE status='running';

ALTER TABLE public.linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_connection_state_check;
ALTER TABLE public.linkedin_accounts ADD CONSTRAINT linkedin_accounts_connection_state_check CHECK (
  connection_state IN ('pending','creating_session','session_created','connecting_browser','connected',
    'opening_linkedin','ready_for_login','authenticated','authenticating','requires_action',
    'session_expired','session_invalid','restricted','disconnected','failed','cancelled')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_browser_queue_idempotency
  ON public.browser_execution_queue(workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_browser_queue_claimable
  ON public.browser_execution_queue(status, next_retry_at, lease_expires_at, priority, created_at);

DROP FUNCTION IF EXISTS public.claim_queue_task(text);
CREATE FUNCTION public.claim_queue_task(p_worker_id text, p_lease_seconds integer DEFAULT 90)
RETURNS TABLE(
  id uuid, workspace_id uuid, account_id uuid, worker_id text, session_id uuid,
  agent_id uuid, action_type text, action_params jsonb, priority integer,
  priority_label text, status text, retry_count integer, max_retries integer,
  next_retry_at timestamptz, error text, result jsonb, scheduled_at timestamptz,
  started_at timestamptz, completed_at timestamptz, duration_ms integer,
  metadata jsonb, created_at timestamptz, updated_at timestamptz,
  attempt_id uuid, lease_expires_at timestamptz, idempotency_key text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_task_id uuid; v_attempt_id uuid := gen_random_uuid();
BEGIN
  SELECT q.id INTO v_task_id
  FROM public.browser_execution_queue q
  WHERE
    (q.status = 'pending' AND (q.scheduled_at IS NULL OR q.scheduled_at <= now()))
    OR (q.status = 'retry' AND q.next_retry_at IS NOT NULL AND q.next_retry_at <= now())
    OR (q.status = 'running' AND q.lease_expires_at IS NOT NULL AND q.lease_expires_at <= now())
  ORDER BY CASE WHEN q.status = 'running' THEN 1 ELSE 0 END, q.priority, q.created_at
  LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF v_task_id IS NULL THEN RETURN; END IF;

  UPDATE public.browser_execution_queue q SET
    status = 'running', worker_id = p_worker_id, attempt_id = v_attempt_id,
    lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 600))),
    started_at = now(), completed_at = NULL, next_retry_at=NULL, error=NULL,
    duration_ms=NULL, result=NULL, updated_at = now()
  WHERE q.id = v_task_id;

  RETURN QUERY SELECT q.id, q.workspace_id, q.account_id, q.worker_id, q.session_id,
    q.agent_id, q.action_type, q.action_params, q.priority, q.priority_label,
    q.status, q.retry_count, q.max_retries, q.next_retry_at, q.error, q.result,
    q.scheduled_at, q.started_at, q.completed_at, q.duration_ms, q.metadata,
    q.created_at, q.updated_at, q.attempt_id, q.lease_expires_at, q.idempotency_key
  FROM public.browser_execution_queue q WHERE q.id = v_task_id;
END $$;

CREATE OR REPLACE FUNCTION public.renew_queue_lease(
  p_task_id uuid, p_worker_id text, p_attempt_id uuid, p_lease_seconds integer DEFAULT 90
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_updated integer;
BEGIN
  UPDATE public.browser_execution_queue SET
    lease_expires_at = now() + make_interval(secs => greatest(30, least(p_lease_seconds, 600))),
    updated_at = now()
  WHERE id = p_task_id AND status = 'running' AND worker_id = p_worker_id
    AND attempt_id = p_attempt_id AND lease_expires_at > now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END $$;

CREATE OR REPLACE FUNCTION public.recover_orphaned_queue_tasks(p_timeout_minutes integer DEFAULT 10)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
  -- p_timeout_minutes remains for API compatibility. Lease expiry is the sole
  -- source of truth, so a live interactive login is never reclaimed by age.
  UPDATE public.browser_execution_queue SET status='pending', worker_id=NULL,
    attempt_id=NULL, lease_expires_at=NULL, started_at=NULL,
    error='Recovered after worker lease expired', updated_at=now()
  WHERE status='running' AND lease_expires_at IS NOT NULL AND lease_expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

DROP FUNCTION IF EXISTS public.complete_queue_task(uuid, jsonb, integer);
CREATE FUNCTION public.complete_queue_task(
  p_task_id uuid, p_worker_id text, p_attempt_id uuid, p_result jsonb, p_duration_ms integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_task record;
BEGIN
  SELECT * INTO v_task FROM public.browser_execution_queue
  WHERE id = p_task_id AND status = 'running' AND worker_id = p_worker_id
    AND attempt_id = p_attempt_id AND lease_expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'queue claim ownership lost'; END IF;
  UPDATE public.browser_execution_queue SET status='completed', result=p_result,
    completed_at=now(), duration_ms=p_duration_ms, next_retry_at=NULL,
    lease_expires_at=NULL, updated_at=now()
  WHERE id=p_task_id;
  INSERT INTO public.browser_execution_history
    (workspace_id, queue_id, action_type, action_params, status, result, duration_ms, started_at, completed_at)
  VALUES (v_task.workspace_id, v_task.id, v_task.action_type, v_task.action_params,
    'completed', p_result, p_duration_ms, v_task.started_at, now());
END $$;

DROP FUNCTION IF EXISTS public.fail_queue_task(uuid, text, integer, boolean);
CREATE FUNCTION public.fail_queue_task(
  p_task_id uuid, p_worker_id text, p_attempt_id uuid, p_error text,
  p_duration_ms integer, p_retryable boolean DEFAULT true
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_task record; v_next_retry timestamptz;
BEGIN
  SELECT * INTO v_task FROM public.browser_execution_queue
  WHERE id=p_task_id AND status='running' AND worker_id=p_worker_id
    AND attempt_id=p_attempt_id AND lease_expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'queue claim ownership lost'; END IF;
  IF p_retryable AND v_task.retry_count < v_task.max_retries THEN
    v_next_retry := now() + least(60 * power(2, v_task.retry_count), 3600) * interval '1 second';
    UPDATE public.browser_execution_queue SET status='retry', error=p_error,
      retry_count=v_task.retry_count+1, next_retry_at=v_next_retry, completed_at=now(),
      duration_ms=p_duration_ms, worker_id=NULL, attempt_id=NULL, lease_expires_at=NULL, updated_at=now()
    WHERE id=p_task_id;
  ELSE
    UPDATE public.browser_execution_queue SET status='failed', error=p_error,
      completed_at=now(), duration_ms=p_duration_ms, lease_expires_at=NULL, updated_at=now()
    WHERE id=p_task_id;
    INSERT INTO public.browser_execution_history
      (workspace_id, queue_id, action_type, action_params, status, error, duration_ms, started_at, completed_at)
    VALUES (v_task.workspace_id, v_task.id, v_task.action_type, v_task.action_params,
      'failed', p_error, p_duration_ms, v_task.started_at, now());
    INSERT INTO public.browser_dead_letter_queue
      (id, workspace_id, execution_id, original_queue_id, account_id, action_type,
       action_params, failure_reason, retry_count, last_error)
    VALUES (gen_random_uuid(), v_task.workspace_id, gen_random_uuid(), v_task.id,
      v_task.account_id, v_task.action_type, v_task.action_params, p_error,
      v_task.retry_count, p_error);
  END IF;
END $$;

-- The legacy one-argument SECURITY DEFINER overload has no ownership check.
REVOKE EXECUTE ON FUNCTION public.set_queue_item_waiting(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.set_queue_item_waiting(uuid);

CREATE OR REPLACE FUNCTION public.set_queue_item_waiting(
  p_queue_item_id uuid, p_worker_id text, p_attempt_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.browser_execution_queue SET status='waiting', lease_expires_at=NULL, updated_at=now()
  WHERE id=p_queue_item_id AND status='running' AND worker_id=p_worker_id
    AND attempt_id=p_attempt_id AND lease_expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'queue claim ownership lost'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_linkedin_account_state(p_account_id uuid, p_updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_last_validated_at timestamptz; v_last_login_at timestamptz;
  v_browser_connected_at timestamptz; v_last_activity_at timestamptz;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION 'account updates must be a JSON object';
  END IF;
  IF (p_updates ? 'connection_state' AND p_updates->>'connection_state' IS NULL)
    OR (p_updates ? 'session_status' AND p_updates->>'session_status' IS NULL)
    OR (p_updates ? 'status' AND p_updates->>'status' IS NULL) THEN
    RAISE EXCEPTION 'account state fields cannot be null';
  END IF;
  IF p_updates ? 'connection_state' AND NOT (p_updates->>'connection_state' = ANY (ARRAY[
    'pending','creating_session','session_created','connecting_browser','connected','opening_linkedin',
    'ready_for_login','authenticated','authenticating','requires_action','session_expired',
    'session_invalid','restricted','disconnected','failed','cancelled'])) THEN
    RAISE EXCEPTION 'invalid connection_state';
  END IF;
  IF p_updates ? 'session_status' AND NOT (p_updates->>'session_status' = ANY
    (ARRAY['connected','disconnected','expired','reconnecting'])) THEN
    RAISE EXCEPTION 'invalid session_status';
  END IF;
  IF p_updates ? 'status' AND NOT (p_updates->>'status' = ANY
    (ARRAY['active','paused','restricted','banned','expired','pending_login','connected','disconnected','error'])) THEN
    RAISE EXCEPTION 'invalid account status';
  END IF;
  BEGIN
    v_last_validated_at := CASE WHEN p_updates ? 'last_validated_at' AND p_updates->>'last_validated_at' IS NOT NULL THEN (p_updates->>'last_validated_at')::timestamptz END;
    v_last_login_at := CASE WHEN p_updates ? 'last_login_at' AND p_updates->>'last_login_at' IS NOT NULL THEN (p_updates->>'last_login_at')::timestamptz END;
    v_browser_connected_at := CASE WHEN p_updates ? 'browser_connected_at' AND p_updates->>'browser_connected_at' IS NOT NULL THEN (p_updates->>'browser_connected_at')::timestamptz END;
    v_last_activity_at := CASE WHEN p_updates ? 'last_activity_at' AND p_updates->>'last_activity_at' IS NOT NULL THEN (p_updates->>'last_activity_at')::timestamptz END;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'invalid account timestamp';
  END;
  UPDATE public.linkedin_accounts SET
    connection_state = CASE WHEN p_updates ? 'connection_state' THEN p_updates->>'connection_state' ELSE connection_state END,
    session_status = CASE WHEN p_updates ? 'session_status' THEN p_updates->>'session_status' ELSE session_status END,
    status = CASE WHEN p_updates ? 'status' THEN p_updates->>'status' ELSE status END,
    last_validated_at = CASE WHEN p_updates ? 'last_validated_at' THEN v_last_validated_at ELSE last_validated_at END,
    last_login_at = CASE WHEN p_updates ? 'last_login_at' THEN v_last_login_at ELSE last_login_at END,
    last_error = CASE WHEN p_updates ? 'last_error' THEN p_updates->>'last_error' ELSE last_error END,
    profile_url = CASE WHEN p_updates ? 'profile_url' THEN p_updates->>'profile_url' ELSE profile_url END,
    profile_name = CASE WHEN p_updates ? 'profile_name' THEN p_updates->>'profile_name' ELSE profile_name END,
    profile_headline = CASE WHEN p_updates ? 'profile_headline' THEN p_updates->>'profile_headline' ELSE profile_headline END,
    browserbase_session_id = CASE WHEN p_updates ? 'browserbase_session_id' THEN p_updates->>'browserbase_session_id' ELSE browserbase_session_id END,
    browser_connected_at = CASE WHEN p_updates ? 'browser_connected_at' THEN v_browser_connected_at ELSE browser_connected_at END,
    last_activity_at = CASE WHEN p_updates ? 'last_activity_at' THEN v_last_activity_at ELSE last_activity_at END,
    updated_at=now()
  WHERE id=p_account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LinkedIn account not found'; END IF;
END $$;

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
  IF v_email IS NULL THEN RAISE EXCEPTION 'LinkedIn email is required'; END IF;
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

  -- Serializes account discovery/creation for callers using different request keys.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text || ':linkedin:' || v_email, 0));

  IF p_existing_account_id IS NOT NULL THEN
    SELECT id, expected_profile_url INTO v_account_id, v_existing_profile FROM public.linkedin_accounts
      WHERE id=p_existing_account_id AND workspace_id=p_workspace_id FOR UPDATE;
    IF v_account_id IS NULL THEN RAISE EXCEPTION 'LinkedIn account not found'; END IF;
    IF v_existing_profile IS NOT NULL AND v_profile IS NOT NULL
      AND lower(trim(trailing '/' from v_existing_profile)) <> lower(trim(trailing '/' from v_profile)) THEN
      RAISE EXCEPTION 'expected LinkedIn profile conflicts with the connected account';
    END IF;
    v_profile := coalesce(v_existing_profile, v_profile);
    IF v_profile IS NULL THEN RAISE EXCEPTION 'A valid LinkedIn profile URL is required'; END IF;
    UPDATE public.linkedin_accounts SET account_name=coalesce(v_display_name,account_name),
      linkedin_email=v_email, expected_profile_url=v_profile,
      connection_state='pending', status='pending_login', session_status='disconnected',
      last_error=NULL, browserbase_session_id=NULL, browser_connected_at=NULL, updated_at=now()
    WHERE id=v_account_id;
  ELSE
    SELECT id, expected_profile_url INTO v_account_id, v_existing_profile FROM public.linkedin_accounts
      WHERE workspace_id=p_workspace_id AND lower(linkedin_email)=v_email
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF v_account_id IS NULL THEN
      IF v_profile IS NULL THEN RAISE EXCEPTION 'A valid LinkedIn profile URL is required'; END IF;
      INSERT INTO public.linkedin_accounts
        (workspace_id, account_name, linkedin_email, expected_profile_url, status, session_status, connection_state)
      VALUES (p_workspace_id, coalesce(v_display_name,v_email),
        v_email, v_profile, 'pending_login', 'disconnected', 'pending')
      RETURNING id INTO v_account_id;
    ELSE
      IF v_existing_profile IS NOT NULL AND v_profile IS NOT NULL
        AND lower(trim(trailing '/' from v_existing_profile)) <> lower(trim(trailing '/' from v_profile)) THEN
        RAISE EXCEPTION 'expected LinkedIn profile conflicts with the connected account';
      END IF;
      v_profile := coalesce(v_existing_profile, v_profile);
      IF v_profile IS NULL THEN RAISE EXCEPTION 'A valid LinkedIn profile URL is required'; END IF;
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

CREATE OR REPLACE FUNCTION public.cancel_browser_execution(p_workspace_id uuid, p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.browser_execution_queue SET status='cancelled', completed_at=now(),
    lease_expires_at=NULL, updated_at=now()
  WHERE id=p_task_id AND workspace_id=p_workspace_id AND status IN ('pending','running','waiting','retry');
  IF NOT FOUND THEN RAISE EXCEPTION 'cancellable queue task not found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_account_browser_executions(p_workspace_id uuid, p_account_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id) THEN
    RAISE EXCEPTION 'LinkedIn account not found';
  END IF;
  UPDATE public.browser_execution_queue SET status='cancelled', completed_at=now(),
    lease_expires_at=NULL, updated_at=now()
  WHERE account_id=p_account_id AND workspace_id=p_workspace_id AND status IN ('pending','running','waiting','retry');
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_linkedin_connection_test(
  p_workspace_id uuid, p_account_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_queue_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.linkedin_accounts
    WHERE id=p_account_id AND workspace_id=p_workspace_id) THEN
    RAISE EXCEPTION 'LinkedIn account not found';
  END IF;
  INSERT INTO public.browser_execution_queue
    (workspace_id,account_id,action_type,action_params,priority,priority_label,status)
  VALUES (p_workspace_id,p_account_id,'linkedin_test_connection',
    jsonb_build_object('account_id',p_account_id),2,'high','pending')
  RETURNING id INTO v_queue_id;
  RETURN v_queue_id;
END $$;

DROP FUNCTION IF EXISTS public.load_latest_linkedin_session(uuid);
CREATE FUNCTION public.load_latest_linkedin_session(p_account_id uuid)
RETURNS SETOF public.linkedin_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_sessions SET status='expired', health_status='expired',
    connection_state='expired', failure_reason='Application session expiry reached', updated_at=now()
  WHERE account_id=p_account_id AND status='active' AND expires_at IS NOT NULL AND expires_at <= now();
  RETURN QUERY SELECT s.* FROM public.linkedin_sessions s
  WHERE s.account_id=p_account_id AND s.status='active'
    AND (s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY s.created_at DESC LIMIT 1;
END
$$;

-- Worker authority is service-role only. Frontend starts connections through the scoped RPC above.
REVOKE EXECUTE ON FUNCTION public.claim_queue_task(text,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.renew_queue_lease(uuid,text,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_queue_task(uuid,text,uuid,jsonb,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_queue_task(uuid,text,uuid,text,integer,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_queue_item_waiting(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_linkedin_account_state(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.load_latest_linkedin_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queue_task(text,integer), public.renew_queue_lease(uuid,text,uuid,integer),
  public.complete_queue_task(uuid,text,uuid,jsonb,integer), public.fail_queue_task(uuid,text,uuid,text,integer,boolean),
  public.set_queue_item_waiting(uuid,text,uuid), public.update_linkedin_account_state(uuid,jsonb),
  public.load_latest_linkedin_session(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.insert_auth_interaction(uuid,uuid,uuid,text,text,text,text,jsonb,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_linkedin_session(uuid,uuid,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_session_health(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_session_data(uuid,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_session(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_linkedin_connection(uuid,text,text,text,uuid,text),
  public.cancel_browser_execution(uuid,uuid),
  public.cancel_account_browser_executions(uuid,uuid),
  public.enqueue_linkedin_connection_test(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_linkedin_connection(uuid,text,text,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_browser_execution(uuid,uuid),
  public.cancel_account_browser_executions(uuid,uuid),
  public.enqueue_linkedin_connection_test(uuid,uuid) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.browser_execution_queue FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.insert_auth_interaction(uuid,uuid,uuid,text,text,text,text,jsonb,text,text),
  public.save_linkedin_session(uuid,uuid,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,jsonb),
  public.update_session_health(uuid,text,text,text), public.refresh_session_data(uuid,text,text,text,text,timestamptz,timestamptz),
  public.expire_session(uuid,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_browser_worker(text,text,uuid,jsonb),
  public.heartbeat_browser_worker(text,text,jsonb), public.set_browser_worker_closing(text),
  public.log_linkedin_session_event(uuid,uuid,text,jsonb), public.get_connected_accounts(),
  public.insert_session_heartbeat(uuid,uuid,text,text,jsonb), public.touch_account_activity(uuid),
  public.cleanup_old_heartbeats(timestamptz), public.cancel_queue_items_for_account(uuid),
  public.revoke_sessions_for_account(uuid,uuid), public.delete_session_backups_for_account(uuid,uuid),
  public.get_connected_linkedin_accounts(), public.recover_orphaned_queue_tasks(integer),
  public.cleanup_old_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_browser_worker(text,text,uuid,jsonb),
  public.heartbeat_browser_worker(text,text,jsonb), public.set_browser_worker_closing(text),
  public.log_linkedin_session_event(uuid,uuid,text,jsonb), public.get_connected_accounts(),
  public.insert_session_heartbeat(uuid,uuid,text,text,jsonb), public.touch_account_activity(uuid),
  public.cleanup_old_heartbeats(timestamptz), public.cancel_queue_items_for_account(uuid),
  public.revoke_sessions_for_account(uuid,uuid), public.delete_session_backups_for_account(uuid,uuid),
  public.get_connected_linkedin_accounts(), public.recover_orphaned_queue_tasks(integer),
  public.cleanup_old_sessions() TO service_role;

-- The frontend needs lifecycle metadata only. SECURITY INVOKER makes the
-- underlying linkedin_sessions RLS policies apply to the calling user.
CREATE OR REPLACE VIEW public.linkedin_session_public_view
WITH (security_invoker = true) AS
SELECT id, workspace_id, account_id, session_name, encrypted, encryption_key_id,
  user_agent, viewport, timezone, locale, language, browser_version,
  playwright_version, browserbase_session_id, browser_fingerprint, status,
  connection_state, health_status, authenticated, authenticated_at,
  last_validated_at, last_used_at, last_activity_at, expires_at, failure_reason,
  retry_count, metadata, created_at, updated_at
FROM public.linkedin_sessions
WHERE status IN ('active','expired','revoked');
ALTER VIEW public.linkedin_session_public_view OWNER TO postgres;
REVOKE ALL ON public.linkedin_session_public_view FROM PUBLIC, anon;
GRANT SELECT ON public.linkedin_session_public_view TO authenticated;

REVOKE SELECT ON public.linkedin_sessions FROM authenticated;
-- Required by the security-invoker view. This deliberately grants only the
-- same non-sensitive columns exposed by that view, never encrypted payloads.
GRANT SELECT (id, workspace_id, account_id, session_name, encrypted, encryption_key_id,
  user_agent, viewport, timezone, locale, language, browser_version,
  playwright_version, browserbase_session_id, browser_fingerprint, status,
  connection_state, health_status, authenticated, authenticated_at,
  last_validated_at, last_used_at, last_activity_at, expires_at, failure_reason,
  retry_count, metadata, created_at, updated_at)
ON public.linkedin_sessions TO authenticated;
DROP POLICY IF EXISTS "allow_all_forensic_log" ON public.linkedin_accounts_forensic_log;
CREATE POLICY "select_workspace_forensic_log" ON public.linkedin_accounts_forensic_log
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

-- Block all new secret writes before cleaning historical rows. NOT VALID skips
-- the initial full-table validation, but PostgreSQL enforces it for new writes.
-- Production preflight: record the affected row count, back up the database,
-- stop old clients that submit auth responses, and monitor lock/bloat impact.
ALTER TABLE public.linkedin_auth_interactions DROP CONSTRAINT IF EXISTS linkedin_auth_interactions_no_secrets;
ALTER TABLE public.linkedin_auth_interactions ADD CONSTRAINT linkedin_auth_interactions_no_secrets
  CHECK (user_response IS NULL) NOT VALID;
UPDATE public.linkedin_auth_interactions SET user_response=NULL WHERE user_response IS NOT NULL;
ALTER TABLE public.linkedin_auth_interactions VALIDATE CONSTRAINT linkedin_auth_interactions_no_secrets;

/*
Operational rollback procedure (do not automate destructively):
1. Before production, take a verified Supabase backup and record queue/auth row counts.
2. Pause workers and connection starts, apply in staging, and run ACL/lease/RLS tests.
3. If production application fails, keep workers paused and restore the pre-migration
   database backup; redeploy the matching pre-migration worker/frontend release.
4. Never attempt to restore user_response values separately; they are authentication
   secrets and their deletion is intentional. Resume only after queue ownership audit.
*/
