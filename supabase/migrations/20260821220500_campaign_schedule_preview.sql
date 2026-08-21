BEGIN;

CREATE OR REPLACE FUNCTION public.next_campaign_schedule_at(
  p_operating_days text,p_start_time time,p_end_time time,p_timezone text,p_not_before timestamptz DEFAULT now()
) RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE d timestamptz;local_time timestamp;day_name text;allowed_days text[];validation jsonb;
BEGIN
  allowed_days:=public.campaign_operating_days(p_operating_days);
  validation:=public.campaign_schedule_validation(p_operating_days,p_start_time,p_end_time,p_timezone);
  IF NOT coalesce((validation->>'valid')::boolean,false) THEN RETURN NULL;END IF;
  d:=date_trunc('minute',greatest(p_not_before,now()));
  FOR i IN 0..20160 LOOP
    local_time:=d AT TIME ZONE p_timezone;day_name:=lower(trim(to_char(local_time,'Day')));
    IF day_name=ANY(allowed_days) AND local_time::time>=p_start_time AND local_time::time<p_end_time THEN RETURN d;END IF;
    d:=d+interval '1 minute';
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.next_campaign_outreach_at(p_campaign_id uuid,p_not_before timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE;start_time time;end_time time;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RETURN NULL;END IF;
  start_time:=split_part(replace(c.operating_hours,'–','-'),'-',1)::time;
  end_time:=split_part(replace(c.operating_hours,'–','-'),'-',2)::time;
  RETURN public.next_campaign_schedule_at(c.operating_days,start_time,end_time,c.outreach_timezone,p_not_before);
EXCEPTION WHEN invalid_parameter_value OR datetime_field_overflow OR invalid_datetime_format THEN RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.next_campaign_schedule_at(text,time,time,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.next_campaign_schedule_at(text,time,time,text,timestamptz) TO service_role;

COMMIT;
