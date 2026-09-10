-- Fix update_linkedin_account_state to validate and persist health_status
-- The worker sends health_status in updates but the RPC silently ignored it

ALTER TABLE public.linkedin_accounts
  ALTER COLUMN health_status DROP DEFAULT;

ALTER TABLE public.linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_health_status_check;

ALTER TABLE public.linkedin_accounts
  ADD CONSTRAINT linkedin_accounts_health_status_check
  CHECK (health_status IN ('healthy','warning','expired','disconnected','browser_lost','browserbase_missing','playwright_lost','auth_failed','corrupted'));

ALTER TABLE public.linkedin_accounts
  ALTER COLUMN health_status SET DEFAULT 'disconnected';

CREATE OR REPLACE FUNCTION public.update_linkedin_account_state(p_account_id uuid, p_updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_last_validated_at timestamptz;
  v_last_login_at timestamptz;
  v_browser_connected_at timestamptz;
  v_last_activity_at timestamptz;
BEGIN
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' THEN
    RAISE EXCEPTION 'account updates must be a JSON object';
  END IF;
  IF (p_updates ? 'connection_state' AND p_updates->>'connection_state' IS NULL)
    OR (p_updates ? 'session_status' AND p_updates->>'session_status' IS NULL)
    OR (p_updates ? 'status' AND p_updates->>'status' IS NULL)
    OR (p_updates ? 'health_status' AND p_updates->>'health_status' IS NULL) THEN
    RAISE EXCEPTION 'account state fields cannot be null';
  END IF;
  IF p_updates ? 'connection_state' AND NOT (p_updates->>'connection_state' = ANY (ARRAY[
    'pending','creating_session','session_created','connecting_browser','connected','opening_linkedin',
    'ready_for_login','authenticated','authenticating','requires_action','session_expired',
    'session_invalid','restricted','disconnected','failed','cancelled'])) THEN
    RAISE EXCEPTION 'invalid connection_state';
  END IF;
  IF p_updates ? 'session_status' AND NOT (p_updates->>'session_status' = ANY
    (ARRAY['connected','disconnected','expired','reconnecting'])) THEN
    RAISE EXCEPTION 'invalid session_status';
  END IF;
  IF p_updates ? 'status' AND NOT (p_updates->>'status' = ANY
    (ARRAY['active','paused','restricted','banned','expired','pending_login','connected','disconnected','error'])) THEN
    RAISE EXCEPTION 'invalid account status';
  END IF;
  IF p_updates ? 'health_status' AND NOT (p_updates->>'health_status' = ANY
    (ARRAY['healthy','warning','expired','disconnected','browser_lost','browserbase_missing','playwright_lost','auth_failed','corrupted'])) THEN
    RAISE EXCEPTION 'invalid health_status';
  END IF;
  BEGIN
    v_last_validated_at := CASE WHEN p_updates ? 'last_validated_at' AND p_updates->>'last_validated_at' IS NOT NULL THEN (p_updates->>'last_validated_at')::timestamptz END;
    v_last_login_at := CASE WHEN p_updates ? 'last_login_at' AND p_updates->>'last_login_at' IS NOT NULL THEN (p_updates->>'last_login_at')::timestamptz END;
    v_browser_connected_at := CASE WHEN p_updates ? 'browser_connected_at' AND p_updates->>'browser_connected_at' IS NOT NULL THEN (p_updates->>'browser_connected_at')::timestamptz END;
    v_last_activity_at := CASE WHEN p_updates ? 'last_activity_at' AND p_updates->>'last_activity_at' IS NOT NULL THEN (p_updates->>'last_activity_at')::timestamptz END;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'invalid account timestamp';
  END;
  UPDATE public.linkedin_accounts SET
    connection_state = CASE WHEN p_updates ? 'connection_state' THEN p_updates->>'connection_state' ELSE connection_state END,
    session_status = CASE WHEN p_updates ? 'session_status' THEN p_updates->>'session_status' ELSE session_status END,
    status = CASE WHEN p_updates ? 'status' THEN p_updates->>'status' ELSE status END,
    health_status = CASE WHEN p_updates ? 'health_status' THEN p_updates->>'health_status' ELSE health_status END,
    last_validated_at = CASE WHEN p_updates ? 'last_validated_at' THEN v_last_validated_at ELSE last_validated_at END,
    last_login_at = CASE WHEN p_updates ? 'last_login_at' THEN v_last_login_at ELSE last_login_at END,
    last_error = CASE WHEN p_updates ? 'last_error' THEN p_updates->>'last_error' ELSE last_error END,
    profile_url = CASE WHEN p_updates ? 'profile_url' THEN p_updates->>'profile_url' ELSE profile_url END,
    profile_name = CASE WHEN p_updates ? 'profile_name' THEN p_updates->>'profile_name' ELSE profile_name END,
    profile_headline = CASE WHEN p_updates ? 'profile_headline' THEN p_updates->>'profile_headline' ELSE profile_headline END,
    browserbase_session_id = CASE WHEN p_updates ? 'browserbase_session_id' THEN p_updates->>'browserbase_session_id' ELSE browserbase_session_id END,
    browser_connected_at = CASE WHEN p_updates ? 'browser_connected_at' THEN v_browser_connected_at ELSE browser_connected_at END,
    last_activity_at = CASE WHEN p_updates ? 'last_activity_at' THEN v_last_activity_at ELSE last_activity_at END,
    updated_at=now()
  WHERE id=p_account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LinkedIn account not found'; END IF;
END $$;