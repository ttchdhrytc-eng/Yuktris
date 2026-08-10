/*
# Phase 21.8 — Add missing columns to pre-existing linkedin_accounts table

The pre-existing linkedin_accounts table from earlier phases has different
column names than what Phase 21.2 expected. This migration adds the missing
columns needed by the new LinkedInSessionManager and related services.

## Changes
- Adds linkedin_email, account_name, profile_name, profile_headline, profile_picture_url
- Adds session_status, last_login_at, daily_profile_visit_limit, hourly_action_limit
- Adds connections_today, messages_today, profile_visits_today, actions_this_hour
- Adds last_limit_reset_at
- Adds metadata column if not present
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'linkedin_email') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN linkedin_email text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'account_name') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN account_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'profile_name') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN profile_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'profile_headline') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN profile_headline text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'profile_picture_url') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN profile_picture_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'session_status') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN session_status text NOT NULL DEFAULT 'disconnected';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'last_login_at') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'daily_profile_visit_limit') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN daily_profile_visit_limit int NOT NULL DEFAULT 80;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'hourly_action_limit') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN hourly_action_limit int NOT NULL DEFAULT 15;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'connections_today') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN connections_today int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'messages_today') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN messages_today int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'profile_visits_today') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN profile_visits_today int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'actions_this_hour') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN actions_this_hour int NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'last_limit_reset_at') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN last_limit_reset_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_accounts' AND column_name = 'metadata') THEN
    ALTER TABLE linkedin_accounts ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Backfill account_name from display_name if empty
UPDATE linkedin_accounts SET account_name = display_name WHERE account_name IS NULL AND display_name IS NOT NULL;
