/* Yuktris LinkedIn V1: identity repair + connection acceptance + sequence reconciliation. */
BEGIN;

-- Expand the existing contact lifecycle so the autonomous pipeline can persist
-- discovery, engagement and qualification without overloading unrelated fields.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_status_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_status_check CHECK (status = ANY (ARRAY[
  'researched'::text,'saved'::text,'ignored'::text,'discovered'::text,
  'engaged'::text,'qualified'::text,'disqualified'::text
]));

-- Service-role-only repair path for a persistent Context that has proven a different
-- authenticated self profile than a stale account binding. The exact Context generation
-- is required and a profile already bound to another workspace account is rejected.
CREATE OR REPLACE FUNCTION public.repair_linkedin_account_identity_from_context(
  p_context_id uuid,
  p_workspace_id uuid,
  p_account_id uuid,
  p_provider_context_id text,
  p_context_generation integer,
  p_canonical_profile_url text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_profile text;
BEGIN
  v_profile := public.linkedin_canonical_profile_url(p_canonical_profile_url);
  IF v_profile IS NULL THEN RAISE EXCEPTION 'invalid authenticated LinkedIn profile'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.linkedin_browser_contexts c
    WHERE c.id=p_context_id AND c.workspace_id=p_workspace_id AND c.account_id=p_account_id
      AND c.provider_context_id=p_provider_context_id AND c.generation=p_context_generation
      AND c.status IN ('active','in_use') AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'exact active Context generation required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.linkedin_accounts a
    WHERE a.workspace_id=p_workspace_id AND a.id<>p_account_id
      AND public.linkedin_canonical_profile_url(coalesce(a.expected_profile_url,a.profile_url))=v_profile
  ) THEN
    RAISE EXCEPTION 'authenticated LinkedIn profile is already bound to another account';
  END IF;

  UPDATE public.linkedin_browser_contexts
  SET metadata = CASE
      WHEN metadata ? 'identity_attestation'
      THEN jsonb_set(metadata,'{identity_attestation,status}','"revoked"'::jsonb,true)
      ELSE metadata
    END,
    updated_at=now()
  WHERE workspace_id=p_workspace_id AND account_id=p_account_id AND id<>p_context_id;

  UPDATE public.linkedin_accounts
  SET expected_profile_url=v_profile,
      profile_url=v_profile,
      last_error=NULL,
      connection_state='connected',
      connection_status='active',
      status='connected',
      session_status='connected',
      updated_at=now()
  WHERE id=p_account_id AND workspace_id=p_workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LinkedIn account not found in workspace'; END IF;

  INSERT INTO public.linkedin_session_events(workspace_id,account_id,event_type,event_data)
  VALUES(p_workspace_id,p_account_id,'refreshed',jsonb_build_object(
    'action','identity_repaired_from_authenticated_context',
    'canonical_profile_url',v_profile,
    'context_id',p_context_id,
    'context_generation',p_context_generation
  ));
END $$;

REVOKE ALL ON FUNCTION public.repair_linkedin_account_identity_from_context(uuid,uuid,uuid,text,integer,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.repair_linkedin_account_identity_from_context(uuid,uuid,uuid,text,integer,text)
  TO service_role;

-- Reconcile execution jobs with browser-only acceptance probes and LinkedIn sequences.
CREATE OR REPLACE FUNCTION public.reconcile_linkedin_v1_pipeline(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  r record;
  v_state public.linkedin_sequence_state%ROWTYPE;
  v_sequence public.linkedin_sequences%ROWTYPE;
  v_step jsonb;
  v_message text;
  v_job uuid;
  v_conversation uuid;
  v_checks integer := 0;
  v_first_messages integer := 0;
  v_advanced integer := 0;
  v_conversations integer := 0;
  v_bucket bigint := floor(extract(epoch from now())/21600); -- six-hour bucket
BEGIN
  -- Completed connection requests get a read-only acceptance probe. Do not guess
  -- acceptance and do not send a first message until the profile shows a connected state.
  FOR r IN
    SELECT j.id job_id,j.linkedin_account_id,j.contact_id,j.company_id,j.sequence_id,
           j.action_payload,j.completed_at,c.linkedin_url
    FROM public.linkedin_execution_jobs j
    JOIN public.contacts c ON c.id=j.contact_id AND c.workspace_id=j.workspace_id
    WHERE j.workspace_id=p_workspace_id AND j.action_type='connection_request' AND j.status='completed'
      AND j.action_payload ? 'sequence_state_id'
      AND c.linkedin_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.linkedin_execution_jobs fm
        WHERE fm.workspace_id=j.workspace_id AND fm.contact_id=j.contact_id
          AND fm.sequence_id=j.sequence_id AND fm.action_type='first_message'
      )
  LOOP
    INSERT INTO public.browser_execution_queue(
      workspace_id,account_id,action_type,action_params,priority,priority_label,status,scheduled_at,idempotency_key
    ) VALUES (
      p_workspace_id,r.linkedin_account_id,'check_connection_acceptance',
      jsonb_build_object(
        'connection_job_id',r.job_id,
        'contact_id',r.contact_id,
        'company_id',r.company_id,
        'sequence_id',r.sequence_id,
        'sequence_state_id',r.action_payload->>'sequence_state_id',
        'profile_url',r.linkedin_url
      ),3,'medium','pending',now(),
      'acceptance-check:'||r.job_id::text||':'||v_bucket::text
    )
    ON CONFLICT(workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    IF FOUND THEN v_checks:=v_checks+1; END IF;
  END LOOP;

  -- A positive acceptance probe unlocks the first LinkedIn message.
  FOR r IN
    SELECT q.*
    FROM public.browser_execution_queue q
    WHERE q.workspace_id=p_workspace_id AND q.action_type='check_connection_acceptance'
      AND q.status='completed'
      AND coalesce((q.result->'data'->>'accepted')::boolean,false)=true
  LOOP
    SELECT * INTO v_state FROM public.linkedin_sequence_state
    WHERE id=(r.action_params->>'sequence_state_id')::uuid AND workspace_id=p_workspace_id
    FOR UPDATE;
    IF NOT FOUND OR v_state.step_status IN ('stopped','completed') THEN CONTINUE; END IF;

    SELECT * INTO v_sequence FROM public.linkedin_sequences
    WHERE id=v_state.sequence_id AND workspace_id=p_workspace_id AND status='active';
    IF NOT FOUND THEN CONTINUE; END IF;

    v_step := v_sequence.sequence_steps->0;
    v_message := nullif(trim(coalesce(v_step->>'message',v_step->>'content',v_step->>'text','')), '');
    IF v_message IS NULL THEN CONTINUE; END IF;

    v_job := NULL;
    SELECT id INTO v_job FROM public.linkedin_execution_jobs
    WHERE workspace_id=p_workspace_id AND sequence_id=v_state.sequence_id AND contact_id=v_state.contact_id
      AND action_type='first_message' LIMIT 1;
    IF v_job IS NULL THEN
      INSERT INTO public.linkedin_execution_jobs(
        workspace_id,linkedin_account_id,company_id,contact_id,campaign_id,sequence_id,sequence_step,
        action_type,status,priority,scheduled_at,action_payload
      ) VALUES (
        p_workspace_id,v_state.linkedin_account_id,v_state.company_id,v_state.contact_id,v_sequence.campaign_id,
        v_state.sequence_id,0,'first_message','queued',2,now(),
        jsonb_build_object('sequence_state_id',v_state.id,'message',v_message)
      ) RETURNING id INTO v_job;
      UPDATE public.linkedin_sequence_state
      SET current_step=0,step_status='in_progress',next_action_at=NULL,updated_at=now()
      WHERE id=v_state.id;
      v_first_messages:=v_first_messages+1;
    END IF;
  END LOOP;

  -- Completed outbound messages create/update the tracked conversation and advance
  -- the sequence to the next due step. The existing follow-up RPC then queues it.
  FOR r IN
    SELECT j.*,ct.first_name,ct.last_name,ct.full_name,ct.linkedin_url,ct.job_title,
           co.name company_name
    FROM public.linkedin_execution_jobs j
    JOIN public.contacts ct ON ct.id=j.contact_id AND ct.workspace_id=j.workspace_id
    LEFT JOIN public.companies co ON co.id=j.company_id
    WHERE j.workspace_id=p_workspace_id AND j.status='completed'
      AND j.action_type IN ('first_message','follow_up_message')
      AND j.action_payload ? 'sequence_state_id'
  LOOP
    SELECT id INTO v_conversation FROM public.linkedin_conversations
    WHERE workspace_id=p_workspace_id AND account_id=r.linkedin_account_id
      AND prospect_profile_url=r.linkedin_url
    ORDER BY created_at DESC LIMIT 1;

    IF v_conversation IS NULL THEN
      INSERT INTO public.linkedin_conversations(
        workspace_id,account_id,prospect_name,prospect_profile_url,prospect_company,prospect_title,
        stage,health,last_message_at,last_message_preview,last_message_direction,total_messages,ai_enabled,auto_reply_enabled,
        metadata
      ) VALUES (
        p_workspace_id,r.linkedin_account_id,
        coalesce(r.full_name,trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,''))),
        r.linkedin_url,r.company_name,r.job_title,'initial','active',r.completed_at,
        left(coalesce(r.action_payload->>'message',''),200),'outbound',1,true,true,
        jsonb_build_object('contact_id',r.contact_id,'company_id',r.company_id,'sequence_id',r.sequence_id)
      ) RETURNING id INTO v_conversation;
      v_conversations:=v_conversations+1;
    ELSE
      UPDATE public.linkedin_conversations
      SET last_message_at=r.completed_at,last_message_preview=left(coalesce(r.action_payload->>'message',''),200),
          last_message_direction='outbound',total_messages=total_messages+1,updated_at=now()
      WHERE id=v_conversation;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.linkedin_messages m
      WHERE m.conversation_id=v_conversation AND m.metadata->>'execution_job_id'=r.id::text
    ) THEN
      INSERT INTO public.linkedin_messages(
        workspace_id,conversation_id,account_id,direction,message_type,body,ai_generated,approved,sent_at,metadata
      ) VALUES (
        p_workspace_id,v_conversation,r.linkedin_account_id,'outbound','text',
        coalesce(r.action_payload->>'message',''),true,true,r.completed_at,
        jsonb_build_object('execution_job_id',r.id,'sequence_step',r.sequence_step)
      );
    END IF;

    SELECT * INTO v_state FROM public.linkedin_sequence_state
    WHERE id=(r.action_payload->>'sequence_state_id')::uuid AND workspace_id=p_workspace_id FOR UPDATE;
    IF NOT FOUND OR v_state.step_status='stopped' OR v_state.current_step<>r.sequence_step THEN CONTINUE; END IF;
    SELECT * INTO v_sequence FROM public.linkedin_sequences WHERE id=v_state.sequence_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF r.sequence_step + 1 >= jsonb_array_length(v_sequence.sequence_steps) THEN
      UPDATE public.linkedin_sequence_state SET step_status='completed',completed_at=now(),next_action_at=NULL,updated_at=now()
      WHERE id=v_state.id;
    ELSE
      v_step := v_sequence.sequence_steps->(r.sequence_step+1);
      UPDATE public.linkedin_sequence_state
      SET current_step=r.sequence_step+1,step_status='pending',
          next_action_at=now()+make_interval(hours=>greatest(1,coalesce((v_step->>'delay_hours')::integer,72))),
          updated_at=now()
      WHERE id=v_state.id;
    END IF;
    v_advanced:=v_advanced+1;
  END LOOP;

  RETURN jsonb_build_object(
    'acceptance_checks_queued',v_checks,
    'first_messages_queued',v_first_messages,
    'sequences_advanced',v_advanced,
    'conversations_created',v_conversations
  );
END $$;

REVOKE ALL ON FUNCTION public.reconcile_linkedin_v1_pipeline(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_linkedin_v1_pipeline(uuid) TO service_role;

COMMIT;
