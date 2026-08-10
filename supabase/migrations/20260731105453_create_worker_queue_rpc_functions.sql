/*
# Worker Queue RPC Functions
#
# SECURITY DEFINER functions that allow the browser worker to atomically
# claim, complete, and fail queue tasks using the anon key.
*/

-- ── claim_queue_task ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_queue_task(
  p_worker_id TEXT
) RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  account_id UUID,
  worker_id UUID,
  session_id UUID,
  agent_id UUID,
  action_type TEXT,
  action_params JSONB,
  priority INTEGER,
  priority_label TEXT,
  status TEXT,
  retry_count INTEGER,
  max_retries INTEGER,
  next_retry_at TIMESTAMPTZ,
  error TEXT,
  result JSONB,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
BEGIN
  SELECT * INTO v_task
  FROM browser_execution_queue
  WHERE status IN ('pending', 'retry')
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_task.id IS NULL THEN
    -- No task available — return empty result set
    RETURN;
  END IF;

  UPDATE browser_execution_queue
  SET
    status = 'running',
    worker_id = p_worker_id::UUID,
    started_at = now(),
    updated_at = now()
  WHERE id = v_task.id AND status IN ('pending', 'retry');

  RETURN QUERY SELECT * FROM browser_execution_queue WHERE id = v_task.id;
END;
$$;

-- ── complete_queue_task ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_queue_task(
  p_task_id UUID,
  p_result JSONB,
  p_duration_ms INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE browser_execution_queue
  SET status = 'completed', result = p_result, completed_at = now(), duration_ms = p_duration_ms, updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO browser_execution_history (workspace_id, queue_id, action_type, action_params, status, result, duration_ms, started_at, completed_at)
  SELECT workspace_id, id, action_type, action_params, 'completed', p_result, p_duration_ms, started_at, now()
  FROM browser_execution_queue WHERE id = p_task_id;
END;
$$;

-- ── fail_queue_task ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fail_queue_task(
  p_task_id UUID,
  p_error TEXT,
  p_duration_ms INTEGER,
  p_retryable BOOLEAN DEFAULT true
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_next_retry TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_task FROM browser_execution_queue WHERE id = p_task_id;
  IF v_task.id IS NULL THEN RETURN; END IF;

  IF p_retryable AND v_task.retry_count < v_task.max_retries THEN
    v_next_retry := now() + least(60 * power(2, v_task.retry_count), 3600) * interval '1 second';
    UPDATE browser_execution_queue
    SET status = 'retry', error = p_error, retry_count = v_task.retry_count + 1,
        next_retry_at = v_next_retry, completed_at = now(), duration_ms = p_duration_ms, updated_at = now()
    WHERE id = p_task_id;
  ELSE
    UPDATE browser_execution_queue
    SET status = 'failed', error = p_error, completed_at = now(), duration_ms = p_duration_ms, updated_at = now()
    WHERE id = p_task_id;

    INSERT INTO browser_execution_history (workspace_id, queue_id, action_type, action_params, status, error, duration_ms, started_at, completed_at)
    VALUES (v_task.workspace_id, v_task.id, v_task.action_type, v_task.action_params, 'failed', p_error, p_duration_ms, v_task.started_at, now());

    INSERT INTO browser_dead_letter_queue (workspace_id, queue_id, action_type, action_params, failure_reason, retry_count, last_error)
    VALUES (v_task.workspace_id, v_task.id, v_task.action_type, v_task.action_params, p_error, v_task.retry_count, p_error);
  END IF;
END;
$$;

-- ── register_browser_worker ────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_browser_worker(
  p_worker_id TEXT,
  p_worker_name TEXT,
  p_workspace_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO browser_workers (id, workspace_id, worker_name, browser_type, status, metadata)
  VALUES (p_worker_id::UUID, p_workspace_id, p_worker_name, 'chromium', 'idle', p_metadata)
  ON CONFLICT (id) DO UPDATE
  SET status = 'idle', metadata = p_metadata, updated_at = now();
END;
$$;

-- ── heartbeat_browser_worker ──────────────────────────────
CREATE OR REPLACE FUNCTION public.heartbeat_browser_worker(
  p_worker_id TEXT,
  p_status TEXT DEFAULT 'idle',
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE browser_workers
  SET status = p_status, updated_at = now(), metadata = p_metadata
  WHERE id = p_worker_id::UUID;
END;
$$;

-- ── update_linkedin_account_state ──────────────────────────
CREATE OR REPLACE FUNCTION public.update_linkedin_account_state(
  p_account_id UUID,
  p_updates JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE linkedin_accounts
  SET
    connection_state = COALESCE(p_updates->>'connection_state', connection_state),
    session_status = COALESCE(p_updates->>'session_status', session_status),
    status = COALESCE(p_updates->>'status', status),
    last_validated_at = COALESCE((p_updates->>'last_validated_at')::TIMESTAMPTZ, last_validated_at),
    last_login_at = COALESCE((p_updates->>'last_login_at')::TIMESTAMPTZ, last_login_at),
    last_error = COALESCE(p_updates->>'last_error', last_error),
    profile_url = COALESCE(p_updates->>'profile_url', profile_url),
    profile_name = COALESCE(p_updates->>'profile_name', profile_name),
    profile_headline = COALESCE(p_updates->>'profile_headline', profile_headline),
    updated_at = now()
  WHERE id = p_account_id;
END;
$$;

-- ── save_linkedin_session ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_linkedin_session(
  p_workspace_id UUID,
  p_account_id UUID,
  p_session_name TEXT,
  p_cookies_encrypted TEXT,
  p_storage_state_encrypted TEXT,
  p_local_storage_encrypted TEXT,
  p_session_storage_encrypted TEXT,
  p_encryption_key_id TEXT,
  p_user_agent TEXT,
  p_viewport JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO linkedin_sessions (
    workspace_id, account_id, session_name,
    cookies_encrypted, storage_state_encrypted,
    local_storage_encrypted, session_storage_encrypted,
    encrypted, encryption_key_id,
    user_agent, viewport,
    status, last_validated_at, last_used_at
  ) VALUES (
    p_workspace_id, p_account_id, p_session_name,
    p_cookies_encrypted, p_storage_state_encrypted,
    p_local_storage_encrypted, p_session_storage_encrypted,
    true, p_encryption_key_id,
    p_user_agent, p_viewport,
    'active', now(), now()
  ) RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

-- ── load_latest_linkedin_session ───────────────────────────
CREATE OR REPLACE FUNCTION public.load_latest_linkedin_session(
  p_account_id UUID
) RETURNS TABLE (
  id UUID,
  cookies_encrypted TEXT,
  storage_state_encrypted TEXT,
  local_storage_encrypted TEXT,
  session_storage_encrypted TEXT,
  encryption_key_id TEXT,
  user_agent TEXT,
  viewport JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT id, cookies_encrypted, storage_state_encrypted,
         local_storage_encrypted, session_storage_encrypted,
         encryption_key_id, user_agent, viewport
  FROM linkedin_sessions
  WHERE account_id = p_account_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;

-- ── log_linkedin_session_event ─────────────────────────────
CREATE OR REPLACE FUNCTION public.log_linkedin_session_event(
  p_workspace_id UUID,
  p_account_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO linkedin_session_events (workspace_id, account_id, event_type, event_data)
  VALUES (p_workspace_id, p_account_id, p_event_type, p_event_data);
END;
$$;

-- ── Permissions ────────────────────────────────────────────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_queue_task(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_queue_task(UUID, JSONB, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_queue_task(UUID, TEXT, INTEGER, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_browser_worker(TEXT, TEXT, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_browser_worker(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_linkedin_account_state(UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_linkedin_session(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_latest_linkedin_session(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_linkedin_session_event(UUID, UUID, TEXT, JSONB) TO anon, authenticated;
