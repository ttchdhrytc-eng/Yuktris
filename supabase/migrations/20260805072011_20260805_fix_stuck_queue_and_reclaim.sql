/*
# Fix stuck queue items and improve claim_queue_task

1. Reset stuck 'running' queue items back to 'pending' so they can be re-claimed
2. Update claim_queue_task to also reclaim stale 'running' items (where worker died)
   - A 'running' item is considered stale if started_at is older than 5 minutes
   - This prevents items from being permanently stuck if a worker crashes mid-task
*/

-- Reset all currently stuck 'running' items back to 'pending'
UPDATE browser_execution_queue
SET status = 'pending', worker_id = NULL, started_at = NULL, updated_at = now()
WHERE status = 'running'
  AND started_at < now() - interval '5 minutes';

-- Also reset the specific stuck item from the user's attempt
UPDATE browser_execution_queue
SET status = 'pending', worker_id = NULL, started_at = NULL, updated_at = now()
WHERE id = 'dcaba37c-aaf6-4d49-803e-241a099879c0';

-- Update claim_queue_task to also reclaim stale 'running' items
CREATE OR REPLACE FUNCTION public.claim_queue_task(p_worker_id text)
RETURNS TABLE(
  id uuid, workspace_id uuid, account_id uuid, worker_id text, session_id uuid,
  agent_id uuid, action_type text, action_params jsonb, priority integer,
  priority_label text, status text, retry_count integer, max_retries integer,
  next_retry_at timestamp with time zone, error text, result jsonb,
  scheduled_at timestamp with time zone, started_at timestamp with time zone,
  completed_at timestamp with time zone, duration_ms integer, metadata jsonb,
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_task_id UUID;
BEGIN
  -- Claim pending/retry items first, then stale running items (worker died)
  SELECT browser_execution_queue.id INTO v_task_id
  FROM browser_execution_queue
  WHERE browser_execution_queue.status IN ('pending', 'retry')
     OR (browser_execution_queue.status = 'running'
         AND browser_execution_queue.started_at < now() - interval '5 minutes')
  ORDER BY
    CASE WHEN browser_execution_queue.status IN ('pending', 'retry') THEN 0 ELSE 1 END,
    browser_execution_queue.priority ASC,
    browser_execution_queue.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_task_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE browser_execution_queue
  SET
    status = 'running',
    worker_id = p_worker_id,
    started_at = now(),
    updated_at = now()
  WHERE browser_execution_queue.id = v_task_id;

  RETURN QUERY
  SELECT browser_execution_queue.id, browser_execution_queue.workspace_id,
  browser_execution_queue.account_id, browser_execution_queue.worker_id,
  browser_execution_queue.session_id, browser_execution_queue.agent_id,
  browser_execution_queue.action_type, browser_execution_queue.action_params,
  browser_execution_queue.priority, browser_execution_queue.priority_label,
  browser_execution_queue.status, browser_execution_queue.retry_count,
  browser_execution_queue.max_retries, browser_execution_queue.next_retry_at,
  browser_execution_queue.error, browser_execution_queue.result,
  browser_execution_queue.scheduled_at, browser_execution_queue.started_at,
  browser_execution_queue.completed_at, browser_execution_queue.duration_ms,
  browser_execution_queue.metadata, browser_execution_queue.created_at,
  browser_execution_queue.updated_at
  FROM browser_execution_queue
  WHERE browser_execution_queue.id = v_task_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_queue_task TO anon, authenticated;
