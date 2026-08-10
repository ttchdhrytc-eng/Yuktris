/*
# Revenue AI - Core Database Schema

## Overview
Creates the full production schema for Revenue AI, an Autonomous Revenue Operating System.
Multi-tenant architecture: users belong to workspaces, and all business data is scoped to a workspace.

## New Tables
1. workspaces — Top-level tenant
2. workspace_members — Join table (auth.users <-> workspaces) with roles
3. linkedin_accounts — Connected LinkedIn accounts
4. companies — Target companies/accounts
5. prospects — Individual contacts being targeted
6. campaigns — Outreach campaigns
7. campaign_prospects — Join: prospects in campaigns
8. messages — Messages sent/received
9. meetings — Booked meetings
10. ai_agents — AI agent configurations per workspace
11. settings — Workspace-level settings
12. api_keys — API keys for integrations
13. integrations — Connected third-party integrations
14. analytics_events — Time-series analytics

## Security (RLS)
- RLS on ALL tables, scoped to workspace membership via is_workspace_member() function.
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE), TO authenticated.
*/

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  industry text,
  country text,
  timezone text DEFAULT 'UTC',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION (now workspace_members exists)
-- ============================================================
CREATE OR REPLACE FUNCTION is_workspace_member(check_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = check_workspace_id
    AND workspace_members.user_id = auth.uid()
  );
$$;

-- ============================================================
-- LINKEDIN ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_url text,
  display_name text,
  headline text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE linkedin_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text,
  industry text,
  size text,
  country text,
  linkedin_url text,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROSPECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  title text,
  email text,
  linkedin_url text,
  phone text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'replied', 'meeting_booked', 'qualified', 'disqualified')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CAMPAIGN PROSPECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'removed')),
  added_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, prospect_id)
);
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('sent', 'received')),
  channel text NOT NULL DEFAULT 'linkedin' CHECK (channel IN ('linkedin', 'email', 'other')),
  subject text,
  body text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'replied', 'failed')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- MEETINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  location text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AI AGENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_type text NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'running', 'error')),
  config jsonb DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, agent_type)
);
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, key)
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- API KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text,
  provider text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INTEGRATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  config jsonb DEFAULT '{}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, provider)
);
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_companies_ws ON companies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospects_ws ON prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_ws ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_ws ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_prospect ON messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_meetings_ws ON meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ai_agents_ws ON ai_agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_ws ON analytics_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_integrations_ws ON integrations(workspace_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- WORKSPACES
DROP POLICY IF EXISTS "select_own_workspaces" ON workspaces;
CREATE POLICY "select_own_workspaces" ON workspaces FOR SELECT
  TO authenticated USING (is_workspace_member(id));
DROP POLICY IF EXISTS "insert_own_workspaces" ON workspaces;
CREATE POLICY "insert_own_workspaces" ON workspaces FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_own_workspaces" ON workspaces;
CREATE POLICY "update_own_workspaces" ON workspaces FOR UPDATE
  TO authenticated USING (is_workspace_member(id)) WITH CHECK (is_workspace_member(id));
DROP POLICY IF EXISTS "delete_own_workspaces" ON workspaces;
CREATE POLICY "delete_own_workspaces" ON workspaces FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND role = 'owner')
  );

-- WORKSPACE MEMBERS
DROP POLICY IF EXISTS "select_own_members" ON workspace_members;
CREATE POLICY "select_own_members" ON workspace_members FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_members" ON workspace_members;
CREATE POLICY "insert_own_members" ON workspace_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  );
DROP POLICY IF EXISTS "update_own_members" ON workspace_members;
CREATE POLICY "update_own_members" ON workspace_members FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  );
DROP POLICY IF EXISTS "delete_own_members" ON workspace_members;
CREATE POLICY "delete_own_members" ON workspace_members FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin'))
  );

-- LINKEDIN ACCOUNTS
DROP POLICY IF EXISTS "select_ws_linkedin" ON linkedin_accounts;
CREATE POLICY "select_ws_linkedin" ON linkedin_accounts FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_linkedin" ON linkedin_accounts;
CREATE POLICY "insert_ws_linkedin" ON linkedin_accounts FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_linkedin" ON linkedin_accounts;
CREATE POLICY "update_ws_linkedin" ON linkedin_accounts FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_linkedin" ON linkedin_accounts;
CREATE POLICY "delete_ws_linkedin" ON linkedin_accounts FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- COMPANIES
DROP POLICY IF EXISTS "select_ws_companies" ON companies;
CREATE POLICY "select_ws_companies" ON companies FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_companies" ON companies;
CREATE POLICY "insert_ws_companies" ON companies FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_companies" ON companies;
CREATE POLICY "update_ws_companies" ON companies FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_companies" ON companies;
CREATE POLICY "delete_ws_companies" ON companies FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- PROSPECTS
DROP POLICY IF EXISTS "select_ws_prospects" ON prospects;
CREATE POLICY "select_ws_prospects" ON prospects FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_prospects" ON prospects;
CREATE POLICY "insert_ws_prospects" ON prospects FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_prospects" ON prospects;
CREATE POLICY "update_ws_prospects" ON prospects FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_prospects" ON prospects;
CREATE POLICY "delete_ws_prospects" ON prospects FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- CAMPAIGNS
DROP POLICY IF EXISTS "select_ws_campaigns" ON campaigns;
CREATE POLICY "select_ws_campaigns" ON campaigns FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_campaigns" ON campaigns;
CREATE POLICY "insert_ws_campaigns" ON campaigns FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_campaigns" ON campaigns;
CREATE POLICY "update_ws_campaigns" ON campaigns FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_campaigns" ON campaigns;
CREATE POLICY "delete_ws_campaigns" ON campaigns FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- CAMPAIGN PROSPECTS
DROP POLICY IF EXISTS "select_cp" ON campaign_prospects;
CREATE POLICY "select_cp" ON campaign_prospects FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_prospects.campaign_id AND is_workspace_member(campaigns.workspace_id))
  );
DROP POLICY IF EXISTS "insert_cp" ON campaign_prospects;
CREATE POLICY "insert_cp" ON campaign_prospects FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_prospects.campaign_id AND is_workspace_member(campaigns.workspace_id))
  );
DROP POLICY IF EXISTS "update_cp" ON campaign_prospects;
CREATE POLICY "update_cp" ON campaign_prospects FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_prospects.campaign_id AND is_workspace_member(campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_prospects.campaign_id AND is_workspace_member(campaigns.workspace_id))
  );
DROP POLICY IF EXISTS "delete_cp" ON campaign_prospects;
CREATE POLICY "delete_cp" ON campaign_prospects FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_prospects.campaign_id AND is_workspace_member(campaigns.workspace_id))
  );

-- MESSAGES
DROP POLICY IF EXISTS "select_ws_messages" ON messages;
CREATE POLICY "select_ws_messages" ON messages FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_messages" ON messages;
CREATE POLICY "insert_ws_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_messages" ON messages;
CREATE POLICY "update_ws_messages" ON messages FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_messages" ON messages;
CREATE POLICY "delete_ws_messages" ON messages FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- MEETINGS
DROP POLICY IF EXISTS "select_ws_meetings" ON meetings;
CREATE POLICY "select_ws_meetings" ON meetings FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_meetings" ON meetings;
CREATE POLICY "insert_ws_meetings" ON meetings FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_meetings" ON meetings;
CREATE POLICY "update_ws_meetings" ON meetings FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_meetings" ON meetings;
CREATE POLICY "delete_ws_meetings" ON meetings FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- AI AGENTS
DROP POLICY IF EXISTS "select_ws_ai_agents" ON ai_agents;
CREATE POLICY "select_ws_ai_agents" ON ai_agents FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_ai_agents" ON ai_agents;
CREATE POLICY "insert_ws_ai_agents" ON ai_agents FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_ai_agents" ON ai_agents;
CREATE POLICY "update_ws_ai_agents" ON ai_agents FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_ai_agents" ON ai_agents;
CREATE POLICY "delete_ws_ai_agents" ON ai_agents FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- SETTINGS
DROP POLICY IF EXISTS "select_ws_settings" ON settings;
CREATE POLICY "select_ws_settings" ON settings FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_settings" ON settings;
CREATE POLICY "insert_ws_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_settings" ON settings;
CREATE POLICY "update_ws_settings" ON settings FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_settings" ON settings;
CREATE POLICY "delete_ws_settings" ON settings FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- API KEYS
DROP POLICY IF EXISTS "select_ws_api_keys" ON api_keys;
CREATE POLICY "select_ws_api_keys" ON api_keys FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_api_keys" ON api_keys;
CREATE POLICY "insert_ws_api_keys" ON api_keys FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_api_keys" ON api_keys;
CREATE POLICY "update_ws_api_keys" ON api_keys FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_api_keys" ON api_keys;
CREATE POLICY "delete_ws_api_keys" ON api_keys FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- INTEGRATIONS
DROP POLICY IF EXISTS "select_ws_integrations" ON integrations;
CREATE POLICY "select_ws_integrations" ON integrations FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_integrations" ON integrations;
CREATE POLICY "insert_ws_integrations" ON integrations FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_integrations" ON integrations;
CREATE POLICY "update_ws_integrations" ON integrations FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_integrations" ON integrations;
CREATE POLICY "delete_ws_integrations" ON integrations FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ANALYTICS EVENTS
DROP POLICY IF EXISTS "select_ws_analytics" ON analytics_events;
CREATE POLICY "select_ws_analytics" ON analytics_events FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_analytics" ON analytics_events;
CREATE POLICY "insert_ws_analytics" ON analytics_events FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_analytics" ON analytics_events;
CREATE POLICY "update_ws_analytics" ON analytics_events FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_analytics" ON analytics_events;
CREATE POLICY "delete_ws_analytics" ON analytics_events FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_workspaces_updated_at ON workspaces;
CREATE TRIGGER trigger_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_settings_updated_at ON settings;
CREATE TRIGGER trigger_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();