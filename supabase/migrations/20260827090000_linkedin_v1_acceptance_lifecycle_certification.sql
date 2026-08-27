BEGIN;

-- One fail-closed contract for both historical {data:{...}} probe results and
-- the current worker's top-level result. Booleans are only derived from
-- explicit positive evidence; missing or malformed input stays inconclusive.
CREATE OR REPLACE FUNCTION public.normalize_linkedin_relationship_result(p_result jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v jsonb := CASE WHEN jsonb_typeof(p_result->'data')='object' THEN p_result->'data' ELSE p_result END;
  v_class text;
  v_code text;
  v_accepted boolean := false;
  v_pending boolean := false;
  v_eligible boolean := false;
BEGIN
  IF jsonb_typeof(v) <> 'object' THEN
    RETURN jsonb_build_object('classification','malformed','accepted',false,'pending',false,'eligible',false,'result_code','malformed_evidence');
  END IF;
  v_class := lower(coalesce(v->>'relationship_classification',v->>'connection_state',''));
  v_code := lower(coalesce(v->>'result_code',''));
  IF v_code IN ('checkpoint_required','captcha_required','otp_required','security_interruption','session_invalid','sender_identity_mismatch') THEN
    RETURN jsonb_build_object('classification','security_interruption','accepted',false,'pending',false,'eligible',false,'result_code',v_code);
  END IF;
  v_accepted := coalesce((CASE WHEN v->>'accepted' IN ('true','false') THEN (v->>'accepted')::boolean END),false)
    OR coalesce((CASE WHEN v->>'first_degree' IN ('true','false') THEN (v->>'first_degree')::boolean END),false)
    OR v_class IN ('already_connected','connected','accepted','1st_degree');
  v_pending := NOT v_accepted AND (
    coalesce((CASE WHEN v->>'pending' IN ('true','false') THEN (v->>'pending')::boolean END),false)
    OR v_class IN ('invitation_pending','request_pending','pending'));
  v_eligible := NOT v_accepted AND NOT v_pending AND (
    coalesce((CASE WHEN v->>'connect_available' IN ('true','false') THEN (v->>'connect_available')::boolean END),false)
    OR v_class='eligible_for_connection_request');
  RETURN jsonb_build_object(
    'classification', CASE WHEN v_accepted THEN 'connected' WHEN v_pending THEN 'pending_invitation'
      WHEN v_eligible THEN 'eligible' WHEN v_class='unavailable' THEN 'unavailable'
      WHEN v_class IN ('probe_inconclusive','inconclusive') THEN 'inconclusive' ELSE 'inconclusive' END,
    'accepted',v_accepted,'pending',v_pending,'eligible',v_eligible,
    'result_code',nullif(v_code,''),
    'source_shape',CASE WHEN jsonb_typeof(p_result->'data')='object' THEN 'nested_data' ELSE 'top_level' END
  );
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('classification','malformed','accepted',false,'pending',false,'eligible',false,'result_code','malformed_evidence');
END;
$$;

CREATE TABLE public.linkedin_connection_acceptance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  customer_campaign_id uuid NOT NULL REFERENCES public.customer_campaigns(id) ON DELETE RESTRICT,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE RESTRICT,
  connection_job_id uuid NOT NULL REFERENCES public.linkedin_execution_jobs(id) ON DELETE RESTRICT,
  probe_queue_id uuid NOT NULL REFERENCES public.browser_execution_queue(id) ON DELETE RESTRICT,
  normalized_evidence jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT linkedin_acceptance_one_per_connection UNIQUE(connection_job_id),
  CONSTRAINT linkedin_acceptance_one_per_campaign_identity UNIQUE(workspace_id,customer_campaign_id,contact_id,linkedin_account_id)
);
CREATE UNIQUE INDEX linkedin_acceptance_probe_once ON public.linkedin_connection_acceptance_events(probe_queue_id);
ALTER TABLE public.linkedin_connection_acceptance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY linkedin_acceptance_member_select ON public.linkedin_connection_acceptance_events
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_connection_acceptance_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_connection_acceptance_events TO authenticated;
GRANT ALL ON public.linkedin_connection_acceptance_events TO service_role;

CREATE OR REPLACE FUNCTION public.reject_linkedin_acceptance_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'LinkedIn acceptance events are immutable'; END $$;
CREATE TRIGGER linkedin_acceptance_events_immutable
  BEFORE UPDATE OR DELETE ON public.linkedin_connection_acceptance_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_linkedin_acceptance_event_mutation();

ALTER TABLE public.linkedin_sequence_state DROP CONSTRAINT linkedin_sequence_state_step_status_check;
ALTER TABLE public.linkedin_sequence_state ADD CONSTRAINT linkedin_sequence_state_step_status_check
  CHECK (step_status IN ('pending','in_progress','completed','failed','skipped','stopped','waiting_for_acceptance','waiting_for_reply','cancelled'));

CREATE TABLE public.linkedin_sequence_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  sequence_state_id uuid NOT NULL REFERENCES public.linkedin_sequence_state(id) ON DELETE RESTRICT,
  previous_status text NOT NULL,
  reconciled_status text NOT NULL,
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sequence_state_id,previous_status,reconciled_status,reason)
);
ALTER TABLE public.linkedin_sequence_reconciliation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY linkedin_sequence_reconciliation_member_select ON public.linkedin_sequence_reconciliation_events
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_sequence_reconciliation_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_sequence_reconciliation_events TO authenticated;
GRANT ALL ON public.linkedin_sequence_reconciliation_events TO service_role;

-- State-only repair: deliberately creates no execution job or browser queue.
CREATE OR REPLACE FUNCTION public.reconcile_dormant_linkedin_sequence_states(p_workspace_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; v_status text; v_reason text; v_count integer:=0;
BEGIN
  FOR r IN SELECT ss.*,s.campaign_id FROM public.linkedin_sequence_state ss JOIN public.linkedin_sequences s ON s.id=ss.sequence_id
    WHERE ss.workspace_id=p_workspace_id AND ss.step_status='pending' AND ss.next_action_at IS NULL FOR UPDATE OF ss SKIP LOCKED
  LOOP
    IF EXISTS(SELECT 1 FROM public.linkedin_inbound_replies ir WHERE ir.workspace_id=p_workspace_id AND ir.contact_id=r.contact_id AND ir.match_status='matched') THEN
      v_status:='stopped'; v_reason:='prospect_replied';
    ELSIF NOT EXISTS(SELECT 1 FROM public.customer_campaigns cc WHERE cc.id=r.campaign_id AND cc.workspace_id=p_workspace_id AND cc.status='running') THEN
      v_status:='cancelled'; v_reason:='campaign_not_running';
    ELSIF EXISTS(SELECT 1 FROM public.linkedin_connection_acceptance_events ae WHERE ae.workspace_id=p_workspace_id AND ae.contact_id=r.contact_id AND ae.linkedin_account_id=r.linkedin_account_id) THEN
      v_status:='waiting_for_reply'; v_reason:='accepted_without_runnable_next_step';
    ELSIF EXISTS(SELECT 1 FROM public.linkedin_execution_jobs j WHERE j.workspace_id=p_workspace_id AND j.contact_id=r.contact_id AND j.linkedin_account_id=r.linkedin_account_id
      AND j.action_type='connection_request' AND j.status='completed' AND j.result_payload->>'result_code'='success' AND j.result_payload->>'write_verified'='true'
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)=false) THEN
      v_status:='waiting_for_acceptance'; v_reason:='connection_sent_waiting_for_positive_acceptance';
    ELSE v_status:='failed'; v_reason:='no_verified_normal_connection'; END IF;
    UPDATE public.linkedin_sequence_state SET step_status=v_status,stopped_reason=v_reason,updated_at=now(),
      completed_at=CASE WHEN v_status IN ('stopped','cancelled','failed') THEN coalesce(completed_at,now()) ELSE completed_at END WHERE id=r.id;
    INSERT INTO public.linkedin_sequence_reconciliation_events(workspace_id,sequence_state_id,previous_status,reconciled_status,reason,evidence)
      VALUES(p_workspace_id,r.id,'pending',v_status,v_reason,jsonb_build_object('previous_next_action_at',r.next_action_at)) ON CONFLICT DO NOTHING;
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_linkedin_acceptance_events(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; v_inserted integer:=0; v_messages integer:=0; v_event uuid; v_state public.linkedin_sequence_state%ROWTYPE; v_seq public.linkedin_sequences%ROWTYPE; v_message text;
BEGIN
  FOR r IN
    SELECT q.id probe_id,q.completed_at,q.result,q.account_id,
      j.id job_id,j.contact_id,j.sequence_id,j.company_id,j.action_payload,
      (j.action_payload->>'source_campaign_id')::uuid customer_campaign_id
    FROM public.browser_execution_queue q
    JOIN public.linkedin_execution_jobs j ON j.id=(q.action_params->>'connection_job_id')::uuid AND j.workspace_id=q.workspace_id
    JOIN public.customer_campaign_contacts ccc ON ccc.customer_campaign_id=(j.action_payload->>'source_campaign_id')::uuid
      AND ccc.contact_id=j.contact_id AND ccc.workspace_id=j.workspace_id
    JOIN public.customer_campaigns cc ON cc.id=ccc.customer_campaign_id AND cc.workspace_id=ccc.workspace_id
    WHERE q.workspace_id=p_workspace_id AND q.action_type='check_connection_acceptance' AND q.status='completed'
      AND public.normalize_linkedin_relationship_result(q.result)->>'accepted'='true'
      AND j.action_type='connection_request' AND j.status='completed'
      AND j.result_payload->>'result_code'='success' AND j.result_payload->>'write_verified'='true'
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)=false
      AND j.contact_id IS NOT NULL AND j.linkedin_account_id=q.account_id
  LOOP
    v_event:=NULL;
    INSERT INTO public.linkedin_connection_acceptance_events(workspace_id,customer_campaign_id,contact_id,linkedin_account_id,connection_job_id,probe_queue_id,normalized_evidence,observed_at)
    VALUES(p_workspace_id,r.customer_campaign_id,r.contact_id,r.account_id,r.job_id,r.probe_id,public.normalize_linkedin_relationship_result(r.result),coalesce(r.completed_at,now()))
    ON CONFLICT DO NOTHING RETURNING id INTO v_event;
    IF v_event IS NULL THEN CONTINUE; END IF;
    v_inserted:=v_inserted+1;
    INSERT INTO public.linkedin_daily_usage(workspace_id,linkedin_account_id,usage_date,connections_accepted,updated_at)
    VALUES(p_workspace_id,r.account_id,current_date,1,now())
    ON CONFLICT(linkedin_account_id,usage_date) DO UPDATE SET connections_accepted=public.linkedin_daily_usage.connections_accepted+1,updated_at=now();

    IF r.action_payload ? 'sequence_state_id' THEN
      SELECT * INTO v_state FROM public.linkedin_sequence_state WHERE id=(r.action_payload->>'sequence_state_id')::uuid AND workspace_id=p_workspace_id FOR UPDATE;
      SELECT * INTO v_seq FROM public.linkedin_sequences WHERE id=v_state.sequence_id AND workspace_id=p_workspace_id AND status='active';
      IF FOUND AND v_state.step_status NOT IN ('stopped','completed','cancelled','failed')
         AND EXISTS(SELECT 1 FROM public.customer_campaigns WHERE id=r.customer_campaign_id AND workspace_id=p_workspace_id AND status='running')
         AND NOT EXISTS(SELECT 1 FROM public.linkedin_inbound_replies WHERE workspace_id=p_workspace_id AND contact_id=r.contact_id AND match_status='matched') THEN
        v_message:=nullif(trim(coalesce(v_seq.sequence_steps->0->>'message',v_seq.sequence_steps->0->>'content',v_seq.sequence_steps->0->>'text','')),'');
        IF v_message IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.linkedin_execution_jobs WHERE workspace_id=p_workspace_id AND sequence_id=v_state.sequence_id AND contact_id=r.contact_id AND action_type='first_message') THEN
          INSERT INTO public.linkedin_execution_jobs(workspace_id,linkedin_account_id,company_id,contact_id,campaign_id,sequence_id,sequence_step,action_type,status,priority,scheduled_at,action_payload)
          VALUES(p_workspace_id,r.account_id,r.company_id,r.contact_id,v_seq.campaign_id,v_state.sequence_id,0,'first_message','queued',2,now(),jsonb_build_object('sequence_state_id',v_state.id,'message',v_message,'source_campaign_id',r.customer_campaign_id,'acceptance_event_id',v_event));
          UPDATE public.linkedin_sequence_state SET current_step=0,step_status='in_progress',next_action_at=NULL,updated_at=now() WHERE id=v_state.id;
          v_messages:=v_messages+1;
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('acceptance_events_inserted',v_inserted,'first_messages_queued',v_messages);
END $$;

-- Retain the existing conversation/follow-up reconciler, but add the canonical
-- exactly-once acceptance pass. Both are service-role worker operations.
CREATE OR REPLACE FUNCTION public.reconcile_linkedin_v1_pipeline(p_workspace_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_transitions jsonb; v_acceptance jsonb;
BEGIN
  v_transitions:=public.reconcile_linkedin_v1_pipeline_state_transitions(p_workspace_id);
  v_acceptance:=public.reconcile_linkedin_acceptance_events(p_workspace_id);
  RETURN jsonb_build_object('state_transitions',v_transitions,'acceptance',v_acceptance);
END $$;

CREATE OR REPLACE FUNCTION public.get_linkedin_v1_campaign_metrics(p_workspace_id uuid)
RETURNS TABLE(customer_campaign_id uuid,prospects bigint,prospects_contacted bigint,connections_sent bigint,connections_accepted bigint,messages_sent bigint,replies bigint,positive_replies bigint,qualified_leads bigint,meetings_booked bigint,controlled_writes_excluded bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT cc.id,
    (SELECT count(DISTINCT ccc.contact_id) FROM public.customer_campaign_contacts ccc WHERE ccc.workspace_id=p_workspace_id AND ccc.customer_campaign_id=cc.id),
    (SELECT count(DISTINCT j.contact_id) FROM public.linkedin_execution_jobs j WHERE j.workspace_id=p_workspace_id AND j.action_payload->>'source_campaign_id'=cc.id::text
      AND j.status='completed' AND j.result_payload->>'result_code'='success' AND j.result_payload->>'write_verified'='true' AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)=false),
    (SELECT count(DISTINCT j.contact_id) FROM public.linkedin_execution_jobs j WHERE j.workspace_id=p_workspace_id AND j.action_payload->>'source_campaign_id'=cc.id::text AND j.action_type='connection_request'
      AND j.status='completed' AND j.result_payload->>'result_code'='success' AND j.result_payload->>'write_verified'='true' AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)=false),
    (SELECT count(*) FROM public.linkedin_connection_acceptance_events ae WHERE ae.workspace_id=p_workspace_id AND ae.customer_campaign_id=cc.id),
    (SELECT count(*) FROM public.linkedin_messages m JOIN public.linkedin_conversations c ON c.id=m.conversation_id AND c.workspace_id=m.workspace_id
      WHERE m.workspace_id=p_workspace_id AND m.direction='outbound' AND coalesce(m.metadata->>'source_campaign_id',c.metadata->>'source_campaign_id')=cc.id::text
        AND coalesce((m.metadata->>'fixture')::boolean,false)=false),
    (SELECT count(*) FROM public.linkedin_inbound_replies ir WHERE ir.workspace_id=p_workspace_id AND ir.campaign_id=cc.id AND ir.match_status='matched' AND coalesce((ir.metadata->>'fixture')::boolean,false)=false),
    (SELECT count(*) FROM public.linkedin_inbound_replies ir WHERE ir.workspace_id=p_workspace_id AND ir.campaign_id=cc.id AND ir.match_status='matched'
      AND ir.classification IN ('positive','interested') AND coalesce((ir.metadata->>'fixture')::boolean,false)=false),
    (SELECT count(DISTINCT c.id) FROM public.linkedin_conversations c WHERE c.workspace_id=p_workspace_id AND c.stage='qualified' AND c.metadata->>'source_campaign_id'=cc.id::text AND coalesce((c.metadata->>'fixture')::boolean,false)=false),
    (SELECT count(*) FROM public.linkedin_meeting_confirmations mc WHERE mc.workspace_id=p_workspace_id AND mc.metadata->>'source_campaign_id'=cc.id::text AND coalesce((mc.metadata->>'fixture')::boolean,false)=false),
    (SELECT count(*) FROM public.linkedin_execution_jobs j WHERE j.workspace_id=p_workspace_id AND j.action_payload->>'source_campaign_id'=cc.id::text AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)=true
      AND j.status='completed' AND j.result_payload->>'write_verified'='true')
  FROM public.customer_campaigns cc WHERE cc.workspace_id=p_workspace_id
    AND (public.is_workspace_member(p_workspace_id) OR auth.role()='service_role');
$$;

REVOKE ALL ON FUNCTION public.normalize_linkedin_relationship_result(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reconcile_linkedin_acceptance_events(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reconcile_dormant_linkedin_sequence_states(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reconcile_linkedin_v1_pipeline(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_linkedin_v1_campaign_metrics(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.normalize_linkedin_relationship_result(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_linkedin_acceptance_events(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_dormant_linkedin_sequence_states(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_linkedin_v1_pipeline(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_linkedin_v1_campaign_metrics(uuid) TO authenticated,service_role;

COMMIT;
