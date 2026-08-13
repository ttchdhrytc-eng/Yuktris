/* LinkedIn V1 credentials: ciphertext only, inaccessible to browser clients. */
CREATE TABLE public.linkedin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  encrypted_username text NOT NULL,
  encrypted_password text NOT NULL,
  encryption_version text NOT NULL,
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  credentials_status text NOT NULL DEFAULT 'configured'
    CHECK (credentials_status IN ('configured','valid','invalid','revoked')),
  encrypted_at timestamptz NOT NULL DEFAULT now(),
  last_authenticated_at timestamptz,
  last_attempt_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, account_id),
  UNIQUE (account_id, workspace_id),
  CONSTRAINT linkedin_credentials_account_workspace_fkey
    FOREIGN KEY (account_id, workspace_id) REFERENCES public.linkedin_accounts(id, workspace_id) ON DELETE CASCADE
);

ALTER TABLE public.linkedin_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_credentials TO service_role;

CREATE FUNCTION public.start_linkedin_connection_with_credentials(
  p_workspace_id uuid, p_encrypted_username text, p_encrypted_password text,
  p_encryption_version text, p_linkedin_email text DEFAULT NULL,
  p_display_name text DEFAULT NULL, p_existing_account_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS TABLE(account_id uuid, queue_item_id uuid, queue_status text, reused boolean, credentials_configured boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_start record; v_uid uuid := auth.uid(); v_existing_version integer; v_expected_profile text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF nullif(trim(p_encrypted_username),'') IS NULL OR nullif(trim(p_encrypted_password),'') IS NULL
     OR nullif(trim(p_encryption_version),'') IS NULL THEN RAISE EXCEPTION 'encrypted credentials are required'; END IF;

  IF p_existing_account_id IS NOT NULL THEN
    SELECT coalesce(expected_profile_url,profile_url) INTO v_expected_profile FROM public.linkedin_accounts
      WHERE id=p_existing_account_id AND workspace_id=p_workspace_id;
  END IF;
  SELECT * INTO v_start FROM public.start_linkedin_connection(
    p_workspace_id, p_linkedin_email, p_display_name, v_expected_profile, p_existing_account_id, p_idempotency_key
  );
  IF v_start.account_id IS NULL OR v_start.queue_item_id IS NULL THEN RAISE EXCEPTION 'connection attempt was not created'; END IF;

  SELECT credential_version INTO v_existing_version FROM public.linkedin_credentials
    WHERE workspace_id=p_workspace_id AND account_id=v_start.account_id FOR UPDATE;
  INSERT INTO public.linkedin_credentials(
    workspace_id,account_id,encrypted_username,encrypted_password,encryption_version,
    credential_version,credentials_status,encrypted_at,last_attempt_at,updated_at
  ) VALUES (
    p_workspace_id,v_start.account_id,trim(p_encrypted_username),trim(p_encrypted_password),trim(p_encryption_version),
    coalesce(v_existing_version,0)+1,'configured',now(),NULL,now()
  ) ON CONFLICT(workspace_id,account_id) DO UPDATE SET
    encrypted_username=EXCLUDED.encrypted_username,encrypted_password=EXCLUDED.encrypted_password,
    encryption_version=EXCLUDED.encryption_version,credential_version=EXCLUDED.credential_version,
    credentials_status='configured',encrypted_at=now(),last_attempt_at=NULL,updated_at=now();

  INSERT INTO public.linkedin_session_events(workspace_id,account_id,event_type,event_data)
  VALUES(p_workspace_id,v_start.account_id,'created',jsonb_build_object(
    'action','credentials_configured','credential_version',coalesce(v_existing_version,0)+1,'actor_user_id',v_uid));
  RETURN QUERY SELECT v_start.account_id,v_start.queue_item_id,v_start.queue_status,v_start.attempt_reused,true;
END $$;

CREATE FUNCTION public.claim_linkedin_credentials_for_login(
  p_workspace_id uuid,p_account_id uuid,p_queue_item_id uuid,p_worker_id text,p_attempt_id uuid
) RETURNS TABLE(encrypted_username text,encrypted_password text,encryption_version text,credential_version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_queue_item_id
    AND q.workspace_id=p_workspace_id AND q.account_id=p_account_id AND q.status='running'
    AND q.worker_id=p_worker_id AND q.attempt_id=p_attempt_id AND q.lease_expires_at>now()) THEN
    RAISE EXCEPTION 'queue ownership lost';
  END IF;
  RETURN QUERY UPDATE public.linkedin_credentials c SET last_attempt_at=now(),updated_at=now()
    WHERE c.workspace_id=p_workspace_id AND c.account_id=p_account_id
      AND c.credentials_status IN ('configured','valid')
      AND (c.last_attempt_at IS NULL OR c.last_attempt_at < now()-interval '60 seconds')
    RETURNING c.encrypted_username,c.encrypted_password,c.encryption_version,c.credential_version;
END $$;

CREATE FUNCTION public.mark_linkedin_credentials_result(
  p_workspace_id uuid,p_account_id uuid,p_queue_item_id uuid,p_worker_id text,p_attempt_id uuid,
  p_success boolean,p_invalid boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_queue_item_id
    AND q.workspace_id=p_workspace_id AND q.account_id=p_account_id AND q.status='running'
    AND q.worker_id=p_worker_id AND q.attempt_id=p_attempt_id) THEN RAISE EXCEPTION 'queue ownership lost'; END IF;
  UPDATE public.linkedin_credentials SET credentials_status=CASE WHEN p_success THEN 'valid' WHEN p_invalid THEN 'invalid' ELSE credentials_status END,
    last_authenticated_at=CASE WHEN p_success THEN now() ELSE last_authenticated_at END,updated_at=now()
  WHERE workspace_id=p_workspace_id AND account_id=p_account_id;
END $$;

CREATE FUNCTION public.revoke_linkedin_credentials(p_workspace_id uuid,p_account_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_deleted_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id) THEN RAISE EXCEPTION 'account not found'; END IF;
  DELETE FROM public.linkedin_credentials WHERE workspace_id=p_workspace_id AND account_id=p_account_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  INSERT INTO public.linkedin_session_events(workspace_id,account_id,event_type,event_data)
  VALUES(p_workspace_id,p_account_id,'revoked',jsonb_build_object('action','credentials_deleted','actor_user_id',auth.uid()));
  RETURN v_deleted_count > 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.start_linkedin_connection_with_credentials(uuid,text,text,text,text,text,uuid,text),
 public.claim_linkedin_credentials_for_login(uuid,uuid,uuid,text,uuid),
 public.mark_linkedin_credentials_result(uuid,uuid,uuid,text,uuid,boolean,boolean),
 public.revoke_linkedin_credentials(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_linkedin_connection_with_credentials(uuid,text,text,text,text,text,uuid,text),
 public.revoke_linkedin_credentials(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_linkedin_credentials_for_login(uuid,uuid,uuid,text,uuid),
 public.mark_linkedin_credentials_result(uuid,uuid,uuid,text,uuid,boolean,boolean) TO service_role;
