/*
# Fix forensic log trigger on linkedin_accounts

The trigger log_linkedin_accounts_update() had a type mismatch:
  to_jsonb(OLD)->>key returns text, but value from jsonb_each() is jsonb.
  Comparing text to jsonb with IS DISTINCT FROM throws:
    "operator does not exist: text = jsonb"

Fix: Cast value to text using value::text or use ->> on both sides.
*/

CREATE OR REPLACE FUNCTION public.log_linkedin_accounts_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pid BIGINT;
  v_user TEXT;
  v_app TEXT;
  v_addr TEXT;
  v_query TEXT;
  v_changed TEXT[];
BEGIN
  v_pid := pg_backend_pid();
  SELECT usename INTO v_user FROM pg_stat_activity WHERE pid = v_pid;
  SELECT application_name INTO v_app FROM pg_stat_activity WHERE pid = v_pid;
  SELECT client_addr::text INTO v_addr FROM pg_stat_activity WHERE pid = v_pid;
  SELECT query INTO v_query FROM pg_stat_activity WHERE pid = v_pid;

  SELECT array_agg(key) INTO v_changed
  FROM jsonb_each(to_jsonb(NEW))
  WHERE to_jsonb(OLD)->>key IS DISTINCT FROM value#>>'{}';

  INSERT INTO linkedin_accounts_forensic_log (
    operation, account_id, workspace_id, old_data, new_data, changed_columns,
    caller_query, caller_pid, caller_user, caller_application, caller_addr
  ) VALUES (
    'UPDATE', NEW.id, NEW.workspace_id, to_jsonb(OLD), to_jsonb(NEW), v_changed,
    left(v_query, 5000), v_pid, v_user, v_app, v_addr
  );

  RETURN NEW;
END;
$function$;
