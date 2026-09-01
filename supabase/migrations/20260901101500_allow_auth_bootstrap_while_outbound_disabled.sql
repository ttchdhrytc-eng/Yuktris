BEGIN;

CREATE OR REPLACE FUNCTION public.claim_linkedin_auth_task(p_worker_id text,p_lease_seconds integer DEFAULT 90)
RETURNS TABLE(id uuid,workspace_id uuid,account_id uuid,worker_id text,session_id uuid,agent_id uuid,
 action_type text,action_params jsonb,priority integer,priority_label text,status text,retry_count integer,
 max_retries integer,next_retry_at timestamptz,error text,result jsonb,scheduled_at timestamptz,
 started_at timestamptz,completed_at timestamptz,duration_ms integer,metadata jsonb,created_at timestamptz,
 updated_at timestamptz,attempt_id uuid,lease_expires_at timestamptz,idempotency_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE candidate record; claimed_id uuid; new_attempt uuid; lease_seconds integer:=greatest(60,least(p_lease_seconds,600));
BEGIN
  IF NOT public.is_process_unique_worker_identity(p_worker_id) THEN
    RAISE EXCEPTION 'invalid_process_unique_worker_identity' USING ERRCODE='22023';
  END IF;
  PERFORM public.recover_expired_browser_queue_leases(50);
  DELETE FROM public.linkedin_account_browser_leases l WHERE l.lease_expires_at<=now();
  FOR candidate IN SELECT q.id,q.workspace_id,q.account_id FROM public.browser_execution_queue q
    WHERE q.action_type='linkedin_connect' AND
      ((q.status='pending' AND (q.scheduled_at IS NULL OR q.scheduled_at<=now()))
       OR (q.status='retry' AND q.next_retry_at IS NOT NULL AND q.next_retry_at<=now()))
    ORDER BY q.priority,q.created_at FOR UPDATE SKIP LOCKED
  LOOP
    claimed_id:=NULL;new_attempt:=gen_random_uuid();
    IF candidate.account_id IS NOT NULL THEN
      INSERT INTO public.linkedin_account_browser_leases(account_id,workspace_id,queue_item_id,worker_id,attempt_id,lease_expires_at)
      VALUES(candidate.account_id,candidate.workspace_id,candidate.id,p_worker_id,new_attempt,now()+make_interval(secs=>lease_seconds))
      ON CONFLICT ON CONSTRAINT linkedin_account_browser_leases_pkey DO UPDATE SET workspace_id=excluded.workspace_id,
        queue_item_id=excluded.queue_item_id,worker_id=excluded.worker_id,attempt_id=excluded.attempt_id,
        lease_expires_at=excluded.lease_expires_at,updated_at=now()
      WHERE public.linkedin_account_browser_leases.lease_expires_at<=now() RETURNING queue_item_id INTO claimed_id;
      IF claimed_id IS DISTINCT FROM candidate.id THEN CONTINUE;END IF;
    END IF;
    UPDATE public.browser_execution_queue SET status='running',worker_id=p_worker_id,attempt_id=new_attempt,
      lease_expires_at=now()+make_interval(secs=>lease_seconds),started_at=now(),completed_at=NULL,next_retry_at=NULL,
      error=NULL,duration_ms=NULL,result=NULL,updated_at=now() WHERE browser_execution_queue.id=candidate.id RETURNING browser_execution_queue.id INTO claimed_id;
    EXIT;
  END LOOP;
  IF claimed_id IS NULL THEN RETURN;END IF;
  RETURN QUERY SELECT q.id,q.workspace_id,q.account_id,q.worker_id,q.session_id,q.agent_id,q.action_type,q.action_params,q.priority,
    q.priority_label,q.status,q.retry_count,q.max_retries,q.next_retry_at,q.error,q.result,q.scheduled_at,q.started_at,q.completed_at,
    q.duration_ms,q.metadata,q.created_at,q.updated_at,q.attempt_id,q.lease_expires_at,q.idempotency_key
    FROM public.browser_execution_queue q WHERE q.id=claimed_id;
END $$;

REVOKE ALL ON FUNCTION public.claim_linkedin_auth_task(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_linkedin_auth_task(text,integer) TO service_role;
COMMENT ON FUNCTION public.claim_linkedin_auth_task(text,integer) IS 'Claims only customer-initiated LinkedIn authentication bootstrap work; never outbound actions.';

COMMIT;
