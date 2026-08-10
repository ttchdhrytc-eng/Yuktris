/*
# Create Decision Maker Research Agent Schema

## Overview
Creates the complete database schema for the Decision Maker Research Agent.
This agent identifies, researches, enriches, scores, and maps every relevant
stakeholder inside a target company. It runs after the Company Research Agent
and the Sales Navigator Intelligence Agent complete.

## New Tables (6 total)

1. **decision_maker_research** — Main research record. Links to workspace and a company.
   Tracks research status, research score, and confidence score.

2. **contacts** — Individual decision maker records linked to a research run:
   first name, last name, LinkedIn URL, email, phone, job title, department,
   seniority, buying role, decision power, activity/influence/relationship scores,
   outreach readiness, and priority.

3. **contact_profiles** — Extended professional information for each contact:
   location, years in current role, years at company, education, skills,
   certifications, and previous companies.

4. **linkedin_activity** — LinkedIn activity metrics per contact:
   post frequency, engagement score, thought leadership score, primary topics, last active.

5. **buying_committee** — Buying committee mapping per research run:
   economic buyer, technical buyer, champion, influencer, evaluator, blocker, procurement.
   Each field stores a contact name (or multiple names).

6. **recommendations** — AI-generated outreach recommendations per contact:
   recommendation text, priority, and reason.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member() function.
- Child tables (2-6) scope through decision_maker_research using EXISTS subquery,
  except contact_profiles, linkedin_activity, and recommendations which scope
  through contacts, which in turn scopes through decision_maker_research.
- 4 CRUD policies per table (select, insert, update, delete) — no FOR ALL.
- All policies use TO authenticated.

## Important Notes
1. decision_maker_research links to company_research via company_id (loose reference, no FK).
2. contacts cascade delete when a decision_maker_research record is deleted.
3. contact_profiles, linkedin_activity, and recommendations cascade delete when a contact is deleted.
4. buying_committee cascade deletes when a decision_maker_research record is deleted.
5. Indexes created on workspace_id, company_id, research_id, contact_id, and status for query performance.
6. The updated_at trigger on decision_maker_research auto-updates the timestamp.
*/

-- ============================================================
-- 1. decision_maker_research (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS decision_maker_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  research_score integer DEFAULT 0,
  confidence_score integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_research_workspace_id ON decision_maker_research(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dm_research_company_id ON decision_maker_research(company_id);
CREATE INDEX IF NOT EXISTS idx_dm_research_status ON decision_maker_research(status);

ALTER TABLE decision_maker_research ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_dm_research" ON decision_maker_research;
CREATE POLICY "select_own_dm_research" ON decision_maker_research FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_dm_research" ON decision_maker_research;
CREATE POLICY "insert_own_dm_research" ON decision_maker_research FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_dm_research" ON decision_maker_research;
CREATE POLICY "update_own_dm_research" ON decision_maker_research FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_dm_research" ON decision_maker_research;
CREATE POLICY "delete_own_dm_research" ON decision_maker_research FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. contacts
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES decision_maker_research(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  linkedin_url text,
  email text,
  phone text,
  job_title text,
  department text,
  seniority text,
  buying_role text CHECK (buying_role IN ('economic_buyer', 'technical_buyer', 'champion', 'influencer', 'evaluator', 'blocker', 'procurement', 'end_user', 'unknown')),
  decision_power integer DEFAULT 0,
  activity_score integer DEFAULT 0,
  influence_score integer DEFAULT 0,
  relationship_score integer DEFAULT 0,
  outreach_readiness integer DEFAULT 0,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'researched' CHECK (status IN ('researched', 'saved', 'ignored')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_research_id ON contacts(research_id);
CREATE INDEX IF NOT EXISTS idx_contacts_buying_role ON contacts(buying_role);
CREATE INDEX IF NOT EXISTS idx_contacts_seniority ON contacts(seniority);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_contacts" ON contacts;
CREATE POLICY "select_own_contacts" ON contacts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = contacts.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_contacts" ON contacts;
CREATE POLICY "insert_own_contacts" ON contacts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = contacts.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_contacts" ON contacts;
CREATE POLICY "update_own_contacts" ON contacts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = contacts.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = contacts.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_contacts" ON contacts;
CREATE POLICY "delete_own_contacts" ON contacts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = contacts.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  );

-- ============================================================
-- 3. contact_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  location text,
  years_current_role text,
  years_company text,
  education text[] DEFAULT '{}',
  skills text[] DEFAULT '{}',
  certifications text[] DEFAULT '{}',
  previous_companies text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_profiles_contact_id ON contact_profiles(contact_id);

ALTER TABLE contact_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_contact_profiles" ON contact_profiles;
CREATE POLICY "select_own_contact_profiles" ON contact_profiles FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = contact_profiles.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_contact_profiles" ON contact_profiles;
CREATE POLICY "insert_own_contact_profiles" ON contact_profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = contact_profiles.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "update_own_contact_profiles" ON contact_profiles;
CREATE POLICY "update_own_contact_profiles" ON contact_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = contact_profiles.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = contact_profiles.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "delete_own_contact_profiles" ON contact_profiles;
CREATE POLICY "delete_own_contact_profiles" ON contact_profiles FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = contact_profiles.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

-- ============================================================
-- 4. linkedin_activity
-- ============================================================

CREATE TABLE IF NOT EXISTS linkedin_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  post_frequency text,
  engagement_score integer DEFAULT 0,
  thought_leadership_score integer DEFAULT 0,
  primary_topics text[] DEFAULT '{}',
  last_active text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_activity_contact_id ON linkedin_activity(contact_id);

ALTER TABLE linkedin_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_activity" ON linkedin_activity;
CREATE POLICY "select_own_linkedin_activity" ON linkedin_activity FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = linkedin_activity.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_linkedin_activity" ON linkedin_activity;
CREATE POLICY "insert_own_linkedin_activity" ON linkedin_activity FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = linkedin_activity.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "update_own_linkedin_activity" ON linkedin_activity;
CREATE POLICY "update_own_linkedin_activity" ON linkedin_activity FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = linkedin_activity.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = linkedin_activity.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "delete_own_linkedin_activity" ON linkedin_activity;
CREATE POLICY "delete_own_linkedin_activity" ON linkedin_activity FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = linkedin_activity.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

-- ============================================================
-- 5. buying_committee
-- ============================================================

CREATE TABLE IF NOT EXISTS buying_committee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES decision_maker_research(id) ON DELETE CASCADE,
  economic_buyer text,
  technical_buyer text,
  champion text,
  influencer text,
  evaluator text,
  blocker text,
  procurement text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buying_committee_research_id ON buying_committee(research_id);

ALTER TABLE buying_committee ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_buying_committee" ON buying_committee;
CREATE POLICY "select_own_buying_committee" ON buying_committee FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = buying_committee.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_buying_committee" ON buying_committee;
CREATE POLICY "insert_own_buying_committee" ON buying_committee FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = buying_committee.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_buying_committee" ON buying_committee;
CREATE POLICY "update_own_buying_committee" ON buying_committee FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = buying_committee.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = buying_committee.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_buying_committee" ON buying_committee;
CREATE POLICY "delete_own_buying_committee" ON buying_committee FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM decision_maker_research WHERE decision_maker_research.id = buying_committee.research_id AND is_workspace_member(decision_maker_research.workspace_id))
  );

-- ============================================================
-- 6. recommendations
-- ============================================================

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  recommendation text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_contact_id ON recommendations(contact_id);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recommendations" ON recommendations;
CREATE POLICY "select_own_recommendations" ON recommendations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = recommendations.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_recommendations" ON recommendations;
CREATE POLICY "insert_own_recommendations" ON recommendations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = recommendations.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "update_own_recommendations" ON recommendations;
CREATE POLICY "update_own_recommendations" ON recommendations FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = recommendations.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = recommendations.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

DROP POLICY IF EXISTS "delete_own_recommendations" ON recommendations;
CREATE POLICY "delete_own_recommendations" ON recommendations FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM contacts
      JOIN decision_maker_research ON decision_maker_research.id = contacts.research_id
      WHERE contacts.id = recommendations.contact_id AND is_workspace_member(decision_maker_research.workspace_id)
    )
  );

-- ============================================================
-- Trigger: auto-update updated_at on decision_maker_research
-- ============================================================

CREATE OR REPLACE FUNCTION update_dm_research_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_dm_research_updated_at ON decision_maker_research;
CREATE TRIGGER trigger_dm_research_updated_at
  BEFORE UPDATE ON decision_maker_research
  FOR EACH ROW
  EXECUTE FUNCTION update_dm_research_updated_at();