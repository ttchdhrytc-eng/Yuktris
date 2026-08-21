BEGIN;

/*
 * The customer campaign is the authoritative schedule. The selected LinkedIn
 * account is an additional safety restriction. All scheduling therefore uses
 * the intersection, while preflight_linkedin_write continues to enforce the
 * account restriction independently immediately before a write.
 */
CREATE OR REPLACE FUNCTION public.next_campaign_account_outreach_at(
  p_campaign_id uuid,
  p_account_id uuid,
  p_not_before timestamptz DEFAULT now()
) RETURNS timestamptz
LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public AS $$
DECLARE
  c public.customer_campaigns%ROWTYPE;
  a public.linkedin_accounts%ROWTYPE;
  d timestamptz;
  campaign_local timestamp;
  account_local timestamp;
  campaign_day text;
  account_day text;
  campaign_start time;
  campaign_end time;
  campaign_days text[];
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  SELECT * INTO a FROM public.linkedin_accounts WHERE id=p_account_id AND workspace_id=c.workspace_id;
  IF NOT FOUND OR c.linkedin_account_id IS DISTINCT FROM a.id
     OR nullif(trim(c.outreach_timezone),'') IS NULL
     OR nullif(trim(a.timezone),'') IS NULL
     OR cardinality(coalesce(a.working_days,'{}'))=0
     OR a.working_hours_start IS NULL OR a.working_hours_end IS NULL
     OR a.working_hours_start::time>=a.working_hours_end::time THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=c.outreach_timezone)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=a.timezone) THEN
    RETURN NULL;
  END IF;

  campaign_start:=split_part(replace(c.operating_hours,'–','-'),'-',1)::time;
  campaign_end:=split_part(replace(c.operating_hours,'–','-'),'-',2)::time;
  IF campaign_start>=campaign_end THEN RETURN NULL; END IF;
  campaign_days:=CASE lower(trim(c.operating_days))
    WHEN 'monday–friday' THEN ARRAY['monday','tuesday','wednesday','thursday','friday']
    WHEN 'monday-friday' THEN ARRAY['monday','tuesday','wednesday','thursday','friday']
    ELSE regexp_split_to_array(lower(replace(c.operating_days,' ','')),',')
  END;

  d:=date_trunc('minute',greatest(p_not_before,now()));
  FOR i IN 0..20160 LOOP
    campaign_local:=d AT TIME ZONE c.outreach_timezone;
    account_local:=d AT TIME ZONE a.timezone;
    campaign_day:=lower(trim(to_char(campaign_local,'Day')));
    account_day:=lower(trim(to_char(account_local,'Day')));
    IF campaign_day=ANY(campaign_days)
       AND campaign_local::time>=campaign_start AND campaign_local::time<campaign_end
       AND account_day=ANY(a.working_days)
       AND account_local::time>=a.working_hours_start::time
       AND account_local::time<a.working_hours_end::time THEN
      RETURN d;
    END IF;
    d:=d+interval '1 minute';
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN invalid_parameter_value OR datetime_field_overflow OR invalid_datetime_format THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.next_campaign_outreach_at(p_campaign_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND OR c.linkedin_account_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.next_campaign_account_outreach_at(c.id,c.linkedin_account_id,p_not_before);
END $$;

CREATE OR REPLACE FUNCTION public.campaign_account_window_validation(p_campaign_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE; due timestamptz;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'code','campaign_not_found'); END IF;
  IF c.linkedin_account_id IS NULL THEN RETURN jsonb_build_object('valid',false,'code','linkedin_account_required'); END IF;
  due:=public.next_campaign_account_outreach_at(c.id,c.linkedin_account_id,p_not_before);
  IF due IS NULL THEN
    RETURN jsonb_build_object('valid',false,'code','no_effective_sending_window',
      'message','Campaign hours do not overlap the selected LinkedIn account safety hours.');
  END IF;
  RETURN jsonb_build_object('valid',true,'code','valid','scheduled_at',due);
END $$;

CREATE OR REPLACE FUNCTION public.campaign_outreach_preflight(p_workspace_id uuid,p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.linkedin_execution_jobs%ROWTYPE; c public.customer_campaigns%ROWTYPE; a public.linkedin_accounts%ROWTYPE;
  source_id uuid; due timestamptz; campaign_local timestamp; account_local timestamp;
  campaign_start time; campaign_end time; campaign_days text[]; campaign_day text; account_day text;
BEGIN
  SELECT * INTO j FROM public.linkedin_execution_jobs WHERE id=p_job_id AND workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','job_not_found'); END IF;
  IF j.status IN ('failed','cancelled','completed','paused') THEN RETURN jsonb_build_object('allowed',false,'code','terminal_job'); END IF;
  BEGIN source_id:=(j.action_payload->>'source_campaign_id')::uuid; EXCEPTION WHEN OTHERS THEN source_id:=NULL; END;
  IF source_id IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','campaign_schedule_missing'); END IF;
  SELECT * INTO c FROM public.customer_campaigns WHERE id=source_id AND workspace_id=p_workspace_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','campaign_schedule_missing'); END IF;
  SELECT * INTO a FROM public.linkedin_accounts WHERE id=j.linkedin_account_id AND workspace_id=p_workspace_id;
  IF NOT FOUND OR a.id IS DISTINCT FROM c.linkedin_account_id THEN
    RETURN jsonb_build_object('allowed',false,'code','linkedin_account_schedule_mismatch');
  END IF;
  due:=public.next_campaign_account_outreach_at(c.id,a.id,now());
  IF due IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','no_effective_sending_window'); END IF;
  IF due>now()+interval '5 seconds' THEN
    UPDATE public.linkedin_execution_jobs SET status='scheduled',scheduled_at=due,error_message='Outside effective sending window',updated_at=now() WHERE id=j.id;
    RETURN jsonb_build_object('allowed',false,'code','outside_sending_window','scheduled_at',due);
  END IF;

  /* Explicit immediate dual check; the write preflight repeats account safety later. */
  campaign_start:=split_part(replace(c.operating_hours,'–','-'),'-',1)::time;
  campaign_end:=split_part(replace(c.operating_hours,'–','-'),'-',2)::time;
  campaign_days:=CASE lower(trim(c.operating_days)) WHEN 'monday–friday' THEN ARRAY['monday','tuesday','wednesday','thursday','friday'] WHEN 'monday-friday' THEN ARRAY['monday','tuesday','wednesday','thursday','friday'] ELSE regexp_split_to_array(lower(replace(c.operating_days,' ','')),',') END;
  campaign_local:=now() AT TIME ZONE c.outreach_timezone;
  account_local:=now() AT TIME ZONE a.timezone;
  campaign_day:=lower(trim(to_char(campaign_local,'Day')));
  account_day:=lower(trim(to_char(account_local,'Day')));
  IF NOT campaign_day=ANY(campaign_days) OR campaign_local::time<campaign_start OR campaign_local::time>=campaign_end THEN
    RETURN jsonb_build_object('allowed',false,'code','outside_campaign_window');
  END IF;
  IF NOT account_day=ANY(a.working_days) OR account_local::time<a.working_hours_start::time OR account_local::time>=a.working_hours_end::time THEN
    RETURN jsonb_build_object('allowed',false,'code','outside_working_hours');
  END IF;
  RETURN jsonb_build_object('allowed',true,'code','allowed');
END $$;

/* A failed pre-write attempt remains immutable; only live attempts are unique. */
DROP INDEX IF EXISTS public.uq_one_controlled_acceptance_job;
CREATE UNIQUE INDEX uq_one_live_controlled_acceptance_job
  ON public.linkedin_execution_jobs(workspace_id)
  WHERE coalesce((action_payload->>'acceptance_test_mode')::boolean,false)
    AND status IN ('queued','scheduled','running','pending','retry','retrying');

CREATE OR REPLACE FUNCTION public.guard_controlled_acceptance_attempt()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT coalesce((NEW.action_payload->>'acceptance_test_mode')::boolean,false) THEN RETURN NEW; END IF;
  IF coalesce((NEW.action_payload->>'human_initiated')::boolean,false) IS NOT TRUE
     OR nullif(NEW.action_payload->>'human_initiated_by','') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='controlled_acceptance_human_initiation_required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.linkedin_execution_jobs j
    WHERE j.workspace_id=NEW.workspace_id
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)
      AND j.status IN ('queued','scheduled','running','pending','retry','retrying')
  ) THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='controlled_acceptance_already_active'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.linkedin_write_audit w
    JOIN public.browser_execution_queue q ON q.id=w.task_id
    JOIN public.linkedin_execution_jobs j ON j.id=(q.action_params->>'job_id')::uuid
    WHERE j.workspace_id=NEW.workspace_id
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)
      AND w.execution_result='success'
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='controlled_acceptance_already_succeeded'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.linkedin_execution_jobs j
    WHERE j.workspace_id=NEW.workspace_id
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)
      AND j.status<>'failed'
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='previous_controlled_acceptance_not_eligible'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.linkedin_execution_jobs j
    JOIN public.browser_execution_queue q ON q.action_params->>'job_id'=j.id::text
    JOIN public.linkedin_write_audit w ON w.task_id=q.id
    WHERE j.workspace_id=NEW.workspace_id
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)
      AND (w.execution_started_at IS NOT NULL OR w.execution_result IS NOT NULL OR w.preflight_result='allowed')
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='previous_controlled_acceptance_reached_write_phase'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_controlled_acceptance_attempt_trigger ON public.linkedin_execution_jobs;
CREATE TRIGGER guard_controlled_acceptance_attempt_trigger BEFORE INSERT ON public.linkedin_execution_jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_controlled_acceptance_attempt();

CREATE OR REPLACE FUNCTION public.controlled_acceptance_eligibility(p_workspace_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.linkedin_execution_jobs j WHERE j.workspace_id=p_workspace_id
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)
      AND j.status IN ('queued','scheduled','running','pending','retry','retrying')) THEN
    RETURN jsonb_build_object('eligible',false,'code','controlled_acceptance_already_active');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.linkedin_write_audit w
    JOIN public.browser_execution_queue q ON q.id=w.task_id
    JOIN public.linkedin_execution_jobs j ON j.id=(q.action_params->>'job_id')::uuid
    WHERE j.workspace_id=p_workspace_id
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)
      AND w.execution_result='success') THEN
    RETURN jsonb_build_object('eligible',false,'code','controlled_acceptance_already_succeeded');
  END IF;
  IF EXISTS (SELECT 1 FROM public.linkedin_execution_jobs j WHERE j.workspace_id=p_workspace_id
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false) AND j.status<>'failed') THEN
    RETURN jsonb_build_object('eligible',false,'code','previous_controlled_acceptance_not_eligible');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.linkedin_execution_jobs j
    JOIN public.browser_execution_queue q ON q.action_params->>'job_id'=j.id::text
    JOIN public.linkedin_write_audit w ON w.task_id=q.id
    WHERE j.workspace_id=p_workspace_id
      AND coalesce((j.action_payload->>'acceptance_test_mode')::boolean,false)
      AND (w.execution_started_at IS NOT NULL OR w.execution_result IS NOT NULL OR w.preflight_result='allowed')) THEN
    RETURN jsonb_build_object('eligible',false,'code','previous_controlled_acceptance_reached_write_phase');
  END IF;
  RETURN jsonb_build_object('eligible',true,'code','eligible');
END $$;

/* Working-hours overrides are incompatible with mandatory dual-window agreement. */
CREATE OR REPLACE FUNCTION public.preflight_linkedin_write(
  p_task_id uuid,p_attempt_id uuid,p_workspace_id uuid,p_account_id uuid,p_action_type text,p_target text,
  p_idempotency_key text,p_project_ref text,p_campaign_id uuid DEFAULT NULL,p_contact_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,extensions AS $$
BEGIN
  RETURN public.preflight_linkedin_write_without_acceptance_override(
    p_task_id,p_attempt_id,p_workspace_id,p_account_id,p_action_type,p_target,
    p_idempotency_key,p_project_ref,p_campaign_id,p_contact_id);
END $$;

/* Staging-only persisted correction, scoped through the immutable failed job. */
UPDATE public.linkedin_accounts a
SET timezone='Asia/Kolkata',
    working_days=ARRAY['monday','tuesday','wednesday','thursday','friday'],
    working_hours_start='09:00',working_hours_end='17:00',updated_at=now()
FROM public.linkedin_execution_jobs j
WHERE j.id='51ccbcf6-1361-4da7-9f09-f080d11b8495'
  AND j.linkedin_account_id=a.id
  AND j.workspace_id=a.workspace_id
  AND j.status='failed';

REVOKE ALL ON FUNCTION public.next_campaign_account_outreach_at(uuid,uuid,timestamptz),public.campaign_account_window_validation(uuid,timestamptz),public.controlled_acceptance_eligibility(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.next_campaign_account_outreach_at(uuid,uuid,timestamptz),public.campaign_account_window_validation(uuid,timestamptz),public.controlled_acceptance_eligibility(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preflight_linkedin_write(uuid,uuid,uuid,uuid,text,text,text,text,uuid,uuid) TO service_role;

COMMIT;
