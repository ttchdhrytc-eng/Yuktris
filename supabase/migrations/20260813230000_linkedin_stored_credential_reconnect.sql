/* Credential-based V1: reconnect with existing ciphertext and never auto-retry a password submission. */
CREATE OR REPLACE FUNCTION public.has_linkedin_credentials(p_workspace_id uuid, p_account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_workspace_member(p_workspace_id)
    AND EXISTS(SELECT 1 FROM public.linkedin_accounts a WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id)
    AND EXISTS(SELECT 1 FROM public.linkedin_credentials c WHERE c.account_id=p_account_id AND c.workspace_id=p_workspace_id
      AND c.credentials_status IN ('configured','valid'));
$$;

CREATE OR REPLACE FUNCTION public.start_linkedin_connection_with_stored_credentials(
  p_workspace_id uuid, p_account_id uuid, p_idempotency_key text DEFAULT NULL
) RETURNS TABLE(account_id uuid,queue_item_id uuid,queue_status text,reused boolean,credentials_configured boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_start record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_accounts a WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id) THEN
    RAISE EXCEPTION 'LinkedIn account not found';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_credentials c WHERE c.account_id=p_account_id AND c.workspace_id=p_workspace_id
    AND c.credentials_status IN ('configured','valid')) THEN RAISE EXCEPTION 'LinkedIn credentials are not configured'; END IF;
  SELECT * INTO v_start FROM public.start_linkedin_connection(
    p_workspace_id,NULL,NULL,NULL,p_account_id,coalesce(nullif(trim(p_idempotency_key),''),gen_random_uuid()::text));
  UPDATE public.browser_execution_queue SET max_retries=0
    WHERE id=v_start.queue_item_id AND workspace_id=p_workspace_id AND account_id=p_account_id AND action_type='linkedin_connect';
  RETURN QUERY SELECT v_start.account_id,v_start.queue_item_id,v_start.queue_status,v_start.attempt_reused,true;
END $$;

REVOKE EXECUTE ON FUNCTION public.has_linkedin_credentials(uuid,uuid),
 public.start_linkedin_connection_with_stored_credentials(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_linkedin_credentials(uuid,uuid),
 public.start_linkedin_connection_with_stored_credentials(uuid,uuid,text) TO authenticated;

/* Every explicit credential submission is a single bounded LinkedIn submit attempt. */
CREATE OR REPLACE FUNCTION public.enforce_single_linkedin_connect_attempt() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.action_type='linkedin_connect' THEN NEW.max_retries:=0; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_single_linkedin_connect_attempt ON public.browser_execution_queue;
CREATE TRIGGER enforce_single_linkedin_connect_attempt BEFORE INSERT OR UPDATE OF action_type
ON public.browser_execution_queue FOR EACH ROW EXECUTE FUNCTION public.enforce_single_linkedin_connect_attempt();
