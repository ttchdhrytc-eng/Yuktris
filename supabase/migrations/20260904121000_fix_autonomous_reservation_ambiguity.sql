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
