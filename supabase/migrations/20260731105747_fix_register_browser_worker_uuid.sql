/*
# Fix register_browser_worker to use gen_random_uuid for id, worker_id for text
*/

DROP FUNCTION IF EXISTS public.register_browser_worker(TEXT, TEXT, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.register_browser_worker(
  p_worker_id TEXT,
  p_worker_name TEXT,
  p_workspace_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check if worker already exists by worker_id
  SELECT id INTO v_id FROM browser_workers WHERE worker_id = p_worker_id LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE browser_workers
    SET status = 'idle', browser_version = p_metadata->>'chromium_version',
        metadata = p_metadata, updated_at = now()
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- Insert new worker with generated UUID
  INSERT INTO browser_workers (
    id, workspace_id, worker_id, provider, status, browser_version, metadata
  ) VALUES (
    gen_random_uuid(), p_workspace_id, p_worker_id, 'linkedin', 'idle',
    p_metadata->>'chromium_version', p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

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
  WHERE worker_id = p_worker_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_browser_worker(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_browser_worker(TEXT, TEXT, UUID, JSONB) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.heartbeat_browser_worker(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_browser_worker(TEXT, TEXT, JSONB) TO anon, authenticated;