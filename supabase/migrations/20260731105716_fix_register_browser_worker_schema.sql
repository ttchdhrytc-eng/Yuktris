/*
# Fix register_browser_worker to match actual browser_workers schema
#
# The actual table has: worker_id, provider, browser_version, fingerprint,
# proxy_config, last_heartbeat, last_activity, total_tasks, total_errors, metadata
# (not worker_name, browser_type, actions_completed, etc.)
*/

DROP FUNCTION IF EXISTS public.register_browser_worker(TEXT, TEXT, UUID, JSONB);

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
  INSERT INTO browser_workers (
    id, workspace_id, worker_id, provider, status, browser_version, metadata
  ) VALUES (
    p_worker_id::UUID, p_workspace_id, p_worker_id, 'linkedin', 'idle',
    p_metadata->>'chromium_version', p_metadata
  )
  ON CONFLICT (id) DO UPDATE
  SET status = 'idle', browser_version = p_metadata->>'chromium_version',
      metadata = p_metadata, updated_at = now();
END;
$$;

-- Also fix heartbeat to use last_heartbeat column
DROP FUNCTION IF EXISTS public.heartbeat_browser_worker(TEXT, TEXT, JSONB);

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
  SET status = p_status,
      last_heartbeat = now(),
      metadata = p_metadata,
      updated_at = now()
  WHERE id = p_worker_id::UUID;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_browser_worker(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_browser_worker(TEXT, TEXT, UUID, JSONB) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.heartbeat_browser_worker(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_browser_worker(TEXT, TEXT, JSONB) TO anon, authenticated;