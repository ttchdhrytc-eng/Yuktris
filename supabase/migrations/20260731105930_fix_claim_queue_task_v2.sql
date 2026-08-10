DROP FUNCTION IF EXISTS public.claim_queue_task(TEXT);

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
  v_task_row RECORD;
BEGIN
  SELECT * INTO v_task_row
  FROM browser_execution_queue
  WHERE browser_execution_queue.status IN ('pending', 'retry')
  ORDER BY browser_execution_queue.priority ASC, browser_execution_queue.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_task_row.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE browser_execution_queue
  SET
    status = 'running',
    worker_id = p_worker_id::UUID,
    started_at = now(),
    updated_at = now()
  WHERE id = v_task_row.id AND status IN ('pending', 'retry');

  RETURN QUERY
  SELECT * FROM browser_execution_queue
  WHERE id = v_task_row.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_queue_task(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_queue_task(TEXT) TO anon, authenticated;