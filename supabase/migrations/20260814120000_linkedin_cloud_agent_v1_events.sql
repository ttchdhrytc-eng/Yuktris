/* Cloud LinkedIn Agent V1: normalized meeting event using existing notification infrastructure. */

ALTER TABLE public.linkedin_notifications
  DROP CONSTRAINT IF EXISTS linkedin_notifications_notification_type_check;
ALTER TABLE public.linkedin_notifications
  ADD CONSTRAINT linkedin_notifications_notification_type_check CHECK (notification_type = ANY (ARRAY[
    'account_disconnected','daily_limit_reached','risk_score_increased','queue_completed',
    'execution_failure','reply_received','invitation_accepted','cooldown_started','warmup_progress',
    'meeting_booked'
  ]));
ALTER TABLE public.linkedin_notifications
  ADD COLUMN IF NOT EXISTS event_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.emit_linkedin_meeting_booked(
  p_workspace_id uuid,
  p_account_id uuid,
  p_prospect text,
  p_company text DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL,
  p_meeting_time timestamptz DEFAULT NULL,
  p_meeting_link text DEFAULT NULL,
  p_qualification_summary text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     AND NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'workspace access denied'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.linkedin_accounts a WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id) THEN
    RAISE EXCEPTION 'LinkedIn account not found';
  END IF;
  INSERT INTO public.linkedin_notifications(
    workspace_id,linkedin_account_id,notification_type,notification_title,notification_message,severity,action_url,event_payload
  ) VALUES (
    p_workspace_id,p_account_id,'meeting_booked','LinkedIn meeting booked',
    left(concat_ws(' · ',nullif(trim(p_prospect),''),nullif(trim(p_company),''),
      CASE WHEN p_meeting_time IS NOT NULL THEN p_meeting_time::text END,
      nullif(trim(p_qualification_summary),'')),1000),
    'success',CASE WHEN p_conversation_id IS NOT NULL THEN '/conversations/' || p_conversation_id::text ELSE NULL END,
    jsonb_strip_nulls(jsonb_build_object(
      'prospect',nullif(trim(p_prospect),''),'company',nullif(trim(p_company),''),
      'campaign_id',p_campaign_id,'linkedin_thread_id',p_conversation_id,
      'meeting_time',p_meeting_time,'meeting_link',nullif(trim(p_meeting_link),''),
      'qualification_summary',nullif(trim(p_qualification_summary),'')
    ))
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.emit_linkedin_meeting_booked(uuid,uuid,text,text,uuid,uuid,timestamptz,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_linkedin_meeting_booked(uuid,uuid,text,text,uuid,uuid,timestamptz,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_linkedin_context_execution_preferences(
  p_context_id uuid, p_workspace_id uuid, p_account_id uuid, p_preferences jsonb
) RETURNS SETOF public.linkedin_browser_contexts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'service role required'; END IF;
  IF jsonb_typeof(coalesce(p_preferences,'{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'invalid execution preferences'; END IF;
  UPDATE public.linkedin_browser_contexts c
    SET metadata=jsonb_set(c.metadata,'{execution_preferences}',coalesce(p_preferences,'{}'::jsonb),true),updated_at=now()
    WHERE c.id=p_context_id AND c.workspace_id=p_workspace_id AND c.account_id=p_account_id
      AND c.deleted_at IS NULL AND NOT (c.metadata ? 'execution_preferences');
  RETURN QUERY SELECT c.* FROM public.linkedin_browser_contexts c
    WHERE c.id=p_context_id AND c.workspace_id=p_workspace_id AND c.account_id=p_account_id AND c.deleted_at IS NULL;
END $$;

REVOKE ALL ON FUNCTION public.set_linkedin_context_execution_preferences(uuid,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_linkedin_context_execution_preferences(uuid,uuid,uuid,jsonb) TO service_role;
