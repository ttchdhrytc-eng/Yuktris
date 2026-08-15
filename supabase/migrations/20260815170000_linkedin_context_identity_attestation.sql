/* Service-role-only certified sender identity bound to one persistent Context generation. */
CREATE OR REPLACE FUNCTION public.linkedin_canonical_profile_url(p_value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT CASE WHEN lower(trim(p_value)) ~ '^https://(www\.)?linkedin\.com/in/[a-z0-9_%.-]+/?$'
    THEN regexp_replace(lower(trim(p_value)), '/+$', '') ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.certify_linkedin_context_identity(
  p_context_id uuid, p_workspace_id uuid, p_account_id uuid, p_provider_context_id text,
  p_context_generation integer, p_canonical_profile_url text, p_proof_version integer DEFAULT 1
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_profile text; v_bound text;
BEGIN
  v_profile := public.linkedin_canonical_profile_url(p_canonical_profile_url);
  IF v_profile IS NULL OR p_proof_version <> 1 THEN RAISE EXCEPTION 'invalid identity proof'; END IF;
  SELECT public.linkedin_canonical_profile_url(coalesce(a.expected_profile_url,a.profile_url)) INTO v_bound
  FROM public.linkedin_accounts a WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id
    AND a.expected_profile_url IS NOT NULL AND a.profile_url IS NOT NULL
    AND public.linkedin_canonical_profile_url(a.expected_profile_url)=public.linkedin_canonical_profile_url(a.profile_url);
  IF v_bound IS NULL OR v_bound <> v_profile THEN RAISE EXCEPTION 'bound account identity mismatch'; END IF;
  UPDATE public.linkedin_browser_contexts c SET metadata=jsonb_set(c.metadata,'{identity_attestation}',jsonb_build_object(
    'canonical_profile_url',v_profile,'provider_context_id',c.provider_context_id,'context_generation',c.generation,
    'verified_at',now(),'proof_type','two_session_identity_proof','proof_version',p_proof_version,'status','active'),true),updated_at=now()
  WHERE c.id=p_context_id AND c.workspace_id=p_workspace_id AND c.account_id=p_account_id AND c.status IN ('active','in_use')
    AND c.deleted_at IS NULL AND c.provider_context_id=p_provider_context_id AND c.generation=p_context_generation;
  IF NOT FOUND THEN RAISE EXCEPTION 'exact active Context generation required'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_verified_linkedin_context_identity(
  p_context_id uuid, p_workspace_id uuid, p_account_id uuid, p_provider_context_id text, p_context_generation integer
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT c.metadata->'identity_attestation' FROM public.linkedin_browser_contexts c
  JOIN public.linkedin_accounts a ON a.id=c.account_id AND a.workspace_id=c.workspace_id
  WHERE c.id=p_context_id AND c.workspace_id=p_workspace_id AND c.account_id=p_account_id
    AND c.provider_context_id=p_provider_context_id AND c.generation=p_context_generation
    AND c.status IN ('active','in_use') AND c.deleted_at IS NULL
    AND a.status NOT IN ('paused','restricted') AND a.connection_state NOT IN ('requires_action','restricted')
    AND c.metadata->'identity_attestation'->>'status'='active'
    AND c.metadata->'identity_attestation'->>'proof_type'='two_session_identity_proof'
    AND (c.metadata->'identity_attestation'->>'proof_version')::integer=1
    AND c.metadata->'identity_attestation'->>'provider_context_id'=c.provider_context_id
    AND (c.metadata->'identity_attestation'->>'context_generation')::integer=c.generation
    AND public.linkedin_canonical_profile_url(c.metadata->'identity_attestation'->>'canonical_profile_url')=public.linkedin_canonical_profile_url(a.expected_profile_url)
    AND public.linkedin_canonical_profile_url(a.expected_profile_url)=public.linkedin_canonical_profile_url(a.profile_url)
$$;

CREATE OR REPLACE FUNCTION public.revoke_linkedin_context_identity(
  p_context_id uuid, p_workspace_id uuid, p_account_id uuid, p_reason text DEFAULT 'revoked'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.linkedin_browser_contexts SET metadata=jsonb_set(jsonb_set(metadata,'{identity_attestation,status}','"revoked"',false),
    '{identity_attestation,revoked_reason}',to_jsonb(left(regexp_replace(coalesce(p_reason,'revoked'),'[^a-zA-Z0-9_.-]','','g'),64)),true),updated_at=now()
  WHERE id=p_context_id AND workspace_id=p_workspace_id AND account_id=p_account_id AND metadata ? 'identity_attestation';
END $$;

REVOKE ALL ON FUNCTION public.linkedin_canonical_profile_url(text),
  public.certify_linkedin_context_identity(uuid,uuid,uuid,text,integer,text,integer),
  public.get_verified_linkedin_context_identity(uuid,uuid,uuid,text,integer),
  public.revoke_linkedin_context_identity(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.linkedin_canonical_profile_url(text),
  public.certify_linkedin_context_identity(uuid,uuid,uuid,text,integer,text,integer),
  public.get_verified_linkedin_context_identity(uuid,uuid,uuid,text,integer),
  public.revoke_linkedin_context_identity(uuid,uuid,uuid,text) TO service_role;
