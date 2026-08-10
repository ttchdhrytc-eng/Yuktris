-- SECURITY DEFINER RPCs for worker direct table operations
-- These allow the worker to operate with the anon key (no service role needed)

-- 1. Insert into linkedin_auth_interactions (for progress callbacks, challenges, session_saved)
CREATE OR REPLACE FUNCTION public.insert_auth_interaction(
  p_workspace_id UUID,
  p_account_id UUID,
  p_queue_item_id UUID,
  p_interaction_type TEXT,
  p_step TEXT,
  p_message TEXT,
  p_status TEXT DEFAULT 'completed',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_challenge_type TEXT DEFAULT NULL,
  p_challenge_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO linkedin_auth_interactions (
    workspace_id, account_id, queue_item_id,
    interaction_type, step, message, status,
    metadata, challenge_type, challenge_description
  ) VALUES (
    p_workspace_id, p_account_id, p_queue_item_id,
    p_interaction_type, p_step, p_message, p_status,
    p_metadata, p_challenge_type, p_challenge_description
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.insert_auth_interaction TO anon, authenticated;

-- 2. Set queue item to 'waiting' status (for challenge detection)
CREATE OR REPLACE FUNCTION public.set_queue_item_waiting(
  p_queue_item_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE browser_execution_queue
  SET status = 'waiting', updated_at = now()
  WHERE id = p_queue_item_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_queue_item_waiting TO anon, authenticated;

-- 3. Get connected accounts for session heartbeat
CREATE OR REPLACE FUNCTION public.get_connected_accounts()
RETURNS TABLE(id UUID, workspace_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, workspace_id
  FROM linkedin_accounts
  WHERE connection_state = 'connected'
    AND session_status = 'connected';
$function$;

GRANT EXECUTE ON FUNCTION public.get_connected_accounts TO anon, authenticated;

-- 4. Insert session heartbeat
CREATE OR REPLACE FUNCTION public.insert_session_heartbeat(
  p_workspace_id UUID,
  p_account_id UUID,
  p_worker_id TEXT,
  p_status TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO linkedin_session_heartbeats (
    workspace_id, account_id, worker_id, status, metadata
  ) VALUES (
    p_workspace_id, p_account_id, p_worker_id, p_status, p_metadata
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.insert_session_heartbeat TO anon, authenticated;

-- 5. Update account last_activity_at (for heartbeat)
CREATE OR REPLACE FUNCTION public.touch_account_activity(
  p_account_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE linkedin_accounts
  SET last_activity_at = now()
  WHERE id = p_account_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.touch_account_activity TO anon, authenticated;

-- 6. Clean up old session heartbeats
CREATE OR REPLACE FUNCTION public.cleanup_old_heartbeats(
  p_cutoff TIMESTAMP WITH TIME ZONE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM linkedin_session_heartbeats
  WHERE created_at < p_cutoff;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_heartbeats TO anon, authenticated;

-- 7. Cancel queue items for an account (for disconnect)
CREATE OR REPLACE FUNCTION public.cancel_queue_items_for_account(
  p_account_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE browser_execution_queue
  SET status = 'cancelled', completed_at = now()
  WHERE account_id = p_account_id
    AND status IN ('pending', 'running', 'waiting', 'retry');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_queue_items_for_account TO anon, authenticated;

-- 8. Revoke sessions for an account (for disconnect)
CREATE OR REPLACE FUNCTION public.revoke_sessions_for_account(
  p_account_id UUID,
  p_workspace_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE linkedin_sessions
  SET status = 'revoked'
  WHERE account_id = p_account_id
    AND workspace_id = p_workspace_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.revoke_sessions_for_account TO anon, authenticated;

-- 9. Delete session backups for an account (for disconnect)
CREATE OR REPLACE FUNCTION public.delete_session_backups_for_account(
  p_account_id UUID,
  p_workspace_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM linkedin_session_backups
  WHERE account_id = p_account_id
    AND workspace_id = p_workspace_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_session_backups_for_account TO anon, authenticated;
