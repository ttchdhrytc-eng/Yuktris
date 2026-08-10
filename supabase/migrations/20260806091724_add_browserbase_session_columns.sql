-- Add Browserbase session tracking columns to linkedin_accounts
ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS browserbase_session_id text,
  ADD COLUMN IF NOT EXISTS browser_connected_at timestamptz;

-- Add updated_at trigger for linkedin_accounts if not present
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS linkedin_accounts_touch_updated_at ON linkedin_accounts;
CREATE TRIGGER linkedin_accounts_touch_updated_at
  BEFORE UPDATE ON linkedin_accounts
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();
