BEGIN;

/*
 * Customer campaigns are the only scheduling authority. LinkedIn-account
 * timezone/working-hour fields remain descriptive account metadata and are
 * deliberately not consulted by any scheduling function.
 */
CREATE OR REPLACE FUNCTION public.next_campaign_account_outreach_at(
  p_campaign_id uuid,
  p_account_id uuid,
  p_not_before timestamptz DEFAULT now()
) RETURNS timestamptz
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.customer_campaigns c
      WHERE c.id=p_campaign_id AND c.linkedin_account_id=p_account_id
    ) THEN public.next_campaign_outreach_at(p_campaign_id,p_not_before)
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.campaign_window_validation(
  p_campaign_id uuid,
  p_not_before timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE; due timestamptz;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'code','campaign_not_found'); END IF;
  due:=public.next_campaign_outreach_at(c.id,p_not_before);
  IF due IS NULL THEN
    RETURN jsonb_build_object(
      'valid',false,
      'code','invalid_campaign_schedule',
      'message','Choose at least one sending day, valid hours, and an IANA timezone.'
    );
  END IF;
  RETURN jsonb_build_object('valid',true,'code','valid','scheduled_at',due);
END $$;

/* Backward-compatible RPC name; semantics are campaign-only. */
CREATE OR REPLACE FUNCTION public.campaign_account_window_validation(
  p_campaign_id uuid,
  p_not_before timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT public.campaign_window_validation(p_campaign_id,p_not_before)
$$;

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
  IF q.status='failed' OR coalesce(evidence->>'result_code','')<>'success' THEN g.status:='outcome_unknown';
  ELSIF coalesce(evidence->>'relationship_classification','')='invitation_pending' OR coalesce((evidence->>'pending')::boolean,false) THEN g.status:='pending';
  ELSIF coalesce(evidence->>'relationship_classification','')='already_connected' OR coalesce((evidence->>'accepted')::boolean,false) OR coalesce((evidence->>'first_degree')::boolean,false) THEN g.status:='connected';
  ELSIF coalesce(evidence->>'relationship_classification','')='eligible_for_connection_request' AND coalesce((evidence->>'connect_available')::boolean,false) THEN g.status:='eligible';
  ELSE g.status:='outcome_unknown'; END IF;
  UPDATE public.controlled_acceptance_generations SET status=g.status,relationship_evidence=evidence WHERE id=g.id;
  INSERT INTO public.controlled_acceptance_generation_events(generation_id,event_type,evidence) VALUES(g.id,'relationship_classified',jsonb_build_object('classification',g.status,'evidence',evidence));
  IF g.status<>'eligible' THEN RETURN jsonb_build_object('generation_id',g.id,'status',g.status,'write_performed',false); END IF;
  next_at:=public.next_campaign_outreach_at(g.campaign_id,now());
  IF next_at IS NULL THEN UPDATE public.controlled_acceptance_generations SET status='failed' WHERE id=g.id; RETURN jsonb_build_object('generation_id',g.id,'status','failed','code','invalid_campaign_schedule'); END IF;
  INSERT INTO public.linkedin_execution_jobs(workspace_id,linkedin_account_id,contact_id,action_type,status,priority,scheduled_at,sequence_step,max_retries,action_payload)
  VALUES(g.workspace_id,g.linkedin_account_id,g.contact_id,'connection_request','scheduled',1,next_at,-1,0,jsonb_build_object(
    'source_campaign_id',g.campaign_id,'profile_url',g.target_identifier,'acceptance_test_mode',true,'acceptance_generation_id',g.id,
    'idempotency_namespace',g.idempotency_namespace,'human_initiated',true,'human_initiated_by',p_actor)) RETURNING * INTO j;
  UPDATE public.controlled_acceptance_generations SET status='write_prepared',write_job_id=j.id WHERE id=g.id;
  INSERT INTO public.controlled_acceptance_generation_events(generation_id,event_type,evidence) VALUES(g.id,'write_prepared',jsonb_build_object('job_id',j.id,'scheduled_at',next_at));
  RETURN jsonb_build_object('generation_id',g.id,'status','write_prepared','write_job_id',j.id,'scheduled_at',next_at,'write_performed',false);
END $$;

REVOKE ALL ON FUNCTION public.next_campaign_account_outreach_at(uuid,uuid,timestamptz),public.campaign_window_validation(uuid,timestamptz),public.campaign_account_window_validation(uuid,timestamptz),public.advance_controlled_acceptance_generation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.next_campaign_account_outreach_at(uuid,uuid,timestamptz),public.campaign_window_validation(uuid,timestamptz),public.campaign_account_window_validation(uuid,timestamptz),public.advance_controlled_acceptance_generation(uuid,uuid) TO service_role;

COMMIT;
