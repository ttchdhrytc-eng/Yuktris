/*
# Fix claim_queue_task ambiguous column reference
#
# The RETURN QUERY SELECT * was causing ambiguous column references
# because browser_execution_queue has a "status" column and the
# RETURNS TABLE also has a "status" column.
# Fix: qualify all column references with the table name.
*/

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
  v_task_id UUID;
BEGIN
  SELECT q.id INTO v_task_id
  FROM browser_execution_queue q
  WHERE q.status IN ('pending', 'retry')
  ORDER BY q.priority ASC, q.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_task_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE browser_execution_queue
  SET
    status = 'running',
    worker_id = p_worker_id::UUID,
    started_at = now(),
    updated_at = now()
  WHERE id = v_task_id AND status IN ('pending', 'retry');

  RETURN QUERY
  SELECT q.id, q.workspace_id, q.account_id, q.worker_id, q.session_id,
         q.agent_id, q.action_type, q.action_params, q.priority,
         q.priority_label, q.status, q.retry_count, q.max_retries,
         q.next_retry_at, q.error, q.result, q.scheduled_at,
         q.started_at, q.completed_at, q.duration_ms, q.metadata,
         q.created_at, q.updated_at
  FROM browser_execution_queue q
  WHERE q.id = v_task_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_queue_task(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_queue_task(TEXT) TO anon, authenticated;