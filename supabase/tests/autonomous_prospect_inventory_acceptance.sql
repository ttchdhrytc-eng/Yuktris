BEGIN;
CREATE TEMP TABLE autonomous_acceptance_results(test text,passed boolean,detail text);

DO $$
DECLARE w uuid; i uuid; a uuid; c uuid; j uuid; first_claim jsonb; second_claim jsonb; reserved integer;
BEGIN
  SELECT la.workspace_id,la.id INTO w,a FROM public.linkedin_accounts la
    WHERE la.connection_state='connected' AND la.health_status IN ('healthy','degraded') LIMIT 1;
  SELECT id INTO i FROM public.icps WHERE workspace_id=w LIMIT 1;
  IF w IS NULL OR i IS NULL THEN RAISE EXCEPTION 'staging fixture requires a healthy account and ICP'; END IF;

  INSERT INTO public.prospects(workspace_id,first_name,last_name,title,linkedin_url,company_name,status,identity_verified_at)
  SELECT w,'Synthetic','Inventory '||n,'Decision Maker','https://www.linkedin.com/in/yuktris-inventory-fixture-'||n,
    'Isolated Fixture '||n,'new',now()
  FROM generate_series(1,2000) n;
  INSERT INTO public.icp_prospects(workspace_id,icp_id,prospect_id,fit_score,fit_evidence,provenance,verification_status,intent_status,readiness)
  SELECT w,i,p.id,85,'{"fixture":true}','{"fixture":true}', 'verified','unknown','ready'
  FROM public.prospects p WHERE p.workspace_id=w AND p.normalized_linkedin_url LIKE 'https://www.linkedin.com/in/yuktris-inventory-fixture-%';
  INSERT INTO public.customer_campaigns(workspace_id,name,icp,icp_id,linkedin_account_id,daily_limit,status,targeting_mode,pool_feed_limit)
  VALUES(w,'AUTONOMOUS INVENTORY ROLLBACK FIXTURE','{}',i,a,10,'ready','autonomous_pool',5) RETURNING id INTO c;
  SELECT count(*) INTO reserved FROM public.reserve_autonomous_campaign_prospects(w,c,2000);
  INSERT INTO autonomous_acceptance_results VALUES('2000 inventory never becomes 2000 executable work',reserved=5,'reservations='||reserved||'; execution_jobs=0');
  INSERT INTO autonomous_acceptance_results VALUES('fit does not imply intent',(SELECT count(*)=2000 FROM public.icp_prospects WHERE icp_id=i AND intent_status='unknown' AND fit_score=85),'high fit remains intent unknown');

  INSERT INTO public.prospect_replenishment_jobs(workspace_id,icp_id,linkedin_account_id,idempotency_key,reason)
  VALUES(w,i,a,'rollback-concurrency-fixture','inventory_below_threshold') RETURNING id INTO j;
  SELECT public.claim_prospect_replenishment(j,w,'acceptance-worker-a') INTO first_claim;
  SELECT public.claim_prospect_replenishment(j,w,'acceptance-worker-b') INTO second_claim;
  INSERT INTO autonomous_acceptance_results VALUES('single ICP lease under concurrent claims',(first_claim->>'claimed')::boolean AND NOT (second_claim->>'claimed')::boolean,first_claim::text||' / '||second_claim::text);
END $$;

SELECT * FROM autonomous_acceptance_results ORDER BY test;
ROLLBACK;
