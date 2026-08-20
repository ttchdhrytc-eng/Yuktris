ALTER TABLE public.customer_campaigns
  ADD COLUMN IF NOT EXISTS initialization_key uuid,
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS blocker text;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS onboarding_welcome_completed boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_campaigns_workspace_initialization_key
  ON public.customer_campaigns(workspace_id, initialization_key);

CREATE OR REPLACE FUNCTION public.reconcile_stale_customer_campaigns(p_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  changed integer := 0;
BEGIN
  IF NOT public.is_workspace_member(p_workspace_id)
     AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Workspace access denied';
  END IF;

  UPDATE public.customer_campaigns c
  SET status = CASE
        WHEN a.id IS NULL OR a.connection_state <> 'connected'
          OR a.health_status NOT IN ('healthy','degraded') THEN 'blocked_prerequisite'
        ELSE 'failed'
      END,
      failure_code = CASE
        WHEN a.id IS NULL OR a.connection_state <> 'connected' THEN 'linkedin_connection_required'
        WHEN a.health_status NOT IN ('healthy','degraded') THEN 'linkedin_unhealthy'
        ELSE 'initialization_timeout'
      END,
      blocker = CASE
        WHEN a.id IS NULL OR a.connection_state <> 'connected' THEN 'Connect LinkedIn before retrying.'
        WHEN a.health_status NOT IN ('healthy','degraded') THEN 'Restore LinkedIn account health before retrying.'
        ELSE 'Initialization exceeded the ten-minute completion window. Retry safely.'
      END,
      status_reason = CASE
        WHEN a.id IS NULL OR a.connection_state <> 'connected'
          OR a.health_status NOT IN ('healthy','degraded') THEN 'Campaign requires attention before it can continue.'
        ELSE 'Campaign initialization timed out and can be retried.'
      END,
      updated_at = now()
  FROM public.customer_campaigns target
  LEFT JOIN public.linkedin_accounts a ON a.id = target.linkedin_account_id
  WHERE c.id = target.id
    AND c.workspace_id = p_workspace_id
    AND c.status = 'initializing'
    AND c.updated_at < now() - interval '10 minutes';

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_stale_customer_campaigns(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_stale_customer_campaigns(uuid) TO authenticated, service_role;
