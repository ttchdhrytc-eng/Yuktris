-- Fix: recover_orphaned_queue_tasks tries to insert with priority=0, but constraint requires 1-4
-- Also remove the log event insert — it's unnecessary and causes the constraint violation

CREATE OR REPLACE FUNCTION recover_orphaned_queue_tasks(p_timeout_minutes integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_cutoff timestamptz;
BEGIN
  v_cutoff := now() - (p_timeout_minutes || ' minutes')::interval;

  UPDATE browser_execution_queue
  SET status = 'pending',
      worker_id = NULL,
      started_at = NULL,
      error = 'Recovered from orphaned worker',
      updated_at = now()
  WHERE status IN ('running', 'processing')
    AND started_at IS NOT NULL
    AND started_at < v_cutoff
    AND worker_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION recover_orphaned_queue_tasks(integer) TO authenticated;
