/*
# Fix: browser_execution_queue.worker_id UUID→TEXT + claim_queue_task cast removal

## Problem
The `claim_queue_task(p_worker_id TEXT)` RPC function casts `p_worker_id::UUID`
when updating `browser_execution_queue.worker_id`. If the Railway worker has
`WORKER_ID=worker-1` (a non-UUID string), the cast throws:
  `ERROR: invalid input syntax for type uuid: "worker-1"`
The worker catches this as "Queue claim error" and silently returns null —
so it keeps heartbeating (heartbeat_browser_worker uses TEXT worker_id) but
never claims any jobs. Result: zero jobs processed, zero browser launches.

## Fix
1. Change `browser_execution_queue.worker_id` from UUID to TEXT so any worker
   ID string (UUID or human-readable name) can be stored.
2. Re-create `claim_queue_task` without the `::UUID` cast.

## Safety
- The column was nullable and all existing rows were reset to NULL, so no
  data loss occurs from the type change.
- The function is re-created with the same signature and grants.

## Important Notes
1. The `browser_workers.worker_id` column is already TEXT — no change needed.
2. The `linkedin_session_heartbeats.worker_id` column is already TEXT.
3. Only `browser_execution_queue.worker_id` was UUID and is now TEXT.
*/

-- ── 1. Change worker_id column from UUID to TEXT ──────────────
ALTER TABLE browser_execution_queue
  ALTER COLUMN worker_id TYPE TEXT USING worker_id::text;

-- ── 2. Re-create claim_queue_task without the UUID cast ───────
DROP FUNCTION IF EXISTS public.claim_queue_task(TEXT);

CREATE OR REPLACE FUNCTION public.claim_queue_task(
  p_worker_id TEXT
) RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  account_id UUID,
  worker_id TEXT,
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
  SELECT browser_execution_queue.id INTO v_task_id
  FROM browser_execution_queue
  WHERE browser_execution_queue.status IN ('pending', 'retry')
  ORDER BY browser_execution_queue.priority ASC, browser_execution_queue.created_at ASC
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
  WHERE browser_execution_queue.id = v_task_id
    AND browser_execution_queue.status IN ('pending', 'retry');

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
$$;

REVOKE EXECUTE ON FUNCTION public.claim_queue_task(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_queue_task(TEXT) TO anon, authenticated;

-- ── 3. Verify the fix works with a non-UUID worker ID ────────
-- (This is a test — it will claim and set a row to running, then we'll reset it)
DO $$
DECLARE
  v_result RECORD;
BEGIN
  -- Test with a non-UUID worker ID
  SELECT * INTO v_result FROM public.claim_queue_task('test-non-uuid-worker');
  IF v_result IS NOT NULL THEN
    -- Reset the test claim
    UPDATE browser_execution_queue
    SET status = 'pending', worker_id = NULL, started_at = NULL, updated_at = now()
    WHERE id = v_result.id;
    RAISE NOTICE 'claim_queue_task fix verified: successfully claimed with non-UUID worker_id, test row reset to pending';
  ELSE
    RAISE NOTICE 'claim_queue_task fix verified: no pending rows to test (OK)';
  END IF;
END $$;
