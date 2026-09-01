BEGIN;

WITH proven_accounts AS (
  SELECT DISTINCT a.id,a.workspace_id
  FROM public.linkedin_accounts a
  JOIN public.linkedin_sessions s ON s.account_id=a.id AND s.workspace_id=a.workspace_id
  JOIN public.linkedin_browser_contexts c ON c.account_id=a.id AND c.workspace_id=a.workspace_id
  WHERE a.connection_state='connected'
    AND a.session_status='connected'
    AND a.profile_url IS NOT NULL
    AND a.expected_profile_url IS NOT NULL
    AND lower(trim(trailing '/' FROM a.profile_url))=lower(trim(trailing '/' FROM a.expected_profile_url))
    AND s.status='active'
    AND s.authenticated IS TRUE
    AND s.connection_state='authenticated'
    AND s.health_status='healthy'
    AND (s.expires_at IS NULL OR s.expires_at>now())
    AND c.status='active'
    AND c.provider='browserbase'
    AND c.provider_context_id IS NOT NULL
    AND c.last_synchronized_at IS NOT NULL
)
UPDATE public.linkedin_accounts a
SET health_status='healthy',last_error=NULL,updated_at=now()
FROM proven_accounts p
WHERE a.id=p.id AND a.workspace_id=p.workspace_id AND a.health_status NOT IN ('healthy','degraded');

WITH ready_campaigns AS (
  SELECT cc.id,cc.workspace_id
  FROM public.customer_campaigns cc
  JOIN public.linkedin_accounts a ON a.id=cc.linkedin_account_id AND a.workspace_id=cc.workspace_id
  WHERE cc.status='blocked_prerequisite'
    AND lower(coalesce(cc.blocker,''))='restore the linkedin session'
    AND a.connection_state='connected'
    AND a.session_status='connected'
    AND a.health_status IN ('healthy','degraded')
    AND a.profile_url IS NOT NULL
    AND a.expected_profile_url IS NOT NULL
    AND lower(trim(trailing '/' FROM a.profile_url))=lower(trim(trailing '/' FROM a.expected_profile_url))
)
UPDATE public.customer_campaigns cc
SET status='ready',status_reason='Prerequisites validated. Launch explicitly when ready.',failure_code=NULL,blocker=NULL,updated_at=now()
FROM ready_campaigns r
WHERE cc.id=r.id AND cc.workspace_id=r.workspace_id;

COMMIT;
