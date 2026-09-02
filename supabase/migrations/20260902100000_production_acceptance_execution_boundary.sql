BEGIN;
SET LOCAL search_path=pg_catalog,public;
ALTER TABLE public.browser_execution_queue ADD COLUMN acceptance_max_boundary smallint,
 ADD COLUMN acceptance_terminal_attestation text, ADD COLUMN acceptance_terminal_attested_at timestamptz,
 ADD CONSTRAINT acceptance_boundary_range CHECK(acceptance_max_boundary IS NULL OR acceptance_max_boundary IN(10,20,30,40,50)),
 ADD CONSTRAINT acceptance_terminal_attestation_consistent CHECK((acceptance_terminal_attestation IS NULL AND acceptance_terminal_attested_at IS NULL) OR (acceptance_terminal_attestation='terminal_pre_browserbase_attested' AND acceptance_terminal_attested_at IS NOT NULL AND acceptance_max_boundary=10));
ALTER TABLE public.linkedin_production_acceptance_authorizations ADD COLUMN max_execution_boundary smallint,
 ADD COLUMN terminal_boundary_attestation text, ADD COLUMN terminal_boundary_attested_at timestamptz,
 ADD CONSTRAINT production_acceptance_boundary_range CHECK(max_execution_boundary IS NULL OR max_execution_boundary IN(10,20,30,40,50)),
 ADD CONSTRAINT production_acceptance_terminal_attestation_consistent CHECK((terminal_boundary_attestation IS NULL AND terminal_boundary_attested_at IS NULL) OR (terminal_boundary_attestation='terminal_pre_browserbase_attested' AND terminal_boundary_attested_at IS NOT NULL AND max_execution_boundary=10));
CREATE TABLE public.linkedin_production_acceptance_boundary_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),authorization_id uuid NOT NULL REFERENCES public.linkedin_production_acceptance_authorizations(id) ON DELETE RESTRICT,
 queue_item_id uuid NOT NULL REFERENCES public.browser_execution_queue(id) ON DELETE RESTRICT,attempt_id uuid NOT NULL,worker_id text NOT NULL,
 boundary_rank smallint NOT NULL CHECK(boundary_rank IN(10,20,30,40,50)),boundary_name text NOT NULL CHECK(boundary_name IN('claimed_pre_browserbase','browserbase_acquisition_started','browserbase_acquired','live_pre_interaction','interaction_boundary_crossed','terminal_pre_browserbase_attested')),
 terminal boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(authorization_id,attempt_id,boundary_name));
ALTER TABLE public.linkedin_production_acceptance_boundary_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.linkedin_production_acceptance_boundary_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_production_acceptance_boundary_events TO service_role;
CREATE FUNCTION public.reject_production_acceptance_boundary_event_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$BEGIN RAISE EXCEPTION 'acceptance_boundary_events_immutable';END$$;
CREATE TRIGGER production_acceptance_boundary_events_immutable BEFORE UPDATE OR DELETE ON public.linkedin_production_acceptance_boundary_events FOR EACH ROW EXECUTE FUNCTION public.reject_production_acceptance_boundary_event_mutation();

CREATE FUNCTION public.initialize_production_acceptance_claim_boundary() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE;
BEGIN
 IF OLD.status='pending' AND NEW.status='running' AND NEW.action_params?'production_acceptance_authorization_id' THEN
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=(NEW.action_params->>'production_acceptance_authorization_id')::uuid FOR UPDATE;
  IF NOT FOUND OR a.status<>'armed' OR a.queue_item_id<>NEW.id OR a.attempt_id IS NOT NULL OR NEW.attempt_id IS NULL OR NEW.worker_id IS NULL OR a.linkedin_account_id<>NEW.account_id OR a.workspace_id<>NEW.workspace_id OR NEW.max_retries<>0 OR NEW.max_infrastructure_retries<>0 THEN RAISE EXCEPTION 'acceptance_claim_boundary_binding_denied';END IF;
  NEW.acceptance_max_boundary:=10;UPDATE public.linkedin_production_acceptance_authorizations SET max_execution_boundary=10,updated_at=now() WHERE id=a.id;
  INSERT INTO public.linkedin_production_acceptance_boundary_events(authorization_id,queue_item_id,attempt_id,worker_id,boundary_rank,boundary_name) VALUES(a.id,NEW.id,NEW.attempt_id,NEW.worker_id,10,'claimed_pre_browserbase');
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER initialize_production_acceptance_claim_boundary_trigger BEFORE UPDATE OF status ON public.browser_execution_queue FOR EACH ROW EXECUTE FUNCTION public.initialize_production_acceptance_claim_boundary();

CREATE FUNCTION public.advance_production_acceptance_execution_boundary(p_task_id uuid,p_attempt_id uuid,p_worker_id text,p_authorization_id uuid,p_boundary_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE q public.browser_execution_queue%ROWTYPE;a public.linkedin_production_acceptance_authorizations%ROWTYPE;r smallint;
BEGIN
 IF current_user NOT IN('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required';END IF;
 r:=CASE p_boundary_name WHEN 'browserbase_acquisition_started' THEN 20 WHEN 'browserbase_acquired' THEN 30 WHEN 'live_pre_interaction' THEN 40 WHEN 'interaction_boundary_crossed' THEN 50 END;
 IF r IS NULL THEN RAISE EXCEPTION 'invalid_acceptance_boundary';END IF;
 SELECT * INTO q FROM public.browser_execution_queue WHERE id=p_task_id FOR UPDATE;SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_authorization_id FOR UPDATE;
 IF q.id IS NULL OR a.id IS NULL OR q.status<>'running' OR a.status<>'executing' OR q.attempt_id<>p_attempt_id OR a.attempt_id<>p_attempt_id OR q.worker_id<>p_worker_id OR a.worker_id<>p_worker_id OR a.queue_item_id<>q.id OR q.action_params->>'production_acceptance_authorization_id'<>a.id::text OR q.acceptance_max_boundary IS NULL OR a.max_execution_boundary IS NULL THEN RAISE EXCEPTION 'acceptance_boundary_binding_denied';END IF;
 IF r<q.acceptance_max_boundary OR r<a.max_execution_boundary THEN RAISE EXCEPTION 'acceptance_boundary_regression_denied';END IF;
 UPDATE public.browser_execution_queue SET acceptance_max_boundary=greatest(acceptance_max_boundary,r),updated_at=now() WHERE id=q.id;UPDATE public.linkedin_production_acceptance_authorizations SET max_execution_boundary=greatest(max_execution_boundary,r),updated_at=now() WHERE id=a.id;
 INSERT INTO public.linkedin_production_acceptance_boundary_events(authorization_id,queue_item_id,attempt_id,worker_id,boundary_rank,boundary_name) VALUES(a.id,q.id,p_attempt_id,p_worker_id,r,p_boundary_name) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('recorded',true,'boundary_rank',r);
END$$;

CREATE FUNCTION public.attest_production_acceptance_prebrowser_terminal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE;
BEGIN
 IF OLD.status='running' AND NEW.status='failed' AND OLD.action_params?'production_acceptance_authorization_id' AND OLD.acceptance_max_boundary=10 AND OLD.browserbase_session_id IS NULL AND OLD.persistent_context_id IS NULL AND NOT OLD.interaction_crossed AND OLD.retry_count=0 THEN
  SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=(OLD.action_params->>'production_acceptance_authorization_id')::uuid FOR UPDATE;
  IF FOUND AND a.status='executing' AND a.queue_item_id=OLD.id AND a.max_execution_boundary=10 AND a.preflighted_at IS NULL AND a.consumed_at IS NULL THEN
   NEW.acceptance_terminal_attestation:='terminal_pre_browserbase_attested';NEW.acceptance_terminal_attested_at:=now();UPDATE public.linkedin_production_acceptance_authorizations SET terminal_boundary_attestation='terminal_pre_browserbase_attested',terminal_boundary_attested_at=now(),updated_at=now() WHERE id=a.id;
   INSERT INTO public.linkedin_production_acceptance_boundary_events(authorization_id,queue_item_id,attempt_id,worker_id,boundary_rank,boundary_name,terminal) VALUES(a.id,OLD.id,OLD.attempt_id,OLD.worker_id,10,'terminal_pre_browserbase_attested',true);
  END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER attest_production_acceptance_prebrowser_terminal_trigger BEFORE UPDATE OF status ON public.browser_execution_queue FOR EACH ROW EXECUTE FUNCTION public.attest_production_acceptance_prebrowser_terminal();

ALTER FUNCTION public.production_linkedin_acceptance_replacement_eligibility(uuid) RENAME TO production_linkedin_acceptance_replacement_eligibility_pristine_only;
REVOKE ALL ON FUNCTION public.production_linkedin_acceptance_replacement_eligibility_pristine_only(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.production_linkedin_acceptance_replacement_eligibility(p_existing_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.linkedin_production_acceptance_authorizations%ROWTYPE;q public.browser_execution_queue%ROWTYPE;c integer;t integer;m smallint;
BEGIN
 IF current_user NOT IN('service_role','postgres') THEN RAISE EXCEPTION 'service_role_required';END IF;SELECT * INTO a FROM public.linkedin_production_acceptance_authorizations WHERE id=p_existing_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('eligible',false,'class','CLASS_C_NON_REPLACEABLE','code','missing');END IF;
 IF a.status='prepared' THEN RETURN public.production_linkedin_acceptance_replacement_eligibility_pristine_only(a.id);END IF;
 SELECT * INTO q FROM public.browser_execution_queue WHERE id=a.queue_item_id;SELECT count(*)FILTER(WHERE boundary_name='claimed_pre_browserbase'),count(*)FILTER(WHERE boundary_name='terminal_pre_browserbase_attested' AND terminal),max(boundary_rank) INTO c,t,m FROM public.linkedin_production_acceptance_boundary_events WHERE authorization_id=a.id;
 IF a.status<>'failed' OR q.id IS NULL OR q.status<>'failed' OR q.id<>a.queue_item_id OR q.action_params->>'production_acceptance_authorization_id'<>a.id::text OR q.attempt_id IS DISTINCT FROM a.attempt_id OR q.worker_id IS DISTINCT FROM a.worker_id OR q.account_id<>a.linkedin_account_id OR q.workspace_id<>a.workspace_id OR q.max_retries<>0 OR q.max_infrastructure_retries<>0 OR q.acceptance_max_boundary<>10 OR a.max_execution_boundary<>10 OR q.acceptance_terminal_attestation<>'terminal_pre_browserbase_attested' OR a.terminal_boundary_attestation<>'terminal_pre_browserbase_attested' OR q.acceptance_terminal_attested_at IS NULL OR a.terminal_boundary_attested_at IS NULL OR c<>1 OR t<>1 OR m<>10 OR q.browserbase_session_id IS NOT NULL OR q.persistent_context_id IS NOT NULL OR q.interaction_crossed OR q.retry_count<>0 OR a.preflighted_at IS NOT NULL OR a.consumed_at IS NOT NULL OR coalesce(q.result->>'result_code','') IN('outcome_unknown','success') OR EXISTS(SELECT 1 FROM public.linkedin_write_audit w WHERE w.task_id=q.id OR (w.linkedin_account_id=a.linkedin_account_id AND w.action_type=a.action_type AND lower(trim(w.target_identifier))=a.canonical_target_url)) OR EXISTS(SELECT 1 FROM public.linkedin_write_interaction_events e WHERE e.queue_item_id=q.id) OR EXISTS(SELECT 1 FROM public.browser_execution_queue q2 WHERE q2.id<>q.id AND q2.action_params->>'production_acceptance_authorization_id'=a.id::text) THEN RETURN jsonb_build_object('eligible',false,'class','CLASS_C_NON_REPLACEABLE','code','positive_prebrowser_attestation_incomplete_or_contradictory');END IF;
 RETURN jsonb_build_object('eligible',true,'class','CLASS_B_PROVEN_PRE_INTERACTION','code','terminal_pre_browserbase_attested','authorization_id',a.id);
END$$;
REVOKE ALL ON FUNCTION public.advance_production_acceptance_execution_boundary(uuid,uuid,text,uuid,text),public.production_linkedin_acceptance_replacement_eligibility(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reject_production_acceptance_boundary_event_mutation(),public.initialize_production_acceptance_claim_boundary(),public.attest_production_acceptance_prebrowser_terminal() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.advance_production_acceptance_execution_boundary(uuid,uuid,text,uuid,text),public.production_linkedin_acceptance_replacement_eligibility(uuid) TO service_role;
COMMIT;
