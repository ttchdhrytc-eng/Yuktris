/* Phase A2: controlled enrollment, stale-session reconciliation, and provider cleanup outbox. */

CREATE TABLE public.linkedin_browser_context_enrollments (
  workspace_id uuid NOT NULL,
  account_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  enrolled_by text NOT NULL,
  enrollment_reason text,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT linkedin_browser_context_enrollments_account_workspace_fkey
    FOREIGN KEY (account_id, workspace_id) REFERENCES public.linkedin_accounts(id, workspace_id) ON DELETE RESTRICT
);
ALTER TABLE public.linkedin_browser_context_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_browser_context_enrollments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_browser_context_enrollments TO service_role;

CREATE TABLE public.linkedin_browser_context_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid UNIQUE REFERENCES public.linkedin_browser_contexts(id) ON DELETE SET NULL,
  workspace_id uuid NOT NULL,
  account_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider='browserbase'),
  provider_context_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','retry','completed')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  worker_id text,
  attempt_id uuid,
  lease_expires_at timestamptz,
  failure_code text,
  failure_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_linkedin_context_deletion_jobs_claim
  ON public.linkedin_browser_context_deletion_jobs(status,next_attempt_at,lease_expires_at,created_at);
ALTER TABLE public.linkedin_browser_context_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_browser_context_deletion_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_browser_context_deletion_jobs TO service_role;

CREATE FUNCTION public.get_linkedin_browser_context_policy(p_workspace_id uuid, p_account_id uuid)
RETURNS TABLE(enrolled boolean, has_persistent_context boolean)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.linkedin_browser_context_enrollments e
      WHERE e.workspace_id=p_workspace_id AND e.account_id=p_account_id AND e.enabled),
    EXISTS(SELECT 1 FROM public.linkedin_browser_contexts c
      WHERE c.workspace_id=p_workspace_id AND c.account_id=p_account_id AND c.deleted_at IS NULL)
  WHERE EXISTS(SELECT 1 FROM public.linkedin_accounts a WHERE a.workspace_id=p_workspace_id AND a.id=p_account_id)
$$;

CREATE FUNCTION public.set_linkedin_browser_context_enrollment(
  p_workspace_id uuid, p_account_id uuid, p_enabled boolean, p_enrolled_by text, p_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF nullif(trim(p_enrolled_by),'') IS NULL THEN RAISE EXCEPTION 'enrollment actor is required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_accounts a WHERE a.workspace_id=p_workspace_id AND a.id=p_account_id) THEN
    RAISE EXCEPTION 'LinkedIn account not found';
  END IF;
  INSERT INTO public.linkedin_browser_context_enrollments(workspace_id,account_id,enabled,enrolled_by,enrollment_reason,disabled_at)
  VALUES(p_workspace_id,p_account_id,p_enabled,left(trim(p_enrolled_by),128),left(nullif(trim(p_reason),''),256),
    CASE WHEN p_enabled THEN NULL ELSE now() END)
  ON CONFLICT(account_id) DO UPDATE SET enabled=EXCLUDED.enabled,enrolled_by=EXCLUDED.enrolled_by,
    enrollment_reason=EXCLUDED.enrollment_reason,disabled_at=EXCLUDED.disabled_at,
    enrolled_at=CASE WHEN EXCLUDED.enabled THEN now() ELSE linkedin_browser_context_enrollments.enrolled_at END,updated_at=now()
  WHERE linkedin_browser_context_enrollments.workspace_id=EXCLUDED.workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'workspace/account enrollment conflict'; END IF;
END $$;

CREATE FUNCTION public.reconcile_terminal_linkedin_browser_context_session(
  p_context_id uuid,p_queue_item_id uuid,p_worker_id text,p_attempt_id uuid,p_session_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET active_browserbase_session_id=NULL,
    last_synchronized_at=now(),status='in_use',updated_at=now()
  WHERE id=p_context_id AND active_queue_item_id=p_queue_item_id AND active_worker_id=p_worker_id
    AND active_attempt_id=p_attempt_id AND lease_expires_at>now()
    AND active_browserbase_session_id=p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'context lease/session ownership required'; END IF;
END $$;

-- A lease may be released after detecting an active/unknown stale provider
-- session. Preserve that reference so a later attempt cannot silently create a
-- second session against the same Context. Synchronization/deletion clears it.
CREATE OR REPLACE FUNCTION public.release_linkedin_browser_context_lease(
  p_context_id uuid,p_queue_item_id uuid,p_worker_id text,p_attempt_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET
    status=CASE WHEN provider_context_id IS NULL THEN 'failed' ELSE 'active' END,
    active_queue_item_id=NULL,active_worker_id=NULL,active_attempt_id=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE id=p_context_id AND active_queue_item_id=p_queue_item_id
    AND active_worker_id=p_worker_id AND active_attempt_id=p_attempt_id;
  RETURN FOUND;
END $$;

CREATE FUNCTION public.claim_linkedin_browser_context_provisioning(
  p_context_id uuid,p_workspace_id uuid,p_account_id uuid,p_queue_item_id uuid,p_worker_id text,p_attempt_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_queue_item_id
    AND q.workspace_id=p_workspace_id AND q.account_id=p_account_id AND q.status='running'
    AND q.worker_id=p_worker_id AND q.attempt_id=p_attempt_id AND q.lease_expires_at>now()) THEN
    RAISE EXCEPTION 'queue attempt ownership required';
  END IF;
  UPDATE public.linkedin_browser_contexts SET active_queue_item_id=p_queue_item_id,active_worker_id=p_worker_id,
    active_attempt_id=p_attempt_id,lease_expires_at=now()+interval '90 seconds',updated_at=now()
  WHERE id=p_context_id AND workspace_id=p_workspace_id AND account_id=p_account_id
    AND status='provisioning' AND provider_context_id IS NULL
    AND (lease_expires_at IS NULL OR lease_expires_at<=now()
      OR (active_queue_item_id=p_queue_item_id AND active_worker_id=p_worker_id AND active_attempt_id=p_attempt_id));
  RETURN FOUND;
END $$;

CREATE FUNCTION public.request_linkedin_browser_context_deletion(p_workspace_id uuid,p_account_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_context public.linkedin_browser_contexts; v_job uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_account_id::text || ':browserbase',0));
  SELECT * INTO v_context FROM public.linkedin_browser_contexts c
    WHERE c.workspace_id=p_workspace_id AND c.account_id=p_account_id AND c.deleted_at IS NULL FOR UPDATE;
  IF v_context.id IS NULL THEN RETURN NULL; END IF;
  IF v_context.provider_context_id IS NULL THEN
    UPDATE public.linkedin_browser_contexts SET status='deleted',deletion_requested_at=coalesce(deletion_requested_at,now()),
      deleted_at=now(),active_browserbase_session_id=NULL,active_queue_item_id=NULL,active_worker_id=NULL,
      active_attempt_id=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=v_context.id;
    DELETE FROM public.linkedin_browser_context_enrollments WHERE account_id=p_account_id AND workspace_id=p_workspace_id;
    DELETE FROM public.linkedin_browser_contexts WHERE id=v_context.id AND status='deleted';
    RETURN NULL;
  END IF;
  IF v_context.lease_expires_at>now() OR v_context.active_browserbase_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'persistent Context is active and cannot be deleted';
  END IF;
  UPDATE public.linkedin_browser_contexts SET status='deletion_pending',deletion_requested_at=coalesce(deletion_requested_at,now()),updated_at=now()
    WHERE id=v_context.id;
  INSERT INTO public.linkedin_browser_context_deletion_jobs(context_id,workspace_id,account_id,provider,provider_context_id)
    VALUES(v_context.id,p_workspace_id,p_account_id,v_context.provider,v_context.provider_context_id)
    ON CONFLICT(context_id) DO UPDATE SET status=CASE WHEN linkedin_browser_context_deletion_jobs.status='completed' THEN 'completed' ELSE 'pending' END,
      next_attempt_at=NULL,updated_at=now() RETURNING id INTO v_job;
  RETURN v_job;
END $$;

CREATE FUNCTION public.claim_linkedin_browser_context_deletion(p_worker_id text,p_lease_seconds integer DEFAULT 90)
RETURNS SETOF public.linkedin_browser_context_deletion_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid; v_attempt uuid:=gen_random_uuid();
BEGIN
  SELECT j.id INTO v_id FROM public.linkedin_browser_context_deletion_jobs j
  WHERE (j.status IN ('pending','retry') AND (j.next_attempt_at IS NULL OR j.next_attempt_at<=now()))
    OR (j.status='running' AND j.lease_expires_at<=now())
  ORDER BY j.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF v_id IS NULL THEN RETURN; END IF;
  UPDATE public.linkedin_browser_context_deletion_jobs SET status='running',worker_id=p_worker_id,attempt_id=v_attempt,
    lease_expires_at=now()+make_interval(secs=>greatest(30,least(p_lease_seconds,600))),attempt_count=attempt_count+1,
    failure_code=NULL,failure_message=NULL,updated_at=now() WHERE id=v_id;
  RETURN QUERY SELECT j.* FROM public.linkedin_browser_context_deletion_jobs j WHERE j.id=v_id;
END $$;

CREATE FUNCTION public.complete_linkedin_browser_context_deletion(p_job_id uuid,p_worker_id text,p_attempt_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_context uuid; v_account uuid; v_workspace uuid;
BEGIN
  SELECT context_id,account_id,workspace_id INTO v_context,v_account,v_workspace
    FROM public.linkedin_browser_context_deletion_jobs WHERE id=p_job_id AND status='running'
      AND worker_id=p_worker_id AND attempt_id=p_attempt_id AND lease_expires_at>now() FOR UPDATE;
  IF v_context IS NULL THEN RETURN false; END IF;
  UPDATE public.linkedin_browser_contexts SET status='deleted',deleted_at=now(),provider_context_id=NULL,
    active_browserbase_session_id=NULL,active_queue_item_id=NULL,active_worker_id=NULL,active_attempt_id=NULL,
    lease_expires_at=NULL,failure_code=NULL,failure_message=NULL,updated_at=now() WHERE id=v_context;
  UPDATE public.linkedin_browser_context_deletion_jobs SET status='completed',completed_at=now(),worker_id=NULL,
    attempt_id=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=p_job_id;
  DELETE FROM public.linkedin_browser_context_enrollments WHERE account_id=v_account AND workspace_id=v_workspace;
  DELETE FROM public.linkedin_browser_contexts WHERE id=v_context AND status='deleted';
  RETURN true;
END $$;

CREATE FUNCTION public.retry_linkedin_browser_context_deletion(
  p_job_id uuid,p_worker_id text,p_attempt_id uuid,p_failure_code text,p_failure_message text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.linkedin_browser_context_deletion_jobs SET status='retry',
    next_attempt_at=now()+make_interval(secs=>least(3600,greatest(30,(30*power(2,least(attempt_count,7)))::integer))),
    worker_id=NULL,attempt_id=NULL,lease_expires_at=NULL,
    failure_code=left(regexp_replace(coalesce(p_failure_code,'provider_error'),'[^a-zA-Z0-9_.-]','','g'),64),
    failure_message=left(regexp_replace(coalesce(p_failure_message,'Provider deletion failed'),
      '(https?|wss?)://[^[:space:]]+|[A-Za-z0-9_-]{32,}','[redacted]','gi'),256),updated_at=now()
  WHERE id=p_job_id AND status='running' AND worker_id=p_worker_id AND attempt_id=p_attempt_id AND lease_expires_at>now();
  RETURN FOUND;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_linkedin_browser_context_policy(uuid,uuid),
 public.set_linkedin_browser_context_enrollment(uuid,uuid,boolean,text,text),
 public.claim_linkedin_browser_context_provisioning(uuid,uuid,uuid,uuid,text,uuid),
 public.reconcile_terminal_linkedin_browser_context_session(uuid,uuid,text,uuid,text),
 public.request_linkedin_browser_context_deletion(uuid,uuid),
 public.claim_linkedin_browser_context_deletion(text,integer),
 public.complete_linkedin_browser_context_deletion(uuid,text,uuid),
 public.retry_linkedin_browser_context_deletion(uuid,text,uuid,text,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_linkedin_browser_context_policy(uuid,uuid),
 public.set_linkedin_browser_context_enrollment(uuid,uuid,boolean,text,text),
 public.claim_linkedin_browser_context_provisioning(uuid,uuid,uuid,uuid,text,uuid),
 public.reconcile_terminal_linkedin_browser_context_session(uuid,uuid,text,uuid,text),
 public.request_linkedin_browser_context_deletion(uuid,uuid),
 public.claim_linkedin_browser_context_deletion(text,integer),
 public.complete_linkedin_browser_context_deletion(uuid,text,uuid),
 public.retry_linkedin_browser_context_deletion(uuid,text,uuid,text,text)
TO service_role;
