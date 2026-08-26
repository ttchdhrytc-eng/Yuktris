BEGIN;

CREATE OR REPLACE FUNCTION public.next_campaign_account_outreach_at(p_campaign_id uuid,p_account_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE; a public.linkedin_accounts%ROWTYPE; d timestamptz;
  campaign_local timestamp; account_local timestamp; campaign_days text[]; campaign_start time; campaign_end time;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=c.workspace_id;
  IF NOT FOUND OR c.linkedin_account_id IS DISTINCT FROM a.id OR nullif(trim(c.outreach_timezone),'') IS NULL OR nullif(trim(a.timezone),'') IS NULL
    OR cardinality(coalesce(a.working_days,'{}'))=0 OR a.working_hours_start IS NULL OR a.working_hours_end IS NULL
    OR a.working_hours_start::time>=a.working_hours_end::time THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=c.outreach_timezone) OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=a.timezone) THEN RETURN NULL; END IF;
  campaign_start:=(regexp_split_to_array(c.operating_hours,'[^0-9:]+'))[1]::time;
  campaign_end:=(regexp_split_to_array(c.operating_hours,'[^0-9:]+'))[2]::time;
  campaign_days:=public.campaign_operating_days(c.operating_days);
  IF campaign_start>=campaign_end OR cardinality(campaign_days)=0 THEN RETURN NULL; END IF;
  d:=date_trunc('minute',greatest(p_not_before,now()));
  FOR i IN 0..20160 LOOP
    campaign_local:=d AT TIME ZONE c.outreach_timezone; account_local:=d AT TIME ZONE a.timezone;
    IF lower(trim(to_char(campaign_local,'Day')))=ANY(campaign_days) AND campaign_local::time>=campaign_start AND campaign_local::time<campaign_end
      AND lower(trim(to_char(account_local,'Day')))=ANY(a.working_days) AND account_local::time>=a.working_hours_start::time AND account_local::time<a.working_hours_end::time THEN RETURN d; END IF;
    d:=d+interval '1 minute';
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN invalid_parameter_value OR datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.campaign_account_window_validation(p_campaign_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE; due timestamptz;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'code','campaign_not_found'); END IF;
  due:=public.next_campaign_account_outreach_at(c.id,c.linkedin_account_id,p_not_before);
  IF due IS NULL THEN RETURN jsonb_build_object('valid',false,'code','no_effective_sending_window','message','The campaign schedule does not overlap the selected LinkedIn account safety window.'); END IF;
  RETURN jsonb_build_object('valid',true,'code','valid','scheduled_at',due);
END $$;

WITH invalid_jobs AS (
  SELECT j.id FROM public.linkedin_execution_jobs j
  WHERE j.status IN ('queued','scheduled','pending') AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)
    AND public.next_campaign_account_outreach_at((j.action_payload->>'source_campaign_id')::uuid,j.linkedin_account_id,now()) IS NULL
), terminal_jobs AS (
  UPDATE public.linkedin_execution_jobs j SET status='failed',scheduled_at=NULL,completed_at=now(),error_message='no_effective_sending_window',updated_at=now()
  FROM invalid_jobs i WHERE j.id=i.id RETURNING j.id
), terminal_generations AS (
  UPDATE public.controlled_acceptance_generations g SET status='failed'
  FROM terminal_jobs j WHERE g.write_job_id=j.id AND g.status='write_prepared' RETURNING g.id,j.id AS job_id
)
INSERT INTO public.controlled_acceptance_generation_events(generation_id,event_type,evidence)
SELECT id,'write_blocked',jsonb_build_object('code','no_effective_sending_window','job_id',job_id) FROM terminal_generations;

REVOKE ALL ON FUNCTION public.next_campaign_account_outreach_at(uuid,uuid,timestamptz),public.campaign_account_window_validation(uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.next_campaign_account_outreach_at(uuid,uuid,timestamptz),public.campaign_account_window_validation(uuid,timestamptz) TO service_role;

COMMIT;
