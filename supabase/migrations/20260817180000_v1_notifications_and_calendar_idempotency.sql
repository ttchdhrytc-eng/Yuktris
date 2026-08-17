/*
# Yuktris V1 notifications + calendar idempotency

Adds the unified notifications feed consumed by the current Topbar/Notifications UI,
and guarantees that mirroring a Google Calendar event is idempotent per calendar
connection.
*/

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  action_url text,
  read_at timestamptz,
  event_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_workspace_created
  ON public.notifications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_unread
  ON public.notifications(workspace_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_workspace_event_key
  ON public.notifications(workspace_id, event_key)
  WHERE event_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
CREATE POLICY "select_own_notifications" ON public.notifications
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
CREATE POLICY "update_own_notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_notifications" ON public.notifications;
CREATE POLICY "insert_own_notifications" ON public.notifications
  FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_notifications" ON public.notifications;
CREATE POLICY "delete_own_notifications" ON public.notifications
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

CREATE UNIQUE INDEX IF NOT EXISTS uq_linkedin_calendar_events_connection_external
  ON public.linkedin_calendar_events(connection_id, external_event_id);
