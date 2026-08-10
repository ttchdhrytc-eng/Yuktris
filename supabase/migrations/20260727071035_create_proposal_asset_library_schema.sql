-- Drop and recreate proposal_assets with all indexes and policies
DROP TABLE IF EXISTS proposal_assets CASCADE;

CREATE TABLE proposal_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  category_id uuid REFERENCES asset_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  asset_type text NOT NULL CHECK (asset_type IN (
    'service_description', 'industry_template', 'proposal_template', 'case_study',
    'client_testimonial', 'success_story', 'pricing_model', 'pricing_package',
    'pricing_rule', 'implementation_plan', 'project_timeline', 'team_profile',
    'certification', 'award', 'partnership', 'faq', 'legal_terms', 'terms_conditions',
    'contract', 'sow_template', 'proposal_section', 'email_template', 'executive_summary',
    'call_to_action', 'visual_asset', 'image', 'icon', 'logo', 'brand_guideline',
    'video', 'attachment', 'whitepaper', 'brochure', 'product_sheet', 'roi_model',
    'business_value_statement', 'competitive_advantage', 'feature_list', 'technology_stack',
    'methodology', 'compliance_document'
  )),
  industry text,
  service text,
  content jsonb NOT NULL DEFAULT '{}',
  content_text text,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'expired')),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'in_review', 'approved', 'rejected')),
  owner text,
  version integer NOT NULL DEFAULT 1,
  confidence_score numeric NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  expiration_date date,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_assets_workspace_id ON proposal_assets(workspace_id);
CREATE INDEX idx_proposal_assets_category_id ON proposal_assets(category_id);
CREATE INDEX idx_proposal_assets_asset_type ON proposal_assets(asset_type);
CREATE INDEX idx_proposal_assets_industry ON proposal_assets(industry);
CREATE INDEX idx_proposal_assets_service ON proposal_assets(service);
CREATE INDEX idx_proposal_assets_status ON proposal_assets(status);
CREATE INDEX idx_proposal_assets_approval_status ON proposal_assets(approval_status);
CREATE INDEX idx_proposal_assets_usage_count ON proposal_assets(usage_count DESC);
CREATE INDEX idx_proposal_assets_confidence ON proposal_assets(confidence_score DESC);
CREATE INDEX idx_proposal_assets_updated_at ON proposal_assets(updated_at DESC);
CREATE INDEX idx_proposal_assets_content ON proposal_assets USING GIN (content);
CREATE INDEX idx_proposal_assets_content_text ON proposal_assets USING GIN (to_tsvector('english', coalesce(content_text, '')));
CREATE INDEX idx_proposal_assets_title ON proposal_assets USING GIN (to_tsvector('english', coalesce(title, '')));

ALTER TABLE proposal_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_proposal_assets" ON proposal_assets
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "insert_proposal_assets" ON proposal_assets
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "update_proposal_assets" ON proposal_assets
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

CREATE POLICY "delete_proposal_assets" ON proposal_assets
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_proposal_assets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_proposal_assets_updated_at
  BEFORE UPDATE ON proposal_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_assets_updated_at();

-- Trigger for asset_categories updated_at
CREATE OR REPLACE FUNCTION public.update_asset_categories_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_asset_categories_updated_at
  BEFORE UPDATE ON asset_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_categories_updated_at();