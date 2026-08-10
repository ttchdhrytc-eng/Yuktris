/*
# Fix fail_queue_task to use correct column names in browser_dead_letter_queue
#
# The table has: original_queue_id (not queue_id), execution_id, account_id
# Also fix browser_execution_history to use correct column names if needed.
*/

DROP FUNCTION IF EXISTS public.fail_queue_task(UUID, TEXT, INTEGER, BOOLEAN);

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

    -- Write to execution history
    INSERT INTO browser_execution_history (workspace_id, queue_id, action_type, action_params, status, error, duration_ms, started_at, completed_at)
    VALUES (v_task.workspace_id, v_task.id, v_task.action_type, v_task.action_params, 'failed', p_error, p_duration_ms, v_task.started_at, now());

    -- Write to dead letter queue with correct column names
    INSERT INTO browser_dead_letter_queue (workspace_id, original_queue_id, account_id, action_type, action_params, failure_reason, retry_count, last_error)
    VALUES (v_task.workspace_id, v_task.id, v_task.account_id, v_task.action_type, v_task.action_params, p_error, v_task.retry_count, p_error);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fail_queue_task(UUID, TEXT, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_queue_task(UUID, TEXT, INTEGER, BOOLEAN) TO anon, authenticated;