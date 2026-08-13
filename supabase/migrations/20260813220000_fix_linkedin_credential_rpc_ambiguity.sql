CREATE OR REPLACE FUNCTION public.start_linkedin_connection_with_credentials(
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
    SELECT coalesce(a.expected_profile_url,a.profile_url) INTO v_expected_profile
    FROM public.linkedin_accounts AS a
    WHERE a.id=p_existing_account_id AND a.workspace_id=p_workspace_id;
  END IF;
  SELECT * INTO v_start FROM public.start_linkedin_connection(
    p_workspace_id, p_linkedin_email, p_display_name, v_expected_profile, p_existing_account_id, p_idempotency_key
  );
  IF v_start.account_id IS NULL OR v_start.queue_item_id IS NULL THEN RAISE EXCEPTION 'connection attempt was not created'; END IF;

  SELECT c.credential_version INTO v_existing_version
  FROM public.linkedin_credentials AS c
  WHERE c.workspace_id=p_workspace_id AND c.account_id=v_start.account_id FOR UPDATE;

  INSERT INTO public.linkedin_credentials AS c(
    workspace_id,account_id,encrypted_username,encrypted_password,encryption_version,
    credential_version,credentials_status,encrypted_at,last_attempt_at,updated_at
  ) VALUES (
    p_workspace_id,v_start.account_id,trim(p_encrypted_username),trim(p_encrypted_password),trim(p_encryption_version),
    coalesce(v_existing_version,0)+1,'configured',now(),NULL,now()
  ) ON CONFLICT ON CONSTRAINT linkedin_credentials_workspace_id_account_id_key DO UPDATE SET
    encrypted_username=EXCLUDED.encrypted_username,encrypted_password=EXCLUDED.encrypted_password,
    encryption_version=EXCLUDED.encryption_version,credential_version=EXCLUDED.credential_version,
    credentials_status='configured',encrypted_at=now(),last_attempt_at=NULL,updated_at=now();

  INSERT INTO public.linkedin_session_events(workspace_id,account_id,event_type,event_data)
  VALUES(p_workspace_id,v_start.account_id,'created',jsonb_build_object(
    'action','credentials_configured','credential_version',coalesce(v_existing_version,0)+1,'actor_user_id',v_uid));
  RETURN QUERY SELECT v_start.account_id,v_start.queue_item_id,v_start.queue_status,v_start.attempt_reused,true;
END $$;

REVOKE EXECUTE ON FUNCTION public.start_linkedin_connection_with_credentials(uuid,text,text,text,text,text,uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_linkedin_connection_with_credentials(uuid,text,text,text,text,text,uuid,text)
  TO authenticated;
