BEGIN;

CREATE TABLE IF NOT EXISTS public.linkedin_account_browser_leases (
  account_id uuid PRIMARY KEY REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  queue_item_id uuid NOT NULL REFERENCES public.browser_execution_queue(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  attempt_id uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(queue_item_id,attempt_id)
);
ALTER TABLE public.linkedin_account_browser_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_account_browser_leases FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.linkedin_account_browser_leases TO service_role;

DROP FUNCTION IF EXISTS public.claim_queue_task(text,integer);
CREATE FUNCTION public.claim_queue_task(p_worker_id text,p_lease_seconds integer DEFAULT 90)
RETURNS TABLE(id uuid,workspace_id uuid,account_id uuid,worker_id text,session_id uuid,agent_id uuid,
 action_type text,action_params jsonb,priority integer,priority_label text,status text,retry_count integer,
 max_retries integer,next_retry_at timestamptz,error text,result jsonb,scheduled_at timestamptz,
 started_at timestamptz,completed_at timestamptz,duration_ms integer,metadata jsonb,created_at timestamptz,
 updated_at timestamptz,attempt_id uuid,lease_expires_at timestamptz,idempotency_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE candidate record; claimed_id uuid; new_attempt uuid; lease_seconds integer:=greatest(30,least(p_lease_seconds,600));
BEGIN
  DELETE FROM public.linkedin_account_browser_leases l WHERE l.lease_expires_at<=now();
  UPDATE public.browser_execution_queue q SET
    status=CASE WHEN q.retry_count<q.max_retries THEN 'retry' ELSE 'failed' END,
    retry_count=CASE WHEN q.retry_count<q.max_retries THEN q.retry_count+1 ELSE q.retry_count END,
    next_retry_at=CASE WHEN q.retry_count<q.max_retries THEN now() ELSE NULL END,
    completed_at=CASE WHEN q.retry_count<q.max_retries THEN q.completed_at ELSE now() END,
    error=CASE WHEN q.retry_count<q.max_retries THEN 'Recovered after worker lease expired' ELSE 'Worker lease expired; retry budget exhausted' END,
    worker_id=NULL,attempt_id=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE q.status='running' AND q.lease_expires_at IS NOT NULL AND q.lease_expires_at<=now();

  FOR candidate IN SELECT q.id,q.workspace_id,q.account_id FROM public.browser_execution_queue q
    WHERE (q.status='pending' AND (q.scheduled_at IS NULL OR q.scheduled_at<=now()))
       OR (q.status='retry' AND q.next_retry_at IS NOT NULL AND q.next_retry_at<=now())
    ORDER BY q.priority,q.created_at FOR UPDATE SKIP LOCKED
  LOOP
    claimed_id:=NULL; new_attempt:=gen_random_uuid();
    IF candidate.account_id IS NOT NULL THEN
      INSERT INTO public.linkedin_account_browser_leases(account_id,workspace_id,queue_item_id,worker_id,attempt_id,lease_expires_at)
      VALUES(candidate.account_id,candidate.workspace_id,candidate.id,p_worker_id,new_attempt,now()+make_interval(secs=>lease_seconds))
      ON CONFLICT(account_id) DO UPDATE SET workspace_id=excluded.workspace_id,queue_item_id=excluded.queue_item_id,
        worker_id=excluded.worker_id,attempt_id=excluded.attempt_id,lease_expires_at=excluded.lease_expires_at,updated_at=now()
      WHERE public.linkedin_account_browser_leases.lease_expires_at<=now()
      RETURNING queue_item_id INTO claimed_id;
      IF claimed_id IS DISTINCT FROM candidate.id THEN CONTINUE; END IF;
    END IF;
    UPDATE public.browser_execution_queue q SET status='running',worker_id=p_worker_id,attempt_id=new_attempt,
      lease_expires_at=now()+make_interval(secs=>lease_seconds),started_at=now(),completed_at=NULL,next_retry_at=NULL,
      error=NULL,duration_ms=NULL,result=NULL,updated_at=now() WHERE q.id=candidate.id RETURNING q.id INTO claimed_id;
    EXIT;
  END LOOP;
  IF claimed_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT q.id,q.workspace_id,q.account_id,q.worker_id,q.session_id,q.agent_id,q.action_type,
    q.action_params,q.priority,q.priority_label,q.status,q.retry_count,q.max_retries,q.next_retry_at,q.error,
    q.result,q.scheduled_at,q.started_at,q.completed_at,q.duration_ms,q.metadata,q.created_at,q.updated_at,
    q.attempt_id,q.lease_expires_at,q.idempotency_key FROM public.browser_execution_queue q WHERE q.id=claimed_id;
END $$;

CREATE OR REPLACE FUNCTION public.renew_queue_lease(p_task_id uuid,p_worker_id text,p_attempt_id uuid,p_lease_seconds integer DEFAULT 90)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE task_account uuid; lease_seconds integer:=greatest(30,least(p_lease_seconds,600));
BEGIN
  SELECT q.account_id INTO task_account FROM public.browser_execution_queue q WHERE q.id=p_task_id AND q.status='running'
    AND q.worker_id=p_worker_id AND q.attempt_id=p_attempt_id AND q.lease_expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF task_account IS NOT NULL THEN
    UPDATE public.linkedin_account_browser_leases SET lease_expires_at=now()+make_interval(secs=>lease_seconds),updated_at=now()
    WHERE account_id=task_account AND queue_item_id=p_task_id AND worker_id=p_worker_id AND attempt_id=p_attempt_id AND lease_expires_at>now();
    IF NOT FOUND THEN RETURN false; END IF;
  END IF;
  UPDATE public.browser_execution_queue SET lease_expires_at=now()+make_interval(secs=>lease_seconds),updated_at=now()
  WHERE id=p_task_id AND status='running' AND worker_id=p_worker_id AND attempt_id=p_attempt_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.release_linkedin_account_browser_lease(p_task_id uuid,p_worker_id text,p_attempt_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  DELETE FROM public.linkedin_account_browser_leases WHERE queue_item_id=p_task_id AND worker_id=p_worker_id AND attempt_id=p_attempt_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.recover_orphaned_queue_tasks(p_timeout_minutes integer DEFAULT 10)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE recovered integer;
BEGIN
  DELETE FROM public.linkedin_account_browser_leases l WHERE l.lease_expires_at<=now();
  UPDATE public.browser_execution_queue q SET status=CASE WHEN q.retry_count<q.max_retries THEN 'retry' ELSE 'failed' END,
    retry_count=CASE WHEN q.retry_count<q.max_retries THEN q.retry_count+1 ELSE q.retry_count END,
    next_retry_at=CASE WHEN q.retry_count<q.max_retries THEN now() ELSE NULL END,
    completed_at=CASE WHEN q.retry_count<q.max_retries THEN q.completed_at ELSE now() END,
    error=CASE WHEN q.retry_count<q.max_retries THEN 'Recovered after worker lease expired' ELSE 'Worker lease expired; retry budget exhausted' END,
    worker_id=NULL,attempt_id=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE q.status='running' AND q.lease_expires_at IS NOT NULL AND q.lease_expires_at<=now();
  GET DIAGNOSTICS recovered=ROW_COUNT; RETURN recovered;
END $$;

REVOKE ALL ON FUNCTION public.claim_queue_task(text,integer),public.renew_queue_lease(uuid,text,uuid,integer),
 public.release_linkedin_account_browser_lease(uuid,text,uuid),public.recover_orphaned_queue_tasks(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queue_task(text,integer),public.renew_queue_lease(uuid,text,uuid,integer),
 public.release_linkedin_account_browser_lease(uuid,text,uuid),public.recover_orphaned_queue_tasks(integer) TO service_role;
COMMIT;
