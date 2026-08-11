-- Private-beta launch closure: atomically reconcile browser queue outcomes.
-- Depends on 20260810090000_phase2a_linkedin_connection_hardening.sql.
BEGIN;

CREATE OR REPLACE FUNCTION public.complete_queue_task(
  p_task_id uuid, p_worker_id text, p_attempt_id uuid, p_result jsonb, p_duration_ms integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_task public.browser_execution_queue%ROWTYPE;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_task FROM public.browser_execution_queue
  WHERE id = p_task_id AND status = 'running' AND worker_id = p_worker_id
    AND attempt_id = p_attempt_id AND lease_expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'queue claim ownership lost'; END IF;

  IF coalesce(v_task.action_params->>'job_id', '') ~
     '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN
    v_job_id := (v_task.action_params->>'job_id')::uuid;
  END IF;

  UPDATE public.browser_execution_queue SET status='completed', result=p_result,
    completed_at=now(), duration_ms=p_duration_ms, next_retry_at=NULL,
    lease_expires_at=NULL, updated_at=now()
  WHERE id=p_task_id;

  INSERT INTO public.browser_execution_history
    (workspace_id, queue_id, action_type, action_params, status, result, duration_ms, started_at, completed_at)
  VALUES (v_task.workspace_id, v_task.id, v_task.action_type, v_task.action_params,
    'completed', p_result, p_duration_ms, v_task.started_at, now());

  IF v_job_id IS NOT NULL THEN
    UPDATE public.linkedin_execution_jobs
    SET status='completed', completed_at=now(), duration_ms=p_duration_ms,
        error_message=NULL, updated_at=now(),
        result_payload=coalesce(p_result, '{}'::jsonb) || jsonb_build_object(
          'queue_item_id', v_task.id,
          'idempotency_key', v_task.idempotency_key,
          'attempt_id', p_attempt_id
        )
    WHERE id=v_job_id AND workspace_id=v_task.workspace_id
      AND status IN ('queued','scheduled','running');

    UPDATE public.linkedin_action_history
    SET action_result='success', response_payload=coalesce(p_result, '{}'::jsonb) ||
          jsonb_build_object('queue_item_id', v_task.id, 'idempotency_key', v_task.idempotency_key),
        duration_ms=p_duration_ms, error_message=NULL
    WHERE execution_job_id=v_job_id AND workspace_id=v_task.workspace_id
      AND action_result='pending';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fail_queue_task(
  p_task_id uuid, p_worker_id text, p_attempt_id uuid, p_error text,
  p_duration_ms integer, p_retryable boolean DEFAULT true
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_task public.browser_execution_queue%ROWTYPE;
  v_next_retry timestamptz;
  v_job_id uuid;
  v_final_status text;
BEGIN
  SELECT * INTO v_task FROM public.browser_execution_queue
  WHERE id=p_task_id AND status='running' AND worker_id=p_worker_id
    AND attempt_id=p_attempt_id AND lease_expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'queue claim ownership lost'; END IF;

  IF coalesce(v_task.action_params->>'job_id', '') ~
     '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN
    v_job_id := (v_task.action_params->>'job_id')::uuid;
  END IF;

  IF p_retryable AND v_task.retry_count < v_task.max_retries THEN
    v_next_retry := now() + least(60 * power(2, v_task.retry_count), 3600) * interval '1 second';
    v_final_status := 'retry';
    UPDATE public.browser_execution_queue SET status='retry', error=p_error,
      retry_count=v_task.retry_count+1, next_retry_at=v_next_retry, completed_at=now(),
      duration_ms=p_duration_ms, worker_id=NULL, attempt_id=NULL, lease_expires_at=NULL, updated_at=now()
    WHERE id=p_task_id;
  ELSE
    v_final_status := 'failed';
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

  IF v_job_id IS NOT NULL THEN
    UPDATE public.linkedin_execution_jobs
    SET status=CASE WHEN v_final_status='retry' THEN 'scheduled' ELSE 'failed' END,
        scheduled_at=CASE WHEN v_final_status='retry' THEN v_next_retry ELSE scheduled_at END,
        completed_at=CASE WHEN v_final_status='failed' THEN now() ELSE NULL END,
        retry_count=CASE WHEN v_final_status='retry' THEN v_task.retry_count+1 ELSE retry_count END,
        duration_ms=p_duration_ms, error_message=p_error, updated_at=now(),
        result_payload=coalesce(result_payload, '{}'::jsonb) || jsonb_build_object(
          'queue_item_id', v_task.id,
          'idempotency_key', v_task.idempotency_key,
          'queue_status', v_final_status
        )
    WHERE id=v_job_id AND workspace_id=v_task.workspace_id
      AND status IN ('queued','scheduled','running');

    UPDATE public.linkedin_action_history
    SET action_result=CASE WHEN v_final_status='retry' THEN 'pending' ELSE 'failed' END,
        response_payload=jsonb_build_object('queue_item_id', v_task.id,
          'idempotency_key', v_task.idempotency_key, 'queue_status', v_final_status),
        duration_ms=p_duration_ms, error_message=p_error
    WHERE execution_job_id=v_job_id AND workspace_id=v_task.workspace_id
      AND action_result='pending';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.complete_queue_task(uuid,text,uuid,jsonb,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_queue_task(uuid,text,uuid,text,integer,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_queue_task(uuid,text,uuid,jsonb,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_queue_task(uuid,text,uuid,text,integer,boolean) TO service_role;

COMMIT;
