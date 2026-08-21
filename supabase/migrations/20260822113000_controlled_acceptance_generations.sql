BEGIN;

CREATE TABLE public.controlled_acceptance_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id),
  campaign_id uuid NOT NULL REFERENCES public.customer_campaigns(id),
  contact_id uuid NOT NULL REFERENCES public.contacts(id),
  target_identifier text NOT NULL,
  idempotency_namespace text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'relationship_check_pending' CHECK (status IN
    ('relationship_check_pending','connected','pending','eligible','write_prepared','succeeded','outcome_unknown','failed')),
  relationship_queue_id uuid REFERENCES public.browser_execution_queue(id),
  write_job_id uuid REFERENCES public.linkedin_execution_jobs(id),
  relationship_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.controlled_acceptance_generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid NOT NULL REFERENCES public.controlled_acceptance_generations(id),
  event_type text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_one_active_acceptance_generation ON public.controlled_acceptance_generations(workspace_id)
  WHERE status IN ('relationship_check_pending','eligible','write_prepared');
CREATE UNIQUE INDEX uq_one_successful_acceptance_generation ON public.controlled_acceptance_generations(workspace_id)
  WHERE status='succeeded';

ALTER TABLE public.controlled_acceptance_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controlled_acceptance_generation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY acceptance_generations_workspace_read ON public.controlled_acceptance_generations FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY acceptance_generation_events_workspace_read ON public.controlled_acceptance_generation_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.controlled_acceptance_generations g WHERE g.id=generation_id AND public.is_workspace_member(g.workspace_id)));

CREATE OR REPLACE FUNCTION public.preserve_acceptance_generation_history() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'controlled_acceptance_generation_history_is_immutable'; END IF;
  IF NEW.workspace_id<>OLD.workspace_id OR NEW.linkedin_account_id<>OLD.linkedin_account_id
     OR NEW.campaign_id<>OLD.campaign_id OR NEW.contact_id<>OLD.contact_id
     OR NEW.target_identifier<>OLD.target_identifier OR NEW.idempotency_namespace<>OLD.idempotency_namespace
     OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at
     OR (OLD.relationship_queue_id IS NOT NULL AND NEW.relationship_queue_id IS DISTINCT FROM OLD.relationship_queue_id)
     OR (OLD.write_job_id IS NOT NULL AND NEW.write_job_id IS DISTINCT FROM OLD.write_job_id) THEN
    RAISE EXCEPTION 'controlled_acceptance_generation_identity_is_immutable';
  END IF;
  NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER preserve_acceptance_generation_history_trigger BEFORE UPDATE OR DELETE ON public.controlled_acceptance_generations
FOR EACH ROW EXECUTE FUNCTION public.preserve_acceptance_generation_history();
CREATE OR REPLACE FUNCTION public.preserve_acceptance_generation_events() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled_acceptance_generation_events_are_append_only'; END $$;
CREATE TRIGGER preserve_acceptance_generation_events_trigger BEFORE UPDATE OR DELETE ON public.controlled_acceptance_generation_events
FOR EACH ROW EXECUTE FUNCTION public.preserve_acceptance_generation_events();

CREATE OR REPLACE FUNCTION public.start_controlled_acceptance_generation(
  p_workspace_id uuid,p_account_id uuid,p_campaign_id uuid,p_contact_id uuid,p_target text,p_created_by uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE g public.controlled_acceptance_generations%ROWTYPE; q public.browser_execution_queue%ROWTYPE;
  normalized text:=lower(regexp_replace(split_part(trim(p_target),'?',1),'/+$',''));
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;
  IF normalized<>'https://www.linkedin.com/in/tarun-chaudhary' THEN RAISE EXCEPTION 'controlled_acceptance_target_not_allowlisted'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id=p_workspace_id AND user_id=p_created_by AND role IN ('owner','admin') AND status='active') THEN
    RAISE EXCEPTION 'controlled_acceptance_admin_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_campaigns c JOIN public.customer_campaign_contacts m ON m.customer_campaign_id=c.id AND m.contact_id=p_contact_id
    JOIN public.contacts ct ON ct.id=p_contact_id WHERE c.id=p_campaign_id AND c.workspace_id=p_workspace_id AND c.linkedin_account_id=p_account_id
    AND lower(regexp_replace(split_part(trim(ct.linkedin_url),'?',1),'/+$',''))=normalized) THEN RAISE EXCEPTION 'controlled_acceptance_scope_mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.linkedin_safe_write_targets WHERE workspace_id=p_workspace_id AND linkedin_account_id=p_account_id
    AND project_ref='vdiqfiuqckaxdjkadinu' AND enabled AND target_identifier=normalized AND allowed_action_types @> ARRAY['connection_request']::text[]) THEN
    RAISE EXCEPTION 'controlled_acceptance_target_not_allowlisted'; END IF;
  IF EXISTS (SELECT 1 FROM public.controlled_acceptance_generations WHERE workspace_id=p_workspace_id AND status IN ('relationship_check_pending','eligible','write_prepared')) THEN
    RAISE EXCEPTION 'controlled_acceptance_generation_already_active'; END IF;
  IF EXISTS (SELECT 1 FROM public.linkedin_write_audit w JOIN public.browser_execution_queue b ON b.id=w.task_id
    WHERE b.workspace_id=p_workspace_id AND w.action_type='connection_request' AND w.target_identifier=normalized AND w.execution_result='success') THEN
    RAISE EXCEPTION 'controlled_acceptance_already_succeeded'; END IF;
  INSERT INTO public.controlled_acceptance_generations(workspace_id,linkedin_account_id,campaign_id,contact_id,target_identifier,idempotency_namespace,created_by)
  VALUES(p_workspace_id,p_account_id,p_campaign_id,p_contact_id,normalized,'controlled-acceptance-generation:'||gen_random_uuid(),p_created_by) RETURNING * INTO g;
  INSERT INTO public.browser_execution_queue(workspace_id,account_id,action_type,action_params,priority,priority_label,status,max_retries,metadata)
  VALUES(p_workspace_id,p_account_id,'check_connection_acceptance',jsonb_build_object('profile_url',normalized,'acceptance_generation_id',g.id,'forensic_read_only',true),1,'critical','pending',0,
    jsonb_build_object('acceptance_generation_id',g.id,'idempotency_namespace',g.idempotency_namespace,'read_only',true)) RETURNING * INTO q;
  UPDATE public.controlled_acceptance_generations SET relationship_queue_id=q.id WHERE id=g.id;
  INSERT INTO public.controlled_acceptance_generation_events(generation_id,event_type,evidence) VALUES(g.id,'relationship_check_started',jsonb_build_object('queue_id',q.id));
  RETURN jsonb_build_object('generation_id',g.id,'idempotency_namespace',g.idempotency_namespace,'relationship_queue_id',q.id,'status','relationship_check_pending','write_performed',false);
END $$;

CREATE OR REPLACE FUNCTION public.advance_controlled_acceptance_generation(p_generation_id uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE g public.controlled_acceptance_generations%ROWTYPE; q public.browser_execution_queue%ROWTYPE; evidence jsonb; next_at timestamptz; j public.linkedin_execution_jobs%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO g FROM public.controlled_acceptance_generations WHERE id=p_generation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'controlled_acceptance_generation_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id=g.workspace_id AND user_id=p_actor AND role IN ('owner','admin') AND status='active') THEN RAISE EXCEPTION 'controlled_acceptance_admin_required'; END IF;
  IF g.status<>'relationship_check_pending' THEN RETURN jsonb_build_object('generation_id',g.id,'status',g.status,'write_job_id',g.write_job_id); END IF;
  SELECT * INTO q FROM public.browser_execution_queue WHERE id=g.relationship_queue_id;
  IF q.status NOT IN ('completed','failed') THEN RETURN jsonb_build_object('generation_id',g.id,'status','relationship_check_pending'); END IF;
  evidence:=coalesce(q.result,'{}'::jsonb);
  IF q.status='failed' OR NOT coalesce(evidence->>'result_code','')='success' THEN g.status:='outcome_unknown';
  ELSIF coalesce((evidence->>'pending')::boolean,false) THEN g.status:='pending';
  ELSIF coalesce((evidence->>'accepted')::boolean,false) OR coalesce((evidence->>'first_degree')::boolean,false) OR coalesce((evidence->>'message_available')::boolean,false) THEN g.status:='connected';
  ELSIF coalesce((evidence->>'connect_available')::boolean,false) THEN g.status:='eligible';
  ELSE g.status:='outcome_unknown'; END IF;
  UPDATE public.controlled_acceptance_generations SET status=g.status,relationship_evidence=evidence WHERE id=g.id;
  INSERT INTO public.controlled_acceptance_generation_events(generation_id,event_type,evidence) VALUES(g.id,'relationship_classified',jsonb_build_object('classification',g.status,'evidence',evidence));
  IF g.status<>'eligible' THEN RETURN jsonb_build_object('generation_id',g.id,'status',g.status,'write_performed',false); END IF;
  next_at:=public.next_campaign_account_outreach_at(g.campaign_id,g.linkedin_account_id,now());
  IF next_at IS NULL THEN UPDATE public.controlled_acceptance_generations SET status='failed' WHERE id=g.id; RETURN jsonb_build_object('generation_id',g.id,'status','failed','code','no_effective_sending_window'); END IF;
  INSERT INTO public.linkedin_execution_jobs(workspace_id,linkedin_account_id,contact_id,action_type,status,priority,scheduled_at,sequence_step,max_retries,action_payload)
  VALUES(g.workspace_id,g.linkedin_account_id,g.contact_id,'connection_request','scheduled',1,next_at,-1,0,jsonb_build_object(
    'source_campaign_id',g.campaign_id,'profile_url',g.target_identifier,'acceptance_test_mode',true,'acceptance_generation_id',g.id,
    'idempotency_namespace',g.idempotency_namespace,'human_initiated',true,'human_initiated_by',p_actor)) RETURNING * INTO j;
  UPDATE public.controlled_acceptance_generations SET status='write_prepared',write_job_id=j.id WHERE id=g.id;
  INSERT INTO public.controlled_acceptance_generation_events(generation_id,event_type,evidence) VALUES(g.id,'write_prepared',jsonb_build_object('job_id',j.id,'scheduled_at',next_at));
  RETURN jsonb_build_object('generation_id',g.id,'status','write_prepared','write_job_id',j.id,'scheduled_at',next_at,'write_performed',false);
END $$;

CREATE OR REPLACE FUNCTION public.guard_controlled_acceptance_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE generation_id uuid; g public.controlled_acceptance_generations%ROWTYPE;
BEGIN
  IF NOT coalesce((NEW.action_payload->>'acceptance_test_mode')::boolean,false) THEN RETURN NEW; END IF;
  IF coalesce((NEW.action_payload->>'human_initiated')::boolean,false) IS NOT TRUE OR nullif(NEW.action_payload->>'human_initiated_by','') IS NULL THEN RAISE EXCEPTION 'controlled_acceptance_human_initiation_required'; END IF;
  BEGIN generation_id:=(NEW.action_payload->>'acceptance_generation_id')::uuid; EXCEPTION WHEN OTHERS THEN generation_id:=NULL; END;
  IF generation_id IS NULL THEN RAISE EXCEPTION 'controlled_acceptance_generation_required'; END IF;
  SELECT * INTO g FROM public.controlled_acceptance_generations WHERE id=generation_id FOR UPDATE;
  IF NOT FOUND OR g.status<>'eligible' OR g.workspace_id<>NEW.workspace_id OR g.linkedin_account_id<>NEW.linkedin_account_id OR g.contact_id<>NEW.contact_id
     OR g.target_identifier<>NEW.action_payload->>'profile_url' OR g.idempotency_namespace<>NEW.action_payload->>'idempotency_namespace' THEN RAISE EXCEPTION 'controlled_acceptance_generation_scope_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM public.linkedin_execution_jobs WHERE workspace_id=NEW.workspace_id AND coalesce((action_payload->>'acceptance_test_mode')::boolean,false)
    AND status IN ('queued','scheduled','running','pending','retry','retrying')) THEN RAISE EXCEPTION 'controlled_acceptance_already_active'; END IF;
  IF EXISTS (SELECT 1 FROM public.linkedin_write_audit w JOIN public.browser_execution_queue b ON b.id=w.task_id
    WHERE b.workspace_id=NEW.workspace_id AND w.action_type='connection_request' AND w.execution_result='success') THEN RAISE EXCEPTION 'controlled_acceptance_already_succeeded'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_controlled_acceptance_generation(p_generation_id uuid,p_queue_id uuid,p_outcome text,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE g public.controlled_acceptance_generations%ROWTYPE; terminal_status text;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO g FROM public.controlled_acceptance_generations WHERE id=p_generation_id FOR UPDATE;
  IF NOT FOUND OR g.status<>'write_prepared' THEN RAISE EXCEPTION 'controlled_acceptance_generation_not_write_prepared'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.browser_execution_queue q WHERE q.id=p_queue_id AND q.workspace_id=g.workspace_id
      AND q.action_params->>'job_id'=g.write_job_id::text) THEN RAISE EXCEPTION 'controlled_acceptance_queue_scope_mismatch'; END IF;
  terminal_status:=CASE p_outcome WHEN 'verified_sent' THEN 'succeeded' WHEN 'already_connected' THEN 'connected'
    WHEN 'already_pending' THEN 'pending' ELSE 'outcome_unknown' END;
  UPDATE public.controlled_acceptance_generations SET status=terminal_status,relationship_evidence=relationship_evidence||coalesce(p_evidence,'{}'::jsonb) WHERE id=g.id;
  INSERT INTO public.controlled_acceptance_generation_events(generation_id,event_type,evidence)
  VALUES(g.id,'write_terminal',jsonb_build_object('queue_id',p_queue_id,'outcome',terminal_status,'evidence',coalesce(p_evidence,'{}'::jsonb)));
END $$;

REVOKE ALL ON TABLE public.controlled_acceptance_generations,public.controlled_acceptance_generation_events FROM anon,authenticated;
GRANT SELECT ON TABLE public.controlled_acceptance_generations,public.controlled_acceptance_generation_events TO authenticated;
REVOKE ALL ON FUNCTION public.start_controlled_acceptance_generation(uuid,uuid,uuid,uuid,text,uuid),public.advance_controlled_acceptance_generation(uuid,uuid),public.finalize_controlled_acceptance_generation(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_controlled_acceptance_generation(uuid,uuid,uuid,uuid,text,uuid),public.advance_controlled_acceptance_generation(uuid,uuid),public.finalize_controlled_acceptance_generation(uuid,uuid,text,jsonb) TO service_role;

COMMIT;
