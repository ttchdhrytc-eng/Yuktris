-- Update the RPC to handle browserbase_session_id and browser_connected_at
CREATE OR REPLACE FUNCTION public.update_linkedin_account_state(p_account_id uuid, p_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
UPDATE linkedin_accounts
SET
connection_state = COALESCE(p_updates->>'connection_state', connection_state),
session_status = COALESCE(p_updates->>'session_status', session_status),
status = COALESCE(p_updates->>'status', status),
last_validated_at = COALESCE((p_updates->>'last_validated_at')::TIMESTAMPTZ, last_validated_at),
last_login_at = COALESCE((p_updates->>'last_login_at')::TIMESTAMPTZ, last_login_at),
last_error = COALESCE(p_updates->>'last_error', last_error),
profile_url = COALESCE(p_updates->>'profile_url', profile_url),
profile_name = COALESCE(p_updates->>'profile_name', profile_name),
profile_headline = COALESCE(p_updates->>'profile_headline', profile_headline),
browserbase_session_id = COALESCE(p_updates->>'browserbase_session_id', browserbase_session_id),
browser_connected_at = COALESCE((p_updates->>'browser_connected_at')::TIMESTAMPTZ, browser_connected_at),
updated_at = now()
WHERE id = p_account_id;
END;
$function$;
