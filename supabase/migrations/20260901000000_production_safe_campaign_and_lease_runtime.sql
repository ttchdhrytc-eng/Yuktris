BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog, public;

/*
 * Production-only extraction of the normal customer runtime contracts that
 * were previously mixed with staging certification machinery.
 *
 * Deliberately contains no test target, acceptance override, launch fixture,
 * staging project identifier, or customer seed data.
 */
DO $preflight$
BEGIN
  IF to_regclass('public.customer_campaigns') IS NULL
     OR to_regclass('public.linkedin_accounts') IS NULL
     OR to_regclass('public.browser_execution_queue') IS NULL
     OR to_regclass('public.workspaces') IS NULL THEN
    RAISE EXCEPTION 'production_v1_runtime_prerequisites_missing';
  END IF;
  IF to_regprocedure('public.next_campaign_outreach_at(uuid,timestamp with time zone)') IS NULL
     OR to_regprocedure('public.is_workspace_member(uuid)') IS NULL THEN
    RAISE EXCEPTION 'production_v1_runtime_functions_missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='browser_execution_queue' AND column_name='attempt_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='browser_execution_queue' AND column_name='lease_expires_at'
  ) THEN
    RAISE EXCEPTION 'production_v1_queue_lease_columns_missing';
  END IF;
END
$preflight$;

/* Customer campaign configuration is the sole scheduling authority. */
CREATE OR REPLACE FUNCTION public.next_campaign_account_outreach_at(
  p_campaign_id uuid,
  p_account_id uuid,
  p_not_before timestamptz DEFAULT now()
) RETURNS timestamptz
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.customer_campaigns c
      WHERE c.id=p_campaign_id AND c.linkedin_account_id=p_account_id
    ) THEN public.next_campaign_outreach_at(p_campaign_id,p_not_before)
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.campaign_window_validation(
  p_campaign_id uuid,
  p_not_before timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE c public.customer_campaigns%ROWTYPE; due timestamptz;
BEGIN
  SELECT * INTO c FROM public.customer_campaigns WHERE id=p_campaign_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'code','campaign_not_found'); END IF;
  due:=public.next_campaign_outreach_at(c.id,p_not_before);
  IF due IS NULL THEN
    RETURN jsonb_build_object(
      'valid',false,
      'code','invalid_campaign_schedule',
      'message','Choose at least one sending day, valid hours, and an IANA timezone.'
    );
  END IF;
  RETURN jsonb_build_object('valid',true,'code','valid','scheduled_at',due);
END $$;

CREATE OR REPLACE FUNCTION public.campaign_account_window_validation(
  p_campaign_id uuid,
  p_not_before timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT public.campaign_window_validation(p_campaign_id,p_not_before)
$$;

REVOKE ALL ON FUNCTION public.next_campaign_account_outreach_at(uuid,uuid,timestamptz),
  public.campaign_window_validation(uuid,timestamptz),
  public.campaign_account_window_validation(uuid,timestamptz)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.next_campaign_account_outreach_at(uuid,uuid,timestamptz),
  public.campaign_window_validation(uuid,timestamptz),
  public.campaign_account_window_validation(uuid,timestamptz)
  TO service_role;

/* Durable server-recorded ownership telemetry for normal queue processing. */
CREATE TABLE public.linkedin_queue_lease_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  queue_item_id uuid NOT NULL REFERENCES public.browser_execution_queue(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.linkedin_accounts(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  attempt_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('claimed','renewed','released','renewal_rejected','recovered')),
  lease_expires_at timestamptz,
  server_recorded_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX linkedin_queue_lease_events_task_time_idx
  ON public.linkedin_queue_lease_events(queue_item_id,server_recorded_at);
ALTER TABLE public.linkedin_queue_lease_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY linkedin_queue_lease_events_member_select
  ON public.linkedin_queue_lease_events FOR SELECT TO authenticated
  USING(public.is_workspace_member(workspace_id));
REVOKE ALL ON public.linkedin_queue_lease_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.linkedin_queue_lease_events TO authenticated;
GRANT ALL ON public.linkedin_queue_lease_events TO service_role;

CREATE OR REPLACE FUNCTION public.capture_linkedin_queue_lease_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_event text;
BEGIN
  IF NEW.status='running' AND OLD.status IS DISTINCT FROM 'running' THEN v_event:='claimed';
  ELSIF NEW.status='running' AND OLD.status='running' AND NEW.attempt_id=OLD.attempt_id
    AND NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at THEN v_event:='renewed';
  ELSIF OLD.status='running' AND NEW.status IN('pending','retry') AND NEW.attempt_id IS NULL THEN v_event:='recovered';
  ELSIF OLD.status='running' AND NEW.status IN('completed','failed','cancelled','escalated') THEN v_event:='released';
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.linkedin_queue_lease_events(
    workspace_id,queue_item_id,account_id,worker_id,attempt_id,event_type,lease_expires_at,evidence
  ) VALUES(
    NEW.workspace_id,NEW.id,NEW.account_id,coalesce(NEW.worker_id,OLD.worker_id),
    coalesce(NEW.attempt_id,OLD.attempt_id),v_event,NEW.lease_expires_at,
    jsonb_build_object('old_status',OLD.status,'new_status',NEW.status,'old_lease_expires_at',OLD.lease_expires_at)
  );
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_linkedin_queue_lease_event() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_linkedin_queue_lease_event() TO service_role;

CREATE TRIGGER capture_linkedin_queue_lease_event
AFTER UPDATE OF status,lease_expires_at ON public.browser_execution_queue
FOR EACH ROW EXECUTE FUNCTION public.capture_linkedin_queue_lease_event();

COMMIT;
