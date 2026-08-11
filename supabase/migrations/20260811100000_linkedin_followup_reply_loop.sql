-- Minimum private-beta follow-up and inbound-reply loop.
BEGIN;

ALTER TABLE public.contacts
  ADD COLUMN linkedin_reply_status text,
  ADD COLUMN linkedin_reply_classification text,
  ADD COLUMN linkedin_last_reply_at timestamptz;

CREATE TABLE public.linkedin_inbound_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  external_reply_id text NOT NULL,
  conversation_id uuid REFERENCES public.linkedin_conversations(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id uuid,
  sequence_id uuid REFERENCES public.linkedin_sequences(id) ON DELETE SET NULL,
  sender_name text,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  received_at timestamptz NOT NULL,
  classification text NOT NULL DEFAULT 'unknown' CHECK (classification IN
    ('positive','interested','neutral','objection','not_interested','wrong_person','do_not_contact','unknown')),
  classification_confidence numeric NOT NULL DEFAULT 0 CHECK (classification_confidence BETWEEN 0 AND 1),
  classification_status text NOT NULL CHECK (classification_status IN ('classified','manual_review')),
  match_status text NOT NULL CHECK (match_status IN ('matched','manual_review')),
  manual_review_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (linkedin_account_id, external_reply_id)
);

CREATE TABLE public.linkedin_followup_scheduler_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sequence_state_id uuid NOT NULL REFERENCES public.linkedin_sequence_state(id) ON DELETE CASCADE,
  sequence_step integer NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('queued','skipped','blocked')),
  reason text,
  execution_job_id uuid REFERENCES public.linkedin_execution_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_linkedin_followup_job_step
ON public.linkedin_execution_jobs ((action_payload->>'sequence_state_id'), sequence_step)
WHERE action_type='follow_up_message' AND action_payload ? 'sequence_state_id';
CREATE INDEX idx_linkedin_replies_workspace_received ON public.linkedin_inbound_replies(workspace_id, received_at DESC);
CREATE INDEX idx_linkedin_replies_manual_review ON public.linkedin_inbound_replies(workspace_id, match_status) WHERE match_status='manual_review';
CREATE UNIQUE INDEX uq_linkedin_messages_external_urn ON public.linkedin_messages(account_id,linkedin_message_urn)
WHERE linkedin_message_urn IS NOT NULL;

ALTER TABLE public.linkedin_inbound_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_followup_scheduler_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY linkedin_replies_member_select ON public.linkedin_inbound_replies FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY linkedin_scheduler_events_member_select ON public.linkedin_followup_scheduler_events FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_inbound_replies, public.linkedin_followup_scheduler_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.linkedin_inbound_replies, public.linkedin_followup_scheduler_events TO authenticated;
GRANT ALL ON public.linkedin_inbound_replies, public.linkedin_followup_scheduler_events TO service_role;

CREATE FUNCTION public.schedule_due_linkedin_followups(p_workspace_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(sequence_state_id uuid, outcome text, execution_job_id uuid, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; v_step jsonb; v_message text; v_job uuid;
BEGIN
  FOR r IN
    SELECT ss.*, s.campaign_id, s.sequence_steps
    FROM public.linkedin_sequence_state ss
    JOIN public.linkedin_sequences s ON s.id=ss.sequence_id AND s.workspace_id=ss.workspace_id
    JOIN public.linkedin_accounts a ON a.id=ss.linkedin_account_id AND a.workspace_id=ss.workspace_id
    WHERE ss.workspace_id=p_workspace_id AND ss.step_status='pending' AND ss.next_action_at IS NOT NULL AND ss.next_action_at<=now()
      AND s.status='active' AND a.connection_state='connected' AND a.connection_status IN ('active','warming_up')
      AND EXISTS (SELECT 1 FROM public.linkedin_sessions ls WHERE ls.account_id=a.id AND ls.workspace_id=a.workspace_id
        AND ls.status='active' AND ls.authenticated AND ls.health_status='healthy'
        AND (ls.expires_at IS NULL OR ls.expires_at>now()))
      AND NOT EXISTS (SELECT 1 FROM public.linkedin_inbound_replies ir WHERE ir.workspace_id=ss.workspace_id
        AND ir.contact_id=ss.contact_id AND ir.match_status='matched')
    ORDER BY ss.next_action_at,ss.id FOR UPDATE OF ss SKIP LOCKED LIMIT greatest(1,least(p_limit,200))
  LOOP
    v_step := r.sequence_steps->r.current_step;
    v_message := nullif(trim(coalesce(v_step->>'message',v_step->>'content',v_step->>'text','')), '');
    IF v_message IS NULL THEN
      INSERT INTO public.linkedin_followup_scheduler_events(workspace_id,sequence_state_id,sequence_step,outcome,reason)
      VALUES(r.workspace_id,r.id,r.current_step,'blocked','Sequence step has no message');
      sequence_state_id:=r.id; outcome:='blocked'; execution_job_id:=NULL; reason:='Sequence step has no message'; RETURN NEXT; CONTINUE;
    END IF;
    INSERT INTO public.linkedin_execution_jobs(workspace_id,linkedin_account_id,company_id,contact_id,campaign_id,sequence_id,
      sequence_step,action_type,status,priority,scheduled_at,action_payload)
    VALUES(r.workspace_id,r.linkedin_account_id,r.company_id,r.contact_id,r.campaign_id,r.sequence_id,r.current_step,
      'follow_up_message','queued',2,now(),jsonb_build_object('sequence_state_id',r.id,'message',v_message))
    ON CONFLICT ((action_payload->>'sequence_state_id'),sequence_step)
      WHERE action_type='follow_up_message' AND action_payload ? 'sequence_state_id' DO NOTHING RETURNING id INTO v_job;
    IF v_job IS NULL THEN
      sequence_state_id:=r.id; outcome:='skipped'; execution_job_id:=NULL; reason:='Already scheduled'; RETURN NEXT;
    ELSE
      UPDATE public.linkedin_sequence_state SET step_status='in_progress',updated_at=now() WHERE id=r.id AND step_status='pending';
      INSERT INTO public.linkedin_followup_scheduler_events(workspace_id,sequence_state_id,sequence_step,outcome,execution_job_id)
      VALUES(r.workspace_id,r.id,r.current_step,'queued',v_job);
      sequence_state_id:=r.id; outcome:='queued'; execution_job_id:=v_job; reason:=NULL; RETURN NEXT;
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.ingest_linkedin_reply(
  p_workspace_id uuid,p_account_id uuid,p_external_reply_id text,p_body text,p_received_at timestamptz,
  p_sender_name text DEFAULT NULL,p_conversation_id uuid DEFAULT NULL,p_contact_id uuid DEFAULT NULL,
  p_sequence_id uuid DEFAULT NULL,p_campaign_id uuid DEFAULT NULL,p_classification text DEFAULT 'unknown',
  p_confidence numeric DEFAULT 0,p_manual_reason text DEFAULT NULL
) RETURNS public.linkedin_inbound_replies
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_reply public.linkedin_inbound_replies; v_match boolean; v_message uuid; v_class text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=p_workspace_id) THEN
    RAISE EXCEPTION 'account/workspace mismatch';
  END IF;
  v_match := p_conversation_id IS NOT NULL AND p_contact_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM public.linkedin_conversations WHERE id=p_conversation_id AND workspace_id=p_workspace_id AND account_id=p_account_id)
    AND EXISTS(SELECT 1 FROM public.contacts WHERE id=p_contact_id AND workspace_id=p_workspace_id)
    AND (p_sequence_id IS NULL OR EXISTS(SELECT 1 FROM public.linkedin_sequence_state WHERE sequence_id=p_sequence_id AND contact_id=p_contact_id AND workspace_id=p_workspace_id));
  v_class := CASE WHEN p_classification IN ('positive','interested','neutral','objection','not_interested','wrong_person','do_not_contact','unknown')
    THEN p_classification ELSE 'unknown' END;
  SELECT * INTO v_reply FROM public.linkedin_inbound_replies
    WHERE linkedin_account_id=p_account_id AND external_reply_id=p_external_reply_id;
  IF FOUND THEN RETURN v_reply; END IF;
  INSERT INTO public.linkedin_inbound_replies(workspace_id,linkedin_account_id,external_reply_id,conversation_id,contact_id,
    campaign_id,sequence_id,sender_name,body,received_at,classification,classification_confidence,classification_status,match_status,manual_review_reason)
  VALUES(p_workspace_id,p_account_id,p_external_reply_id,CASE WHEN v_match THEN p_conversation_id END,CASE WHEN v_match THEN p_contact_id END,
    CASE WHEN v_match THEN p_campaign_id END,CASE WHEN v_match THEN p_sequence_id END,p_sender_name,left(p_body,10000),p_received_at,
    v_class,greatest(0,least(coalesce(p_confidence,0),1)),CASE WHEN v_class='unknown' THEN 'manual_review' ELSE 'classified' END,CASE WHEN v_match THEN 'matched' ELSE 'manual_review' END,
    CASE WHEN v_match THEN CASE WHEN v_class='unknown' THEN coalesce(p_manual_reason,'Classification requires review') END ELSE coalesce(p_manual_reason,'Ambiguous conversation/prospect match') END)
  ON CONFLICT(linkedin_account_id,external_reply_id) DO NOTHING RETURNING * INTO v_reply;
  IF v_reply.id IS NULL THEN
    SELECT * INTO v_reply FROM public.linkedin_inbound_replies WHERE linkedin_account_id=p_account_id AND external_reply_id=p_external_reply_id;
    RETURN v_reply;
  END IF;
  IF NOT v_match OR v_reply.match_status<>'matched' THEN RETURN v_reply; END IF;

  INSERT INTO public.linkedin_messages(workspace_id,conversation_id,account_id,direction,body,sender_name,linkedin_message_urn,read_at,sent_at,metadata)
  VALUES(p_workspace_id,p_conversation_id,p_account_id,'inbound',left(p_body,10000),p_sender_name,p_external_reply_id,now(),p_received_at,
    jsonb_build_object('reply_ingestion_id',v_reply.id,'classification',v_class))
  ON CONFLICT (account_id,linkedin_message_urn) WHERE linkedin_message_urn IS NOT NULL DO NOTHING RETURNING id INTO v_message;
  UPDATE public.linkedin_sequence_state SET step_status='stopped',stopped_reason='prospect_replied',completed_at=coalesce(completed_at,now()),updated_at=now()
    WHERE workspace_id=p_workspace_id AND contact_id=p_contact_id AND step_status IN ('pending','in_progress');
  UPDATE public.linkedin_execution_jobs SET status='cancelled',completed_at=now(),error_message='Cancelled: prospect replied',updated_at=now()
    WHERE workspace_id=p_workspace_id AND contact_id=p_contact_id AND action_type='follow_up_message' AND status IN ('queued','scheduled','paused');
  UPDATE public.browser_execution_queue q SET status='cancelled',completed_at=now(),error='Cancelled: prospect replied',updated_at=now()
    WHERE q.workspace_id=p_workspace_id AND q.action_type='follow_up_message' AND q.status IN ('pending','retry','waiting')
      AND coalesce(q.action_params->>'job_id','') ~ '^[0-9a-fA-F-]{36}$'
      AND EXISTS (SELECT 1 FROM public.linkedin_execution_jobs j WHERE j.id=(q.action_params->>'job_id')::uuid
        AND j.workspace_id=p_workspace_id AND j.contact_id=p_contact_id AND j.status='cancelled');
  UPDATE public.linkedin_conversations SET stage=CASE WHEN v_class IN ('positive','interested') THEN 'qualified' WHEN v_class IN ('not_interested','do_not_contact','wrong_person') THEN 'closed' ELSE 'replied' END,
    health=CASE WHEN v_class IN ('not_interested','do_not_contact') THEN 'inactive' ELSE 'active' END,last_message_at=p_received_at,
    last_message_preview=left(p_body,200),last_message_direction='inbound',unread_count=unread_count+1,total_messages=total_messages+1,
    metadata=metadata||jsonb_build_object('reply_classification',v_class,'reply_ingestion_id',v_reply.id),updated_at=now() WHERE id=p_conversation_id AND workspace_id=p_workspace_id;
  UPDATE public.contacts SET linkedin_reply_status=CASE WHEN v_class IN ('not_interested','do_not_contact','wrong_person') THEN 'terminal' WHEN v_class='unknown' THEN 'manual_review' ELSE 'replied' END,
    linkedin_reply_classification=v_class,linkedin_last_reply_at=p_received_at,updated_at=now()
    WHERE id=p_contact_id AND workspace_id=p_workspace_id;
  INSERT INTO public.linkedin_conversation_intents(workspace_id,conversation_id,message_id,detected_intent,intent_category,confidence,metadata)
    VALUES(p_workspace_id,p_conversation_id,v_message,v_class,v_class,greatest(0,least(coalesce(p_confidence,0),1)),jsonb_build_object('reply_ingestion_id',v_reply.id));
  INSERT INTO public.linkedin_notifications(workspace_id,linkedin_account_id,notification_type,notification_title,notification_message,severity,action_url)
    VALUES(p_workspace_id,p_account_id,'reply_received',CASE WHEN v_class IN ('positive','interested') THEN 'Interested LinkedIn reply' ELSE 'LinkedIn reply received' END,
      CASE WHEN v_class IN ('positive','interested') THEN 'Review and qualify this response.' WHEN v_class='unknown' THEN 'Reply needs manual classification.' ELSE 'Review the latest response.' END,
      CASE WHEN v_class IN ('positive','interested') THEN 'success' WHEN v_class='unknown' THEN 'warning' ELSE 'info' END,'/linkedin/inbox');
  RETURN v_reply;
END $$;

CREATE FUNCTION public.schedule_linkedin_reply_checks(p_workspace_id uuid,p_limit integer DEFAULT 50)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r record; v_count integer:=0; v_bucket bigint:=floor(extract(epoch from now())/300);
BEGIN
  FOR r IN
    SELECT c.id conversation_id,c.account_id,c.prospect_name,ct.id contact_id,ss.sequence_id,s.campaign_id
    FROM public.linkedin_conversations c
    JOIN public.linkedin_accounts a ON a.id=c.account_id AND a.workspace_id=c.workspace_id
    JOIN LATERAL (SELECT (array_agg(x.id))[1] id,count(*) n FROM public.contacts x
      WHERE x.workspace_id=c.workspace_id AND x.linkedin_url=c.prospect_profile_url) cm ON cm.n=1
    JOIN public.contacts ct ON ct.id=cm.id
    LEFT JOIN LATERAL (SELECT z.* FROM public.linkedin_sequence_state z WHERE z.workspace_id=c.workspace_id
      AND z.contact_id=ct.id AND z.step_status IN ('pending','in_progress') ORDER BY z.updated_at DESC LIMIT 1) ss ON true
    LEFT JOIN public.linkedin_sequences s ON s.id=ss.sequence_id
    WHERE c.workspace_id=p_workspace_id AND c.health='active'
      AND a.connection_state='connected' AND a.connection_status IN ('active','warming_up')
      AND EXISTS (SELECT 1 FROM public.linkedin_sessions ls WHERE ls.account_id=a.id AND ls.workspace_id=a.workspace_id
        AND ls.status='active' AND ls.authenticated AND ls.health_status='healthy' AND (ls.expires_at IS NULL OR ls.expires_at>now()))
    ORDER BY c.last_message_at DESC NULLS LAST,c.id LIMIT greatest(1,least(p_limit,200))
  LOOP
    INSERT INTO public.browser_execution_queue(workspace_id,account_id,action_type,action_params,priority,priority_label,status,idempotency_key)
    VALUES(p_workspace_id,r.account_id,'read_replies',jsonb_build_object('conversation_id',r.conversation_id,'contact_id',r.contact_id,
      'sequence_id',r.sequence_id,'campaign_id',r.campaign_id,'prospect_name',r.prospect_name),3,'medium','pending',
      'reply-check:'||r.conversation_id::text||':'||v_bucket::text)
    ON CONFLICT(workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    IF FOUND THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.schedule_due_linkedin_followups(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ingest_linkedin_reply(uuid,uuid,text,text,timestamptz,text,uuid,uuid,uuid,uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.schedule_linkedin_reply_checks(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_due_linkedin_followups(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ingest_linkedin_reply(uuid,uuid,text,text,timestamptz,text,uuid,uuid,uuid,uuid,text,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.schedule_linkedin_reply_checks(uuid,integer) TO service_role;
COMMIT;
