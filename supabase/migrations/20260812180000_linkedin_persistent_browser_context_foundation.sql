/* Phase A1: service-role-only persistent Browserbase Context foundation. */

CREATE UNIQUE INDEX IF NOT EXISTS uq_linkedin_accounts_id_workspace
  ON public.linkedin_accounts(id, workspace_id);

CREATE TABLE public.linkedin_browser_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  account_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'browserbase' CHECK (provider = 'browserbase'),
  provider_context_id text,
  status text NOT NULL DEFAULT 'provisioning' CHECK (status IN
    ('provisioning','active','in_use','synchronizing','failed','invalidated','deletion_pending','deleted')),
  generation integer NOT NULL DEFAULT 1 CHECK (generation > 0),
  provisioning_started_at timestamptz NOT NULL DEFAULT now(),
  provisioned_at timestamptz,
  last_used_at timestamptz,
  last_synchronized_at timestamptz,
  invalidated_at timestamptz,
  deletion_requested_at timestamptz,
  deleted_at timestamptz,
  active_browserbase_session_id text,
  active_queue_item_id uuid REFERENCES public.browser_execution_queue(id) ON DELETE SET NULL,
  active_worker_id text,
  active_attempt_id uuid,
  lease_expires_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT linkedin_browser_contexts_account_workspace_fkey
    FOREIGN KEY (account_id, workspace_id)
    REFERENCES public.linkedin_accounts(id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT linkedin_browser_contexts_lease_shape CHECK (
    (active_queue_item_id IS NULL AND active_worker_id IS NULL AND active_attempt_id IS NULL AND lease_expires_at IS NULL)
    OR (active_queue_item_id IS NOT NULL AND active_worker_id IS NOT NULL AND active_attempt_id IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_linkedin_browser_contexts_provider_id
  ON public.linkedin_browser_contexts(provider, provider_context_id)
  WHERE provider_context_id IS NOT NULL;
CREATE UNIQUE INDEX uq_linkedin_browser_contexts_active_account
  ON public.linkedin_browser_contexts(account_id, provider)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_linkedin_browser_contexts_lease
  ON public.linkedin_browser_contexts(lease_expires_at) WHERE lease_expires_at IS NOT NULL;

ALTER TABLE public.linkedin_browser_contexts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_browser_contexts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_browser_contexts TO service_role;

CREATE FUNCTION public.reserve_linkedin_browser_context(
  p_workspace_id uuid, p_account_id uuid, p_provider text DEFAULT 'browserbase'
) RETURNS SETOF public.linkedin_browser_contexts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_provider <> 'browserbase' THEN RAISE EXCEPTION 'unsupported context provider'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.linkedin_accounts a WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id) THEN
    RAISE EXCEPTION 'LinkedIn account not found';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_account_id::text || ':' || p_provider, 0));
  SELECT c.id INTO v_id FROM public.linkedin_browser_contexts c
    WHERE c.account_id=p_account_id AND c.workspace_id=p_workspace_id AND c.provider=p_provider AND c.deleted_at IS NULL
    FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO public.linkedin_browser_contexts(workspace_id,account_id,provider)
      VALUES(p_workspace_id,p_account_id,p_provider) RETURNING id INTO v_id;
  ELSE
    -- A provider request that failed before yielding an ID can safely retry the
    -- same reservation; it must never create a second database Context row.
    UPDATE public.linkedin_browser_contexts SET status='provisioning', generation=generation+1,
      provisioning_started_at=now(), failure_code=NULL, failure_message=NULL, updated_at=now()
    WHERE id=v_id AND status='failed' AND provider_context_id IS NULL;
  END IF;
  RETURN QUERY SELECT c.* FROM public.linkedin_browser_contexts c WHERE c.id=v_id;
END $$;

CREATE FUNCTION public.get_linkedin_browser_context_for_worker(p_workspace_id uuid, p_account_id uuid)
RETURNS SETOF public.linkedin_browser_contexts
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT c.* FROM public.linkedin_browser_contexts c
  WHERE c.workspace_id=p_workspace_id AND c.account_id=p_account_id AND c.deleted_at IS NULL
  ORDER BY c.generation DESC LIMIT 1
$$;

CREATE FUNCTION public.complete_linkedin_browser_context_provisioning(
  p_context_id uuid, p_workspace_id uuid, p_account_id uuid, p_provider_context_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF nullif(trim(p_provider_context_id),'') IS NULL THEN RAISE EXCEPTION 'provider context id is required'; END IF;
  UPDATE public.linkedin_browser_contexts SET provider_context_id=trim(p_provider_context_id), status='active',
    provisioned_at=now(), failure_code=NULL, failure_message=NULL, updated_at=now()
  WHERE id=p_context_id AND workspace_id=p_workspace_id AND account_id=p_account_id
    AND status='provisioning' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'provisioning reservation not found'; END IF;
END $$;

CREATE FUNCTION public.fail_linkedin_browser_context_provisioning(
  p_context_id uuid, p_workspace_id uuid, p_account_id uuid, p_failure_code text, p_failure_message text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET status='failed',
    failure_code=left(regexp_replace(coalesce(p_failure_code,'provider_error'),'[^a-zA-Z0-9_.-]','','g'),64),
    failure_message=left(regexp_replace(coalesce(p_failure_message,'Context provisioning failed'),
      '(https?|wss?)://[^[:space:]]+|[A-Za-z0-9_-]{32,}', '[redacted]', 'gi'),256), updated_at=now()
  WHERE id=p_context_id AND workspace_id=p_workspace_id AND account_id=p_account_id
    AND status='provisioning' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'provisioning reservation not found'; END IF;
END $$;

CREATE FUNCTION public.acquire_linkedin_browser_context_lease(
  p_workspace_id uuid, p_account_id uuid, p_queue_item_id uuid, p_worker_id text,
  p_attempt_id uuid, p_lease_seconds integer DEFAULT 90
) RETURNS SETOF public.linkedin_browser_contexts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_queue_item_id
    AND q.workspace_id=p_workspace_id AND q.account_id=p_account_id AND q.status='running'
    AND q.worker_id=p_worker_id AND q.attempt_id=p_attempt_id AND q.lease_expires_at>now()) THEN
    RAISE EXCEPTION 'queue attempt ownership required';
  END IF;
  SELECT c.id INTO v_id FROM public.linkedin_browser_contexts c
    WHERE c.workspace_id=p_workspace_id AND c.account_id=p_account_id AND c.provider='browserbase'
      AND c.provider_context_id IS NOT NULL AND c.deleted_at IS NULL
      AND c.status IN ('active','in_use')
    FOR UPDATE;
  IF v_id IS NULL THEN RAISE EXCEPTION 'active persistent Context required'; END IF;
  UPDATE public.linkedin_browser_contexts c SET status='in_use', active_queue_item_id=p_queue_item_id,
    active_worker_id=p_worker_id, active_attempt_id=p_attempt_id,
    lease_expires_at=now()+make_interval(secs=>greatest(30,least(p_lease_seconds,600))), last_used_at=now(), updated_at=now()
  WHERE c.id=v_id AND (c.lease_expires_at IS NULL OR c.lease_expires_at<=now()
    OR (c.active_queue_item_id=p_queue_item_id AND c.active_worker_id=p_worker_id AND c.active_attempt_id=p_attempt_id));
  IF NOT FOUND THEN RAISE EXCEPTION 'persistent Context is already leased'; END IF;
  RETURN QUERY SELECT c.* FROM public.linkedin_browser_contexts c WHERE c.id=v_id;
END $$;

CREATE FUNCTION public.renew_linkedin_browser_context_lease(
  p_context_id uuid, p_queue_item_id uuid, p_worker_id text, p_attempt_id uuid, p_lease_seconds integer DEFAULT 90
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts c SET
    lease_expires_at=now()+make_interval(secs=>greatest(30,least(p_lease_seconds,600))), updated_at=now()
  WHERE c.id=p_context_id AND c.active_queue_item_id=p_queue_item_id AND c.active_worker_id=p_worker_id
    AND c.active_attempt_id=p_attempt_id AND c.lease_expires_at>now()
    AND EXISTS (SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_queue_item_id AND q.worker_id=p_worker_id
      AND q.attempt_id=p_attempt_id AND q.status='running' AND q.lease_expires_at>now());
  RETURN FOUND;
END $$;

CREATE FUNCTION public.set_linkedin_browser_context_session(
  p_context_id uuid, p_queue_item_id uuid, p_worker_id text, p_attempt_id uuid, p_browserbase_session_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET active_browserbase_session_id=nullif(trim(p_browserbase_session_id),''), updated_at=now()
  WHERE id=p_context_id AND active_queue_item_id=p_queue_item_id AND active_worker_id=p_worker_id
    AND active_attempt_id=p_attempt_id AND lease_expires_at>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'context lease ownership required'; END IF;
END $$;

CREATE FUNCTION public.begin_linkedin_browser_context_synchronization(
  p_context_id uuid, p_queue_item_id uuid, p_worker_id text, p_attempt_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET status='synchronizing', updated_at=now()
  WHERE id=p_context_id AND active_queue_item_id=p_queue_item_id AND active_worker_id=p_worker_id
    AND active_attempt_id=p_attempt_id AND active_browserbase_session_id IS NOT NULL AND lease_expires_at>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'context lease ownership required'; END IF;
END $$;

CREATE FUNCTION public.complete_linkedin_browser_context_synchronization(
  p_context_id uuid, p_queue_item_id uuid, p_worker_id text, p_attempt_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET status='active', last_synchronized_at=now(),
    active_browserbase_session_id=NULL, active_queue_item_id=NULL, active_worker_id=NULL,
    active_attempt_id=NULL, lease_expires_at=NULL, updated_at=now()
  WHERE id=p_context_id AND active_queue_item_id=p_queue_item_id AND active_worker_id=p_worker_id
    AND active_attempt_id=p_attempt_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'context lease ownership required'; END IF;
END $$;

CREATE FUNCTION public.release_linkedin_browser_context_lease(
  p_context_id uuid, p_queue_item_id uuid, p_worker_id text, p_attempt_id uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET status=CASE WHEN provider_context_id IS NULL THEN 'failed' ELSE 'active' END,
    active_browserbase_session_id=NULL, active_queue_item_id=NULL, active_worker_id=NULL,
    active_attempt_id=NULL, lease_expires_at=NULL, updated_at=now()
  WHERE id=p_context_id AND active_queue_item_id=p_queue_item_id AND active_worker_id=p_worker_id AND active_attempt_id=p_attempt_id;
  RETURN FOUND;
END $$;

CREATE FUNCTION public.invalidate_linkedin_browser_context(
  p_context_id uuid, p_workspace_id uuid, p_account_id uuid, p_failure_code text DEFAULT 'invalidated'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET status='invalidated', invalidated_at=now(),
    failure_code=left(regexp_replace(coalesce(p_failure_code,'invalidated'),'[^a-zA-Z0-9_.-]','','g'),64),
    active_browserbase_session_id=NULL, active_queue_item_id=NULL, active_worker_id=NULL,
    active_attempt_id=NULL, lease_expires_at=NULL, updated_at=now()
  WHERE id=p_context_id AND workspace_id=p_workspace_id AND account_id=p_account_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'persistent Context not found'; END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.reserve_linkedin_browser_context(uuid,uuid,text),
  public.get_linkedin_browser_context_for_worker(uuid,uuid),
  public.complete_linkedin_browser_context_provisioning(uuid,uuid,uuid,text),
  public.fail_linkedin_browser_context_provisioning(uuid,uuid,uuid,text,text),
  public.acquire_linkedin_browser_context_lease(uuid,uuid,uuid,text,uuid,integer),
  public.renew_linkedin_browser_context_lease(uuid,uuid,text,uuid,integer),
  public.set_linkedin_browser_context_session(uuid,uuid,text,uuid,text),
  public.begin_linkedin_browser_context_synchronization(uuid,uuid,text,uuid),
  public.complete_linkedin_browser_context_synchronization(uuid,uuid,text,uuid),
  public.release_linkedin_browser_context_lease(uuid,uuid,text,uuid),
  public.invalidate_linkedin_browser_context(uuid,uuid,uuid,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_linkedin_browser_context(uuid,uuid,text),
  public.get_linkedin_browser_context_for_worker(uuid,uuid),
  public.complete_linkedin_browser_context_provisioning(uuid,uuid,uuid,text),
  public.fail_linkedin_browser_context_provisioning(uuid,uuid,uuid,text,text),
  public.acquire_linkedin_browser_context_lease(uuid,uuid,uuid,text,uuid,integer),
  public.renew_linkedin_browser_context_lease(uuid,uuid,text,uuid,integer),
  public.set_linkedin_browser_context_session(uuid,uuid,text,uuid,text),
  public.begin_linkedin_browser_context_synchronization(uuid,uuid,text,uuid),
  public.complete_linkedin_browser_context_synchronization(uuid,uuid,text,uuid),
  public.release_linkedin_browser_context_lease(uuid,uuid,text,uuid),
  public.invalidate_linkedin_browser_context(uuid,uuid,uuid,text)
TO service_role;
