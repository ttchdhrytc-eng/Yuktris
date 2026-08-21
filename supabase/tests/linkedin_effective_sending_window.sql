BEGIN;

DO $$
DECLARE
  v_campaign constant uuid := 'f4ee741d-f3b8-47b8-ba67-770f44b58c00';
  v_account uuid;
  v_due timestamptz;
BEGIN
  SELECT linkedin_account_id INTO STRICT v_account FROM public.linkedin_execution_jobs
  WHERE id='51ccbcf6-1361-4da7-9f09-f080d11b8495';

  UPDATE public.customer_campaigns SET outreach_timezone='Asia/Kolkata',operating_days='Monday–Friday',operating_hours='09:00–17:00' WHERE id=v_campaign;
  UPDATE public.linkedin_accounts SET timezone='Asia/Kolkata',working_days=ARRAY['monday','tuesday','wednesday','thursday','friday'],working_hours_start='09:00',working_hours_end='17:00' WHERE id=v_account;
  v_due:=public.next_campaign_account_outreach_at(v_campaign,v_account,'2026-08-24 03:30:00+00');
  IF v_due IS DISTINCT FROM '2026-08-24 03:30:00+00'::timestamptz THEN RAISE EXCEPTION 'Asia/Kolkata aligned window failed: %',v_due; END IF;

  UPDATE public.linkedin_accounts SET timezone='Europe/London',working_hours_start='08:00',working_hours_end='12:00' WHERE id=v_account;
  v_due:=public.next_campaign_account_outreach_at(v_campaign,v_account,'2026-08-24 03:30:00+00');
  IF v_due IS DISTINCT FROM '2026-08-24 07:00:00+00'::timestamptz THEN RAISE EXCEPTION 'different-IANA partial overlap failed: %',v_due; END IF;

  UPDATE public.linkedin_accounts SET timezone='Pacific/Auckland',working_hours_start='09:00',working_hours_end='10:00' WHERE id=v_account;
  IF public.next_campaign_account_outreach_at(v_campaign,v_account,'2026-08-24 00:00:00+00') IS NOT NULL THEN RAISE EXCEPTION 'zero overlap did not fail closed'; END IF;

  UPDATE public.customer_campaigns SET outreach_timezone='America/New_York',operating_hours='01:00–04:00' WHERE id=v_campaign;
  UPDATE public.linkedin_accounts SET timezone='America/New_York',working_hours_start='01:00',working_hours_end='04:00' WHERE id=v_account;
  v_due:=public.next_campaign_account_outreach_at(v_campaign,v_account,'2026-11-01 04:00:00+00');
  IF v_due IS NULL OR (v_due AT TIME ZONE 'America/New_York')::time<'01:00'::time OR (v_due AT TIME ZONE 'America/New_York')::time>='04:00'::time THEN RAISE EXCEPTION 'DST boundary failed: %',v_due; END IF;
END $$;

ROLLBACK;
