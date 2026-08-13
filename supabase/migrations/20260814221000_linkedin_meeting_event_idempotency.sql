/* Make the normalized meeting fixture/event contract idempotent without external delivery. */
CREATE UNIQUE INDEX IF NOT EXISTS uq_linkedin_meeting_event_idempotency
ON public.linkedin_notifications(workspace_id,(event_payload->>'idempotency_key'))
WHERE notification_type='meeting_booked' AND event_payload ? 'idempotency_key';

DROP FUNCTION IF EXISTS public.emit_linkedin_meeting_booked(uuid,uuid,text,text,uuid,uuid,timestamptz,text,text);
CREATE FUNCTION public.emit_linkedin_meeting_booked(
  p_workspace_id uuid, p_account_id uuid, p_prospect text, p_company text DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL, p_conversation_id uuid DEFAULT NULL,
  p_meeting_time timestamptz DEFAULT NULL, p_meeting_link text DEFAULT NULL,
  p_qualification_summary text DEFAULT NULL, p_idempotency_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     AND NOT public.is_workspace_member(p_workspace_id) THEN RAISE EXCEPTION 'workspace access denied'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.linkedin_accounts a WHERE a.id=p_account_id AND a.workspace_id=p_workspace_id) THEN RAISE EXCEPTION 'LinkedIn account not found'; END IF;
  IF nullif(trim(p_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'meeting event idempotency key required'; END IF;
  SELECT id INTO v_id FROM public.linkedin_notifications WHERE workspace_id=p_workspace_id
    AND notification_type='meeting_booked' AND event_payload->>'idempotency_key'=trim(p_idempotency_key);
  IF FOUND THEN RETURN v_id; END IF;
  INSERT INTO public.linkedin_notifications(workspace_id,linkedin_account_id,notification_type,notification_title,
    notification_message,severity,action_url,event_payload)
  VALUES(p_workspace_id,p_account_id,'meeting_booked','LinkedIn meeting booked',
    left(concat_ws(' · ',nullif(trim(p_prospect),''),nullif(trim(p_company),''),
      CASE WHEN p_meeting_time IS NOT NULL THEN p_meeting_time::text END,nullif(trim(p_qualification_summary),'')),1000),
    'success',CASE WHEN p_conversation_id IS NOT NULL THEN '/conversations/'||p_conversation_id::text END,
    jsonb_strip_nulls(jsonb_build_object('idempotency_key',trim(p_idempotency_key),'prospect',nullif(trim(p_prospect),''),
      'company',nullif(trim(p_company),''),'campaign_id',p_campaign_id,'linkedin_thread_id',p_conversation_id,
      'meeting_time',p_meeting_time,'meeting_link',nullif(trim(p_meeting_link),''),
      'qualification_summary',nullif(trim(p_qualification_summary),''),'fixture',true))) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.emit_linkedin_meeting_booked(uuid,uuid,text,text,uuid,uuid,timestamptz,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.emit_linkedin_meeting_booked(uuid,uuid,text,text,uuid,uuid,timestamptz,text,text,text) TO authenticated,service_role;
