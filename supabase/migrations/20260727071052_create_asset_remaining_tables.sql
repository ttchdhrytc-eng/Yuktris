-- Asset-Tag junction table
CREATE TABLE IF NOT EXISTS asset_tag_map (
  asset_id uuid NOT NULL REFERENCES proposal_assets(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES asset_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);

CREATE INDEX idx_asset_tag_map_asset_id ON asset_tag_map(asset_id);
CREATE INDEX idx_asset_tag_map_tag_id ON asset_tag_map(tag_id);

ALTER TABLE asset_tag_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_asset_tag_map" ON asset_tag_map
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_asset_tag_map" ON asset_tag_map
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "delete_asset_tag_map" ON asset_tag_map
  FOR DELETE TO authenticated USING (true);

-- Asset Versions
CREATE TABLE IF NOT EXISTS asset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES proposal_assets(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  content_text text,
  change_summary text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_versions_workspace_id ON asset_versions(workspace_id);
CREATE INDEX idx_asset_versions_asset_id ON asset_versions(asset_id);
CREATE INDEX idx_asset_versions_created_at ON asset_versions(created_at DESC);

ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_asset_versions" ON asset_versions
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "insert_asset_versions" ON asset_versions
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "update_asset_versions" ON asset_versions
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "delete_asset_versions" ON asset_versions
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- Asset Relationships
CREATE TABLE IF NOT EXISTS asset_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  source_asset_id uuid NOT NULL REFERENCES proposal_assets(id) ON DELETE CASCADE,
  target_asset_id uuid NOT NULL REFERENCES proposal_assets(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN (
    'RELATED_TO', 'DEPENDS_ON', 'COMPLEMENTS', 'ALTERNATIVE_TO', 'SUPERSEDES', 'DERIVED_FROM'
  )),
  strength numeric NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_relationships_workspace_id ON asset_relationships(workspace_id);
CREATE INDEX idx_asset_relationships_source ON asset_relationships(source_asset_id);
CREATE INDEX idx_asset_relationships_target ON asset_relationships(target_asset_id);
CREATE UNIQUE INDEX idx_asset_relationships_unique ON asset_relationships(source_asset_id, target_asset_id, relationship_type);

ALTER TABLE asset_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_asset_relationships" ON asset_relationships
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "insert_asset_relationships" ON asset_relationships
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "update_asset_relationships" ON asset_relationships
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "delete_asset_relationships" ON asset_relationships
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- Asset Usage History
CREATE TABLE IF NOT EXISTS asset_usage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES proposal_assets(id) ON DELETE CASCADE,
  proposal_version_id uuid REFERENCES proposal_versions(id) ON DELETE SET NULL,
  usage_context text,
  personalization_applied jsonb DEFAULT '{}',
  used_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_usage_history_workspace_id ON asset_usage_history(workspace_id);
CREATE INDEX idx_asset_usage_history_asset_id ON asset_usage_history(asset_id);
CREATE INDEX idx_asset_usage_history_created_at ON asset_usage_history(created_at DESC);

ALTER TABLE asset_usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_asset_usage_history" ON asset_usage_history
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "insert_asset_usage_history" ON asset_usage_history
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "delete_asset_usage_history" ON asset_usage_history
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- Asset Reviews
CREATE TABLE IF NOT EXISTS asset_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES proposal_assets(id) ON DELETE CASCADE,
  reviewer_id uuid,
  reviewer_name text,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_reviews_workspace_id ON asset_reviews(workspace_id);
CREATE INDEX idx_asset_reviews_asset_id ON asset_reviews(asset_id);
CREATE INDEX idx_asset_reviews_status ON asset_reviews(review_status);

ALTER TABLE asset_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_asset_reviews" ON asset_reviews
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "insert_asset_reviews" ON asset_reviews
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "update_asset_reviews" ON asset_reviews
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "delete_asset_reviews" ON asset_reviews
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- Asset Ratings
CREATE TABLE IF NOT EXISTS asset_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES proposal_assets(id) ON DELETE CASCADE,
  rater_id uuid,
  rater_name text,
  rating numeric NOT NULL CHECK (rating >= 0 AND rating <= 5),
  review text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_ratings_workspace_id ON asset_ratings(workspace_id);
CREATE INDEX idx_asset_ratings_asset_id ON asset_ratings(asset_id);

ALTER TABLE asset_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_asset_ratings" ON asset_ratings
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "insert_asset_ratings" ON asset_ratings
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "update_asset_ratings" ON asset_ratings
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "delete_asset_ratings" ON asset_ratings
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));