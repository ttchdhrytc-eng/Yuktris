-- Additive autonomous prospect inventory. Existing rows remain inert until an
-- ICP is explicitly activated or materially edited after this migration.
ALTER TABLE public.icps
  ADD COLUMN IF NOT EXISTS offer_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prospecting_status text NOT NULL DEFAULT 'paused',
  ADD COLUMN IF NOT EXISTS minimum_ready_inventory integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS target_ready_inventory integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS replenishment_batch_size integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_refresh_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_discovery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_discovery_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS discovery_consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discovery_error text;

ALTER TABLE public.icps DROP CONSTRAINT IF EXISTS icps_prospecting_status_check;
ALTER TABLE public.icps ADD CONSTRAINT icps_prospecting_status_check
  CHECK (prospecting_status IN ('paused','queued','refreshing','up_to_date','needs_attention'));
ALTER TABLE public.icps DROP CONSTRAINT IF EXISTS icps_inventory_bounds_check;
ALTER TABLE public.icps ADD CONSTRAINT icps_inventory_bounds_check CHECK (
  minimum_ready_inventory BETWEEN 1 AND 100 AND
  target_ready_inventory BETWEEN minimum_ready_inventory AND 500 AND
  replenishment_batch_size BETWEEN 1 AND 5
);

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS normalized_linkedin_url text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS prospects_workspace_canonical_linkedin_unique
  ON public.prospects(workspace_id, normalized_linkedin_url)
  WHERE normalized_linkedin_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.icp_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  icp_id uuid NOT NULL REFERENCES public.icps(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  fit_score integer NOT NULL CHECK (fit_score BETWEEN 0 AND 100),
  fit_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_status text NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('pending','verified','stale','rejected')),
  intent_status text NOT NULL DEFAULT 'unknown' CHECK (intent_status IN ('unknown','none_evidenced','evidenced')),
  intent_evidence jsonb,
  readiness text NOT NULL DEFAULT 'ready' CHECK (readiness IN ('ready','reserved','contacted','excluded','stale')),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(icp_id, prospect_id),
  UNIQUE(id, workspace_id)
);
CREATE INDEX IF NOT EXISTS icp_prospects_ready_idx ON public.icp_prospects(icp_id, fit_score DESC, last_verified_at DESC) WHERE readiness='ready' AND verification_status='verified';
CREATE INDEX IF NOT EXISTS icp_prospects_workspace_idx ON public.icp_prospects(workspace_id, readiness);

CREATE TABLE IF NOT EXISTS public.prospect_replenishment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  icp_id uuid NOT NULL REFERENCES public.icps(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','cooldown','cancelled')),
  reason text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
  lease_owner text,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_budget jsonb NOT NULL DEFAULT '{"max_prospects":5,"max_waves":3,"internal_deadline_ms":38000}'::jsonb,
  result_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, idempotency_key),
  UNIQUE(id, workspace_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS replenishment_one_active_per_icp ON public.prospect_replenishment_jobs(icp_id) WHERE status IN ('queued','processing','cooldown');
CREATE INDEX IF NOT EXISTS replenishment_due_idx ON public.prospect_replenishment_jobs(next_attempt_at, created_at) WHERE status IN ('queued','cooldown');

ALTER TABLE public.customer_campaigns
  ADD COLUMN IF NOT EXISTS icp_id uuid REFERENCES public.icps(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS targeting_mode text NOT NULL DEFAULT 'manual_review',
  ADD COLUMN IF NOT EXISTS pool_feed_limit integer NOT NULL DEFAULT 5;
ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_targeting_mode_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_targeting_mode_check CHECK (targeting_mode IN ('manual_review','autonomous_pool'));
ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_pool_feed_limit_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_pool_feed_limit_check CHECK (pool_feed_limit BETWEEN 1 AND 20);

CREATE TABLE IF NOT EXISTS public.campaign_prospect_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.customer_campaigns(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','released','consumed','ineligible')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, prospect_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_campaign_reservation_per_prospect ON public.campaign_prospect_reservations(workspace_id, prospect_id) WHERE status='reserved';

ALTER TABLE public.icp_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_replenishment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_prospect_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY icp_prospects_select ON public.icp_prospects FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY replenishment_select ON public.prospect_replenishment_jobs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY reservations_select ON public.campaign_prospect_reservations FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE INSERT,UPDATE,DELETE ON public.icp_prospects, public.prospect_replenishment_jobs, public.campaign_prospect_reservations FROM anon,authenticated;
GRANT SELECT ON public.icp_prospects, public.prospect_replenishment_jobs, public.campaign_prospect_reservations TO authenticated;
GRANT ALL ON public.icp_prospects, public.prospect_replenishment_jobs, public.campaign_prospect_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.claim_prospect_replenishment(p_job_id uuid, p_workspace_id uuid, p_lease_owner text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.prospect_replenishment_jobs%ROWTYPE;
BEGIN
  UPDATE public.prospect_replenishment_jobs SET status='processing', lease_owner=p_lease_owner,
    lease_expires_at=now()+interval '2 minutes', started_at=coalesce(started_at,now()),
    attempt_count=attempt_count+1, updated_at=now()
  WHERE id=p_job_id AND workspace_id=p_workspace_id AND status IN ('queued','cooldown')
    AND next_attempt_at<=now() AND (lease_expires_at IS NULL OR lease_expires_at<now())
  RETURNING * INTO j;
  IF j.id IS NULL THEN RETURN jsonb_build_object('claimed',false); END IF;
  RETURN jsonb_build_object('claimed',true,'job_id',j.id,'icp_id',j.icp_id,'account_id',j.linkedin_account_id,'attempt',j.attempt_count);
END $$;
REVOKE ALL ON FUNCTION public.claim_prospect_replenishment(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_prospect_replenishment(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_autonomous_campaign_prospects(p_workspace_id uuid,p_campaign_id uuid,p_limit integer DEFAULT 5)
RETURNS TABLE(reservation_id uuid,prospect_id uuid,linkedin_url text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_column
DECLARE c public.customer_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF c.id IS NULL OR c.targeting_mode<>'autonomous_pool' OR c.icp_id IS NULL OR c.status NOT IN ('initializing','ready','running') THEN RETURN; END IF;
  RETURN QUERY
  WITH eligible AS (
    SELECT ip.prospect_id,p.normalized_linkedin_url
    FROM public.icp_prospects ip JOIN public.prospects p ON p.id=ip.prospect_id AND p.workspace_id=ip.workspace_id
    WHERE ip.workspace_id=p_workspace_id AND ip.icp_id=c.icp_id AND ip.readiness='ready' AND ip.verification_status='verified'
      AND p.normalized_linkedin_url IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.campaign_prospect_reservations r WHERE r.workspace_id=p_workspace_id AND r.prospect_id=p.id AND r.status IN ('reserved','consumed'))
      AND NOT EXISTS (SELECT 1 FROM public.contacts x JOIN public.linkedin_execution_jobs j ON j.contact_id=x.id WHERE x.workspace_id=p_workspace_id AND x.normalized_linkedin_url=p.normalized_linkedin_url)
    ORDER BY ip.fit_score DESC,ip.last_verified_at DESC FOR UPDATE OF ip SKIP LOCKED LIMIT least(greatest(p_limit,1),least(c.daily_limit,c.pool_feed_limit))
  ), inserted AS (
    INSERT INTO public.campaign_prospect_reservations(workspace_id,campaign_id,prospect_id,expires_at)
    SELECT p_workspace_id,p_campaign_id,e.prospect_id,now()+interval '30 minutes' FROM eligible e
    ON CONFLICT DO NOTHING RETURNING id,prospect_id
  )
  SELECT i.id,i.prospect_id,p.normalized_linkedin_url FROM inserted i JOIN public.prospects p ON p.id=i.prospect_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_autonomous_campaign_prospects(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_autonomous_campaign_prospects(uuid,uuid,integer) TO service_role;
