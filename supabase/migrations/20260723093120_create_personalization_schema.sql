/*
# Create Personalization Agent Schema

## Overview
Creates the complete database schema for the Personalization Agent.
This agent generates deep personalization intelligence for every decision
maker before outreach begins. It DOES NOT send messages or execute
LinkedIn automation — it only prepares structured personalization data
that future agents (Outreach Strategy, LinkedIn Execution, Conversation AI)
will consume.

It runs after all upstream agents complete: Business Intelligence, Market
Intelligence, ICP Intelligence, Prospect Discovery, Sales Navigator,
Company Research, Decision Maker Research, and Buying Intent.

## New Tables (6 total)

1. **personalization_profiles** — Main personalization record. Links to
   workspace, company, and contact. Stores personalization score,
   communication style, tone, value proposition, CTA strategy, and status.

2. **pain_points** — Pain point analysis per profile: category, description,
   priority, and confidence.

3. **opening_hooks** — Opening hooks per profile: hook type, hook text,
   and confidence.

4. **recommended_assets** — Recommended content assets per profile:
   asset type, title, URL, and priority.

5. **cta_recommendations** — CTA strategy per profile: CTA type, CTA text,
   and priority.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member() function.
- Child tables (2-5) scope through personalization_profiles using EXISTS subquery.
- 4 CRUD policies per table (select, insert, update, delete) — no FOR ALL.
- All policies use TO authenticated.

## Important Notes
1. personalization_profiles links to company_id and contact_id (loose references, no FKs).
2. All child tables cascade delete when a personalization_profiles record is deleted.
3. Indexes created on workspace_id, company_id, contact_id, profile_id, and status.
4. The updated_at trigger on personalization_profiles auto-updates the timestamp.
*/

-- ============================================================
-- 1. personalization_profiles (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS personalization_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid,
  contact_id uuid,
  personalization_score integer DEFAULT 0,
  communication_style text,
  tone text,
  value_proposition text,
  cta_strategy text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personalization_workspace_id ON personalization_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personalization_company_id ON personalization_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_personalization_contact_id ON personalization_profiles(contact_id);
CREATE INDEX IF NOT EXISTS idx_personalization_status ON personalization_profiles(status);

ALTER TABLE personalization_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_personalization" ON personalization_profiles;
CREATE POLICY "select_own_personalization" ON personalization_profiles FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_personalization" ON personalization_profiles;
CREATE POLICY "insert_own_personalization" ON personalization_profiles FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_personalization" ON personalization_profiles;
CREATE POLICY "update_own_personalization" ON personalization_profiles FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_personalization" ON personalization_profiles;
CREATE POLICY "delete_own_personalization" ON personalization_profiles FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. pain_points
-- ============================================================

CREATE TABLE IF NOT EXISTS pain_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES personalization_profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  confidence integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pain_points_profile_id ON pain_points(profile_id);
CREATE INDEX IF NOT EXISTS idx_pain_points_category ON pain_points(category);

ALTER TABLE pain_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pain_points" ON pain_points;
CREATE POLICY "select_own_pain_points" ON pain_points FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = pain_points.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_pain_points" ON pain_points;
CREATE POLICY "insert_own_pain_points" ON pain_points FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = pain_points.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_pain_points" ON pain_points;
CREATE POLICY "update_own_pain_points" ON pain_points FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = pain_points.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = pain_points.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_pain_points" ON pain_points;
CREATE POLICY "delete_own_pain_points" ON pain_points FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = pain_points.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

-- ============================================================
-- 3. opening_hooks
-- ============================================================

CREATE TABLE IF NOT EXISTS opening_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES personalization_profiles(id) ON DELETE CASCADE,
  hook_type text NOT NULL,
  hook_text text,
  confidence integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opening_hooks_profile_id ON opening_hooks(profile_id);

ALTER TABLE opening_hooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_opening_hooks" ON opening_hooks;
CREATE POLICY "select_own_opening_hooks" ON opening_hooks FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = opening_hooks.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_opening_hooks" ON opening_hooks;
CREATE POLICY "insert_own_opening_hooks" ON opening_hooks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = opening_hooks.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_opening_hooks" ON opening_hooks;
CREATE POLICY "update_own_opening_hooks" ON opening_hooks FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = opening_hooks.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = opening_hooks.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_opening_hooks" ON opening_hooks;
CREATE POLICY "delete_own_opening_hooks" ON opening_hooks FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = opening_hooks.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

-- ============================================================
-- 4. recommended_assets
-- ============================================================

CREATE TABLE IF NOT EXISTS recommended_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES personalization_profiles(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  title text,
  url text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommended_assets_profile_id ON recommended_assets(profile_id);

ALTER TABLE recommended_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recommended_assets" ON recommended_assets;
CREATE POLICY "select_own_recommended_assets" ON recommended_assets FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = recommended_assets.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_recommended_assets" ON recommended_assets;
CREATE POLICY "insert_own_recommended_assets" ON recommended_assets FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = recommended_assets.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_recommended_assets" ON recommended_assets;
CREATE POLICY "update_own_recommended_assets" ON recommended_assets FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = recommended_assets.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = recommended_assets.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_recommended_assets" ON recommended_assets;
CREATE POLICY "delete_own_recommended_assets" ON recommended_assets FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = recommended_assets.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

-- ============================================================
-- 5. cta_recommendations
-- ============================================================

CREATE TABLE IF NOT EXISTS cta_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES personalization_profiles(id) ON DELETE CASCADE,
  cta_type text NOT NULL,
  cta_text text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cta_recommendations_profile_id ON cta_recommendations(profile_id);

ALTER TABLE cta_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cta_recommendations" ON cta_recommendations;
CREATE POLICY "select_own_cta_recommendations" ON cta_recommendations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = cta_recommendations.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_cta_recommendations" ON cta_recommendations;
CREATE POLICY "insert_own_cta_recommendations" ON cta_recommendations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = cta_recommendations.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_cta_recommendations" ON cta_recommendations;
CREATE POLICY "update_own_cta_recommendations" ON cta_recommendations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = cta_recommendations.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = cta_recommendations.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_cta_recommendations" ON cta_recommendations;
CREATE POLICY "delete_own_cta_recommendations" ON cta_recommendations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM personalization_profiles WHERE personalization_profiles.id = cta_recommendations.profile_id AND is_workspace_member(personalization_profiles.workspace_id))
  );

-- ============================================================
-- Trigger: auto-update updated_at on personalization_profiles
-- ============================================================

CREATE OR REPLACE FUNCTION update_personalization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_personalization_updated_at ON personalization_profiles;
CREATE TRIGGER trigger_personalization_updated_at
  BEFORE UPDATE ON personalization_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_personalization_updated_at();