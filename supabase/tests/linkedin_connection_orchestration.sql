\set ON_ERROR_STOP on
BEGIN;

SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id,email,role,aud,created_at,updated_at)
VALUES ('10000000-0000-0000-0000-000000000001','orchestration@example.test','authenticated','authenticated',now(),now());
SET LOCAL session_replication_role = origin;
INSERT INTO public.workspaces(id,name,slug,owner_id)
VALUES ('20000000-0000-0000-0000-000000000001','Orchestration Test','orchestration-test','10000000-0000-0000-0000-000000000001');
INSERT INTO public.profiles(id,workspace_id,email,role,status)
VALUES ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','orchestration@example.test','owner','active');
INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner','active');
SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  v_account uuid; v_queue uuid; v_status text; v_reused boolean; v_claim record; v_second uuid;
BEGIN
  SELECT account_id,queue_item_id,queue_status,attempt_reused INTO v_account,v_queue,v_status,v_reused
  FROM public.start_linkedin_connection('20000000-0000-0000-0000-000000000001',
    'first@example.test',NULL,NULL,NULL,'fresh-1');
  IF v_account IS NULL OR v_queue IS NULL OR v_status <> 'pending' OR v_reused THEN
    RAISE EXCEPTION 'fresh attempt contract failed';
  END IF;
  IF (SELECT count(*) FROM public.browser_execution_queue WHERE account_id=v_account AND action_type='linkedin_connect') <> 1 THEN
    RAISE EXCEPTION 'fresh attempt was not exactly one row';
  END IF;

  SELECT * INTO v_claim FROM public.claim_queue_task('integration-worker',90);
  IF v_claim.id IS DISTINCT FROM v_queue OR v_claim.status <> 'running' OR v_claim.attempt_id IS NULL THEN
    RAISE EXCEPTION 'new queue row was not immediately claimable';
  END IF;

  SELECT queue_item_id,queue_status,attempt_reused INTO v_second,v_status,v_reused
  FROM public.start_linkedin_connection('20000000-0000-0000-0000-000000000001',
    NULL,NULL,NULL,v_account,'returning-active');
  IF v_second IS DISTINCT FROM v_queue OR v_status <> 'running' OR NOT v_reused THEN
    RAISE EXCEPTION 'valid active attempt was not reused';
  END IF;

  UPDATE public.browser_execution_queue SET status='completed',completed_at=now(),lease_expires_at=NULL WHERE id=v_queue;
  SELECT queue_item_id,queue_status INTO v_second,v_status FROM public.start_linkedin_connection(
    '20000000-0000-0000-0000-000000000001',NULL,NULL,NULL,v_account,'after-completed');
  IF v_second=v_queue OR v_status <> 'pending' THEN RAISE EXCEPTION 'completed attempt blocked new work'; END IF;

  UPDATE public.browser_execution_queue SET status='failed',completed_at=now() WHERE id=v_second;
  SELECT queue_item_id INTO v_queue FROM public.start_linkedin_connection(
    '20000000-0000-0000-0000-000000000001',NULL,NULL,NULL,v_account,'after-failed');
  IF v_queue=v_second THEN RAISE EXCEPTION 'failed attempt blocked new work'; END IF;

  UPDATE public.browser_execution_queue SET status='cancelled',completed_at=now() WHERE id=v_queue;
  SELECT queue_item_id INTO v_second FROM public.start_linkedin_connection(
    '20000000-0000-0000-0000-000000000001',NULL,NULL,NULL,v_account,'after-cancelled');
  IF v_second=v_queue THEN RAISE EXCEPTION 'cancelled attempt blocked new work'; END IF;

  UPDATE public.browser_execution_queue SET status='running',worker_id='dead-worker',attempt_id=gen_random_uuid(),
    lease_expires_at=now()-interval '1 second' WHERE id=v_second;
  SELECT queue_item_id,queue_status,attempt_reused INTO v_queue,v_status,v_reused FROM public.start_linkedin_connection(
    '20000000-0000-0000-0000-000000000001',NULL,NULL,NULL,v_account,'expired-lease');
  IF v_queue IS DISTINCT FROM v_second OR v_status <> 'pending' OR NOT v_reused THEN
    RAISE EXCEPTION 'expired lease was not reconciled to runnable work';
  END IF;
END $$;

ROLLBACK;
SELECT 'PASS linkedin connection PostgreSQL orchestration integration' AS result;
