BEGIN;

-- Preserve the already deployed state-transition logic, then normalize the
-- conversation projection from its authoritative message rows. The legacy
-- reconciler revisits completed jobs on every tick, so incrementing counters
-- and overwriting the latest direction there is not idempotent.
ALTER FUNCTION public.reconcile_linkedin_v1_pipeline(uuid)
  RENAME TO reconcile_linkedin_v1_pipeline_state_transitions;

CREATE OR REPLACE FUNCTION public.reconcile_linkedin_v1_pipeline(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.reconcile_linkedin_v1_pipeline_state_transitions(p_workspace_id);

  WITH message_summary AS (
    SELECT
      m.conversation_id,
      count(*)::integer AS total_messages,
      max(coalesce(m.sent_at, m.created_at)) AS last_message_at,
      (array_agg(m.direction ORDER BY coalesce(m.sent_at, m.created_at) DESC, m.created_at DESC))[1] AS last_direction,
      (array_agg(m.body ORDER BY coalesce(m.sent_at, m.created_at) DESC, m.created_at DESC))[1] AS last_body
    FROM public.linkedin_messages m
    WHERE m.workspace_id = p_workspace_id
    GROUP BY m.conversation_id
  )
  UPDATE public.linkedin_conversations c
  SET
    total_messages = s.total_messages,
    last_message_at = s.last_message_at,
    last_message_direction = s.last_direction,
    last_message_preview = left(coalesce(s.last_body, ''), 200),
    updated_at = now()
  FROM message_summary s
  WHERE c.id = s.conversation_id
    AND c.workspace_id = p_workspace_id
    AND (
      c.total_messages IS DISTINCT FROM s.total_messages
      OR c.last_message_at IS DISTINCT FROM s.last_message_at
      OR c.last_message_direction IS DISTINCT FROM s.last_direction
      OR c.last_message_preview IS DISTINCT FROM left(coalesce(s.last_body, ''), 200)
    );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_linkedin_v1_pipeline(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_linkedin_v1_pipeline(uuid) TO service_role;

COMMIT;
