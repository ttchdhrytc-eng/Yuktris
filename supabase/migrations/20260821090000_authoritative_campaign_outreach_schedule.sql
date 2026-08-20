BEGIN;
ALTER TABLE public.customer_campaigns ADD COLUMN IF NOT EXISTS outreach_timezone text;

CREATE OR REPLACE FUNCTION public.next_campaign_outreach_at(p_campaign_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE; d timestamptz; l timestamp; day_name text; start_time time; end_time time; allowed_days text[];
BEGIN
 SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
 IF NOT FOUND OR nullif(trim(c.outreach_timezone),'') IS NULL THEN RETURN NULL; END IF;
 PERFORM now() AT TIME ZONE c.outreach_timezone;
 start_time:=split_part(replace(c.operating_hours,'–','-'),'-',1)::time;
 end_time:=split_part(replace(c.operating_hours,'–','-'),'-',2)::time;
 allowed_days:=CASE lower(trim(c.operating_days)) WHEN 'monday–friday' THEN ARRAY['monday','tuesday','wednesday','thursday','friday'] WHEN 'monday-friday' THEN ARRAY['monday','tuesday','wednesday','thursday','friday'] ELSE regexp_split_to_array(lower(replace(c.operating_days,' ','')),',') END;
 d:=date_trunc('minute',greatest(p_not_before,now()));
 FOR i IN 0..20160 LOOP
  l:=d AT TIME ZONE c.outreach_timezone; day_name:=lower(trim(to_char(l,'Day')));
  IF day_name=ANY(allowed_days) AND l::time>=start_time AND l::time<end_time THEN RETURN d; END IF;
  d:=d+interval '1 minute';
 END LOOP;
 RETURN NULL;
EXCEPTION WHEN invalid_parameter_value OR datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.campaign_outreach_preflight(p_workspace_id uuid,p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE j public.linkedin_execution_jobs%ROWTYPE; c public.customer_campaigns%ROWTYPE; source_id uuid; due timestamptz;
BEGIN
 SELECT * INTO j FROM public.linkedin_execution_jobs WHERE id=p_job_id AND workspace_id=p_workspace_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','job_not_found'); END IF;
 IF j.status IN ('failed','cancelled','completed','paused') THEN RETURN jsonb_build_object('allowed',false,'code','terminal_job'); END IF;
 BEGIN source_id:=(j.action_payload->>'source_campaign_id')::uuid; EXCEPTION WHEN OTHERS THEN source_id:=NULL; END;
 IF source_id IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','campaign_schedule_missing'); END IF;
 SELECT * INTO c FROM public.customer_campaigns WHERE id=source_id AND workspace_id=p_workspace_id;
 IF NOT FOUND OR nullif(trim(c.outreach_timezone),'') IS NULL THEN
  UPDATE public.linkedin_execution_jobs SET status='paused',error_message='Configure outreach timezone',updated_at=now() WHERE id=j.id;
  RETURN jsonb_build_object('allowed',false,'code','outreach_timezone_required');
 END IF;
 due:=public.next_campaign_outreach_at(c.id,now());
 IF due IS NULL THEN RETURN jsonb_build_object('allowed',false,'code','invalid_campaign_schedule'); END IF;
 IF due>now()+interval '5 seconds' THEN
  UPDATE public.linkedin_execution_jobs SET status='scheduled',scheduled_at=due,error_message='Outside sending window',updated_at=now() WHERE id=j.id;
  RETURN jsonb_build_object('allowed',false,'code','outside_sending_window','scheduled_at',due);
 END IF;
 RETURN jsonb_build_object('allowed',true,'code','allowed');
END $$;

REVOKE ALL ON FUNCTION public.next_campaign_outreach_at(uuid,timestamptz),public.campaign_outreach_preflight(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.next_campaign_outreach_at(uuid,timestamptz),public.campaign_outreach_preflight(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_campaign_job_schedule()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE source_id uuid; due timestamptz;
BEGIN
 IF NEW.action_type NOT IN ('connection_request','first_message','send_message','follow_up_message') THEN RETURN NEW; END IF;
 IF NEW.status IN ('failed','cancelled','completed','paused') THEN RETURN NEW; END IF;
 BEGIN source_id:=(NEW.action_payload->>'source_campaign_id')::uuid; EXCEPTION WHEN OTHERS THEN source_id:=NULL; END;
 IF source_id IS NULL AND NEW.sequence_id IS NOT NULL THEN
  SELECT (j.action_payload->>'source_campaign_id')::uuid INTO source_id FROM public.linkedin_execution_jobs j
   WHERE j.sequence_id=NEW.sequence_id AND j.action_payload ? 'source_campaign_id' ORDER BY j.created_at LIMIT 1;
  IF source_id IS NOT NULL THEN NEW.action_payload:=coalesce(NEW.action_payload,'{}')||jsonb_build_object('source_campaign_id',source_id); END IF;
 END IF;
 IF source_id IS NULL THEN NEW.status:='paused'; NEW.error_message:='Campaign schedule missing'; RETURN NEW; END IF;
 due:=public.next_campaign_outreach_at(source_id,coalesce(NEW.scheduled_at,now()));
 IF due IS NULL THEN NEW.status:='paused';NEW.scheduled_at:=NULL;NEW.error_message:='Configure outreach timezone';RETURN NEW; END IF;
 NEW.scheduled_at:=due;
 IF NEW.status IN ('queued','retrying') OR TG_OP='INSERT' THEN NEW.status:='scheduled'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_campaign_job_schedule_trigger ON public.linkedin_execution_jobs;
CREATE TRIGGER enforce_campaign_job_schedule_trigger BEFORE INSERT OR UPDATE OF status,scheduled_at ON public.linkedin_execution_jobs
FOR EACH ROW EXECUTE FUNCTION public.enforce_campaign_job_schedule();

CREATE OR REPLACE FUNCTION public.stop_controlled_acceptance_sequence()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='completed' AND coalesce((NEW.action_payload->>'acceptance_test_mode')::boolean,false) THEN
  NEW.action_payload:=NEW.action_payload-'sequence_state_id';
  IF NEW.sequence_id IS NOT NULL THEN
   UPDATE public.linkedin_sequence_state SET step_status='stopped',stopped_reason='controlled_acceptance_complete',next_action_at=NULL,completed_at=coalesce(completed_at,now()),updated_at=now()
    WHERE sequence_id=NEW.sequence_id AND workspace_id=NEW.workspace_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS stop_controlled_acceptance_sequence_trigger ON public.linkedin_execution_jobs;
CREATE TRIGGER stop_controlled_acceptance_sequence_trigger BEFORE UPDATE OF status ON public.linkedin_execution_jobs
FOR EACH ROW EXECUTE FUNCTION public.stop_controlled_acceptance_sequence();

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_controlled_acceptance_job
 ON public.linkedin_execution_jobs(workspace_id)
 WHERE coalesce((action_payload->>'acceptance_test_mode')::boolean,false);

UPDATE public.linkedin_execution_jobs SET status='failed',scheduled_at=NULL,error_message='LinkedIn write denied: unsafe_target',completed_at=coalesce(completed_at,now()),updated_at=now() WHERE id='6e55ff97-3ae9-46e5-8cb1-a856866a3f62';
UPDATE public.linkedin_sequence_state SET step_status='stopped',stopped_reason='unsafe_target',next_action_at=NULL,completed_at=coalesce(completed_at,now()),updated_at=now() WHERE id='2425c536-349b-4e5c-8990-631b367c841c';
UPDATE public.browser_execution_queue SET status='failed',next_retry_at=NULL,scheduled_at=NULL,max_retries=0,updated_at=now() WHERE id='ff327220-2bf2-44d6-b35d-1f3968900f8c' AND status<>'completed';
COMMIT;
