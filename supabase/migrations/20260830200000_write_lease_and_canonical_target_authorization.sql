BEGIN;

CREATE TABLE public.linkedin_queue_lease_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  queue_item_id uuid NOT NULL REFERENCES public.browser_execution_queue(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  attempt_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('claimed','renewed','released','renewal_rejected','recovered')),
  lease_expires_at timestamptz,
  server_recorded_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX linkedin_queue_lease_events_task_time_idx ON public.linkedin_queue_lease_events(queue_item_id,server_recorded_at);
ALTER TABLE public.linkedin_queue_lease_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY linkedin_queue_lease_events_member_select ON public.linkedin_queue_lease_events FOR SELECT TO authenticated USING(public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_queue_lease_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_queue_lease_events TO authenticated;
GRANT ALL ON public.linkedin_queue_lease_events TO service_role;

CREATE OR REPLACE FUNCTION public.capture_linkedin_queue_lease_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_event text;
BEGIN
  IF NEW.status='running' AND OLD.status IS DISTINCT FROM 'running' THEN v_event:='claimed';
  ELSIF NEW.status='running' AND OLD.status='running' AND NEW.attempt_id=OLD.attempt_id AND NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at THEN v_event:='renewed';
  ELSIF OLD.status='running' AND NEW.status IN('pending','retry') AND NEW.attempt_id IS NULL THEN v_event:='recovered';
  ELSIF OLD.status='running' AND NEW.status IN('completed','failed','cancelled','escalated') THEN v_event:='released';
  ELSE RETURN NEW;END IF;
  INSERT INTO public.linkedin_queue_lease_events(workspace_id,queue_item_id,account_id,worker_id,attempt_id,event_type,lease_expires_at,evidence)
  VALUES(NEW.workspace_id,NEW.id,NEW.account_id,coalesce(NEW.worker_id,OLD.worker_id),coalesce(NEW.attempt_id,OLD.attempt_id),v_event,NEW.lease_expires_at,
    jsonb_build_object('old_status',OLD.status,'new_status',NEW.status,'old_lease_expires_at',OLD.lease_expires_at));
  RETURN NEW;
END $$;
CREATE TRIGGER capture_linkedin_queue_lease_event AFTER UPDATE OF status,lease_expires_at ON public.browser_execution_queue
FOR EACH ROW EXECUTE FUNCTION public.capture_linkedin_queue_lease_event();

ALTER TABLE public.linkedin_safe_write_targets
  ADD COLUMN customer_campaign_id uuid REFERENCES public.customer_campaigns(id) ON DELETE CASCADE,
  ADD COLUMN contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  ADD COLUMN purpose text NOT NULL DEFAULT 'legacy_staging_allowlist',
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN authorization_evidence jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX linkedin_safe_write_targets_campaign_contact_idx ON public.linkedin_safe_write_targets(workspace_id,customer_campaign_id,contact_id);

CREATE TABLE public.linkedin_staging_write_authorizations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,project_ref text NOT NULL CHECK(project_ref='vdiqfiuqckaxdjkadinu'),
  customer_campaign_id uuid NOT NULL REFERENCES public.customer_campaigns(id) ON DELETE CASCADE,contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  target_identifier text NOT NULL,allowed_action_types text[] NOT NULL, purpose text NOT NULL CHECK(purpose='final_real_write_certification'),
  enabled boolean NOT NULL DEFAULT true,expires_at timestamptz NOT NULL,revoked_at timestamptz,authorization_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,linkedin_account_id,project_ref,customer_campaign_id,contact_id,target_identifier,purpose)
);
ALTER TABLE public.linkedin_staging_write_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY linkedin_staging_write_authorizations_member_select ON public.linkedin_staging_write_authorizations FOR SELECT TO authenticated USING(public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_staging_write_authorizations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_staging_write_authorizations TO authenticated;
GRANT ALL ON public.linkedin_staging_write_authorizations TO service_role;

CREATE OR REPLACE FUNCTION public.normal_campaign_target_authorization(
  p_workspace_id uuid,p_account_id uuid,p_job_id uuid,p_action_type text,p_target text,p_project_ref text
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.linkedin_execution_jobs%ROWTYPE;c public.contacts%ROWTYPE;v_campaign uuid;v_target text;v_auth uuid;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required';END IF;
  IF p_project_ref<>'vdiqfiuqckaxdjkadinu' THEN RETURN jsonb_build_object('allowed',false,'code','staging_only');END IF;
  SELECT * INTO j FROM public.linkedin_execution_jobs WHERE id=p_job_id AND workspace_id=p_workspace_id AND linkedin_account_id=p_account_id;
  IF NOT FOUND OR j.action_type<>p_action_type OR j.contact_id IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','job_binding_mismatch');END IF;
  BEGIN v_campaign:=(j.action_payload->>'source_campaign_id')::uuid;EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('allowed',false,'code','campaign_binding_missing');END;
  IF coalesce((j.action_payload->>'normal_campaign_pilot')::boolean,false) IS NOT TRUE THEN RETURN jsonb_build_object('allowed',false,'code','normal_campaign_authorization_missing');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customer_campaigns cc WHERE cc.id=v_campaign AND cc.workspace_id=p_workspace_id AND cc.linkedin_account_id=p_account_id) THEN RETURN jsonb_build_object('allowed',false,'code','campaign_binding_mismatch');END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customer_campaign_contacts m WHERE m.workspace_id=p_workspace_id AND m.customer_campaign_id=v_campaign AND m.contact_id=j.contact_id) THEN RETURN jsonb_build_object('allowed',false,'code','campaign_contact_mapping_missing');END IF;
  SELECT * INTO c FROM public.contacts WHERE id=j.contact_id AND workspace_id=p_workspace_id;
  v_target:=public.normalize_linkedin_profile_url(p_target);
  IF NOT FOUND OR v_target IS NULL OR c.normalized_linkedin_url IS DISTINCT FROM v_target THEN RETURN jsonb_build_object('allowed',false,'code','canonical_target_mismatch');END IF;
  SELECT s.id INTO v_auth FROM public.linkedin_staging_write_authorizations s WHERE s.workspace_id=p_workspace_id AND s.linkedin_account_id=p_account_id
    AND s.project_ref=p_project_ref AND public.normalize_linkedin_profile_url(s.target_identifier)=v_target
    AND s.customer_campaign_id=v_campaign AND s.contact_id=j.contact_id AND s.enabled AND s.revoked_at IS NULL
    AND(s.expires_at IS NULL OR s.expires_at>now()) AND p_action_type=ANY(s.allowed_action_types)
    AND s.purpose='final_real_write_certification' ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','staging_certification_authorization_missing');END IF;
  RETURN jsonb_build_object('allowed',true,'code','allowed','authorization_id',v_auth,'customer_campaign_id',v_campaign,'contact_id',j.contact_id,'canonical_target',v_target);
END $$;

CREATE OR REPLACE FUNCTION public.preflight_linkedin_write(
  p_task_id uuid,p_attempt_id uuid,p_workspace_id uuid,p_account_id uuid,p_action_type text,p_target text,
  p_idempotency_key text,p_project_ref text,p_campaign_id uuid DEFAULT NULL,p_contact_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE v_job uuid;v_normal boolean;v_auth jsonb;
BEGIN
  SELECT CASE WHEN q.action_params->>'job_id'~*'^[0-9a-f-]{36}$' THEN(q.action_params->>'job_id')::uuid END,
    coalesce((q.action_params->>'normal_campaign_pilot')::boolean,false) INTO v_job,v_normal
  FROM public.browser_execution_queue q WHERE q.id=p_task_id AND q.workspace_id=p_workspace_id AND q.account_id=p_account_id
    AND q.attempt_id=p_attempt_id AND q.worker_id IS NOT NULL AND q.status='running';
  IF NOT FOUND THEN RAISE EXCEPTION 'queue ownership denied';END IF;
  IF v_normal THEN
    v_auth:=public.normal_campaign_target_authorization(p_workspace_id,p_account_id,v_job,p_action_type,p_target,p_project_ref);
    IF coalesce((v_auth->>'allowed')::boolean,false) IS NOT TRUE THEN
      RETURN jsonb_build_object('allowed',false,'code',v_auth->>'code','already_done',false,'authorization',v_auth);
    END IF;
  END IF;
  RETURN public.preflight_linkedin_write_without_acceptance_override(p_task_id,p_attempt_id,p_workspace_id,p_account_id,p_action_type,p_target,p_idempotency_key,p_project_ref,p_campaign_id,p_contact_id);
END $$;

CREATE OR REPLACE FUNCTION public.dry_preflight_normal_campaign_write(
  p_workspace_id uuid,p_account_id uuid,p_job_id uuid,p_action_type text,p_target text,p_project_ref text,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
DECLARE v_auth jsonb;j public.linkedin_execution_jobs%ROWTYPE;a public.linkedin_accounts%ROWTYPE;v_campaign uuid;v_schedule jsonb;v_semantic text;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required';END IF;
  SELECT * INTO j FROM public.linkedin_execution_jobs WHERE id=p_job_id AND workspace_id=p_workspace_id AND linkedin_account_id=p_account_id;
  IF NOT FOUND OR j.status<>'cancelled' OR coalesce((j.action_payload->>'dry_preflight_only')::boolean,false) IS NOT TRUE THEN RETURN jsonb_build_object('allowed',false,'code','dry_job_required');END IF;
  v_auth:=public.normal_campaign_target_authorization(p_workspace_id,p_account_id,p_job_id,p_action_type,p_target,p_project_ref);
  IF coalesce((v_auth->>'allowed')::boolean,false) IS NOT TRUE THEN RETURN v_auth||jsonb_build_object('dry_run',true,'interaction_possible',false);END IF;
  SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id;
  IF NOT FOUND OR a.connection_state<>'connected' OR a.session_status<>'connected' OR a.status IN('paused','restricted','banned') THEN RETURN jsonb_build_object('allowed',false,'code','account_unavailable','dry_run',true,'interaction_possible',false);END IF;
  v_campaign:=(j.action_payload->>'source_campaign_id')::uuid;
  v_schedule:=public.campaign_window_validation(v_campaign,now());
  IF coalesce((v_schedule->>'valid')::boolean,false) IS NOT TRUE THEN RETURN jsonb_build_object('allowed',false,'code','schedule_invalid','schedule',v_schedule,'dry_run',true,'interaction_possible',false);END IF;
  v_semantic:=encode(digest(concat_ws(E'\x1f',p_workspace_id,p_account_id,p_action_type,lower(trim(p_target)),p_idempotency_key),'sha256'),'hex');
  IF EXISTS(SELECT 1 FROM public.linkedin_write_audit WHERE semantic_key=v_semantic) THEN RETURN jsonb_build_object('allowed',false,'code','duplicate_action','dry_run',true,'interaction_possible',false);END IF;
  RETURN v_auth||jsonb_build_object('allowed',true,'code','allowed','dry_run',true,'interaction_possible',false,'write_audit_created',false,'schedule',v_schedule,'idempotency_clear',true,'sender_account_id',p_account_id);
END $$;

INSERT INTO public.linkedin_staging_write_authorizations(workspace_id,linkedin_account_id,project_ref,target_identifier,allowed_action_types,enabled,customer_campaign_id,contact_id,purpose,expires_at,authorization_evidence)
VALUES('dadeb070-8381-4fb7-906c-33cf8e3da198','f8fe4399-594b-4a47-8a2b-a80a8f9fbce1','vdiqfiuqckaxdjkadinu','https://www.linkedin.com/in/pooya-t-bb8445309',ARRAY['connection_request'],true,'610b248e-b0fc-452d-aa89-656cbe34cf43','79a49d2f-7a45-4a31-adc8-b159b9e4e7c4','final_real_write_certification',now()+interval '7 days',jsonb_build_object('source','final_launch_blocker_remediation','writes_authorized',false))
ON CONFLICT(workspace_id,linkedin_account_id,project_ref,customer_campaign_id,contact_id,target_identifier,purpose) DO UPDATE SET expires_at=excluded.expires_at,revoked_at=NULL,enabled=true,allowed_action_types=excluded.allowed_action_types,authorization_evidence=excluded.authorization_evidence,updated_at=now();

/* Compatibility gate used by the immutable legacy preflight. The new scoped
   authorization above is independently mandatory for every normal campaign. */
INSERT INTO public.linkedin_safe_write_targets(workspace_id,linkedin_account_id,project_ref,target_identifier,allowed_action_types,enabled)
VALUES('dadeb070-8381-4fb7-906c-33cf8e3da198','f8fe4399-594b-4a47-8a2b-a80a8f9fbce1','vdiqfiuqckaxdjkadinu','https://www.linkedin.com/in/pooya-t-bb8445309',ARRAY['connection_request'],true)
ON CONFLICT(workspace_id,linkedin_account_id,project_ref,target_identifier) DO UPDATE SET allowed_action_types=excluded.allowed_action_types,enabled=true,updated_at=now();

REVOKE ALL ON FUNCTION public.normal_campaign_target_authorization(uuid,uuid,uuid,text,text,text),public.dry_preflight_normal_campaign_write(uuid,uuid,uuid,text,text,text,text),public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.normal_campaign_target_authorization(uuid,uuid,uuid,text,text,text),public.dry_preflight_normal_campaign_write(uuid,uuid,uuid,text,text,text,text),public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) TO service_role;

COMMIT;
