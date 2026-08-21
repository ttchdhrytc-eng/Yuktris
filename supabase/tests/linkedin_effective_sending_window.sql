BEGIN;
DO $$
DECLARE c constant uuid:='f4ee741d-f3b8-47b8-ba67-770f44b58c00';due timestamptz;
BEGIN
  UPDATE public.customer_campaigns SET operating_days='monday',operating_hours='20:30–22:00',outreach_timezone='Asia/Kolkata' WHERE id=c;
  due:=public.next_campaign_outreach_at(c,'2026-08-24 15:00:00+00');
  IF due IS DISTINCT FROM '2026-08-24 15:00:00+00'::timestamptz THEN RAISE EXCEPTION 'Monday-only/custom-hours failed: %',due;END IF;
  UPDATE public.customer_campaigns SET operating_days='saturday,sunday',operating_hours='09:00–17:00' WHERE id=c;
  IF public.next_campaign_outreach_at(c,'2026-08-22 03:30:00+00') IS DISTINCT FROM '2026-08-22 03:30:00+00'::timestamptz THEN RAISE EXCEPTION 'Saturday execution failed';END IF;
  IF public.next_campaign_outreach_at(c,'2026-08-23 03:30:00+00') IS DISTINCT FROM '2026-08-23 03:30:00+00'::timestamptz THEN RAISE EXCEPTION 'Sunday execution failed';END IF;
  UPDATE public.customer_campaigns SET operating_days='monday,tuesday,wednesday,thursday,friday,saturday,sunday',operating_hours='20:00–23:00' WHERE id=c;
  IF public.next_campaign_outreach_at(c,'2026-08-21 15:00:00+00') IS DISTINCT FROM '2026-08-21 15:00:00+00'::timestamptz THEN RAISE EXCEPTION 'Friday-night/all-days failed';END IF;
  UPDATE public.customer_campaigns SET operating_days='monday,tuesday,wednesday,thursday,friday',operating_hours='09:00–17:00' WHERE id=c;
  IF public.next_campaign_outreach_at(c,'2026-08-22 03:30:00+00') IS DISTINCT FROM '2026-08-24 03:30:00+00'::timestamptz THEN RAISE EXCEPTION 'Saturday-to-Monday wait failed';END IF;
  UPDATE public.customer_campaigns SET operating_days='sunday',operating_hours='01:00–04:00',outreach_timezone='America/New_York' WHERE id=c;
  due:=public.next_campaign_outreach_at(c,'2026-11-01 04:00:00+00');
  IF due IS NULL OR (due AT TIME ZONE 'America/New_York')::time<'01:00'::time OR (due AT TIME ZONE 'America/New_York')::time>='04:00'::time THEN RAISE EXCEPTION 'DST transition failed: %',due;END IF;
END $$;
ROLLBACK;
