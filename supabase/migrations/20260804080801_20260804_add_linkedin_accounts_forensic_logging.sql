-- ============================================================
-- Forensic logging for linkedin_accounts
-- Logs every INSERT, UPDATE, DELETE with full context
-- ============================================================

CREATE TABLE IF NOT EXISTS linkedin_accounts_forensic_log (
  id BIGSERIAL PRIMARY KEY,
  operation TEXT NOT NULL,
  account_id UUID,
  workspace_id UUID,
  old_data JSONB,
  new_data JSONB,
  changed_columns TEXT[],
  caller_query TEXT,
  caller_pid BIGINT,
  caller_user TEXT,
  caller_application TEXT,
  caller_addr TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_accounts_forensic_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_forensic_log" ON linkedin_accounts_forensic_log
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- ── INSERT trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_linkedin_accounts_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_pid BIGINT;
  v_user TEXT;
  v_app TEXT;
  v_addr TEXT;
  v_query TEXT;
BEGIN
  v_pid := pg_backend_pid();
  SELECT usename INTO v_user FROM pg_stat_activity WHERE pid = v_pid;
  SELECT application_name INTO v_app FROM pg_stat_activity WHERE pid = v_pid;
  SELECT client_addr::text INTO v_addr FROM pg_stat_activity WHERE pid = v_pid;
  SELECT query INTO v_query FROM pg_stat_activity WHERE pid = v_pid;

  INSERT INTO linkedin_accounts_forensic_log (
    operation, account_id, workspace_id, new_data,
    caller_query, caller_pid, caller_user, caller_application, caller_addr
  ) VALUES (
    'INSERT', NEW.id, NEW.workspace_id, to_jsonb(NEW),
    left(v_query, 5000), v_pid, v_user, v_app, v_addr
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── UPDATE trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_linkedin_accounts_update()
RETURNS TRIGGER AS $$
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
  WHERE to_jsonb(OLD)->>key IS DISTINCT FROM value;

  INSERT INTO linkedin_accounts_forensic_log (
    operation, account_id, workspace_id, old_data, new_data, changed_columns,
    caller_query, caller_pid, caller_user, caller_application, caller_addr
  ) VALUES (
    'UPDATE', NEW.id, NEW.workspace_id, to_jsonb(OLD), to_jsonb(NEW), v_changed,
    left(v_query, 5000), v_pid, v_user, v_app, v_addr
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── DELETE trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_linkedin_accounts_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_pid BIGINT;
  v_user TEXT;
  v_app TEXT;
  v_addr TEXT;
  v_query TEXT;
BEGIN
  v_pid := pg_backend_pid();
  SELECT usename INTO v_user FROM pg_stat_activity WHERE pid = v_pid;
  SELECT application_name INTO v_app FROM pg_stat_activity WHERE pid = v_pid;
  SELECT client_addr::text INTO v_addr FROM pg_stat_activity WHERE pid = v_pid;
  SELECT query INTO v_query FROM pg_stat_activity WHERE pid = v_pid;

  INSERT INTO linkedin_accounts_forensic_log (
    operation, account_id, workspace_id, old_data,
    caller_query, caller_pid, caller_user, caller_application, caller_addr
  ) VALUES (
    'DELETE', OLD.id, OLD.workspace_id, to_jsonb(OLD),
    left(v_query, 5000), v_pid, v_user, v_app, v_addr
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Drop old triggers if they exist, then create ──────────────

DROP TRIGGER IF EXISTS linkedin_accounts_forensic_insert ON linkedin_accounts;
CREATE TRIGGER linkedin_accounts_forensic_insert
  AFTER INSERT ON linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION log_linkedin_accounts_insert();

DROP TRIGGER IF EXISTS linkedin_accounts_forensic_update ON linkedin_accounts;
CREATE TRIGGER linkedin_accounts_forensic_update
  AFTER UPDATE ON linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION log_linkedin_accounts_update();

DROP TRIGGER IF EXISTS linkedin_accounts_forensic_delete ON linkedin_accounts;
CREATE TRIGGER linkedin_accounts_forensic_delete
  BEFORE DELETE ON linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION log_linkedin_accounts_delete();
