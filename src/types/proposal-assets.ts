// ============================================================
// Enterprise Proposal Asset Library — Type Definitions
// ============================================================

// ============================================================
// Asset Types
// ============================================================

export type AssetType =
  | 'service_description' | 'industry_template' | 'proposal_template' | 'case_study'
  | 'client_testimonial' | 'success_story' | 'pricing_model' | 'pricing_package'
  | 'pricing_rule' | 'implementation_plan' | 'project_timeline' | 'team_profile'
  | 'certification' | 'award' | 'partnership' | 'faq' | 'legal_terms' | 'terms_conditions'
  | 'contract' | 'sow_template' | 'proposal_section' | 'email_template' | 'executive_summary'
  | 'call_to_action' | 'visual_asset' | 'image' | 'icon' | 'logo' | 'brand_guideline'
  | 'video' | 'attachment' | 'whitepaper' | 'brochure' | 'product_sheet' | 'roi_model'
  | 'business_value_statement' | 'competitive_advantage' | 'feature_list' | 'technology_stack'
  | 'methodology' | 'compliance_document';

export type AssetStatus = 'draft' | 'active' | 'archived' | 'expired';
export type ApprovalStatus = 'pending' | 'in_review' | 'approved' | 'rejected';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export type AssetRelationshipType =
  | 'RELATED_TO' | 'DEPENDS_ON' | 'COMPLEMENTS' | 'ALTERNATIVE_TO' | 'SUPERSEDES' | 'DERIVED_FROM';

// ============================================================
// Database Records
// ============================================================

export type ProposalAssetRecord = {
  id: string;
  workspace_id: string | null;
  category_id: string | null;
  title: string;
  description: string | null;
  asset_type: AssetType;
  industry: string | null;
  service: string | null;
  content: Record<string, unknown>;
  content_text: string | null;
  language: string;
  status: AssetStatus;
  approval_status: ApprovalStatus;
  owner: string | null;
  version: number;
  confidence_score: number;
  usage_count: number;
  last_used_at: string | null;
  expiration_date: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetCategoryRecord = {
  id: string;
  workspace_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AssetTagRecord = {
  id: string;
  workspace_id: string | null;
  name: string;
  slug: string;
  color: string;
  created_at: string;
};

export type AssetVersionRecord = {
  id: string;
  workspace_id: string | null;
  asset_id: string;
  version_number: number;
  content: Record<string, unknown>;
  content_text: string | null;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
};

export type AssetRelationshipRecord = {
  id: string;
  workspace_id: string | null;
  source_asset_id: string;
  target_asset_id: string;
  relationship_type: AssetRelationshipType;
  strength: number;
  created_at: string;
};

export type AssetUsageHistoryRecord = {
  id: string;
  workspace_id: string | null;
  asset_id: string;
  proposal_version_id: string | null;
  usage_context: string | null;
  personalization_applied: Record<string, unknown>;
  used_by: string | null;
  created_at: string;
};

export type AssetReviewRecord = {
  id: string;
  workspace_id: string | null;
  asset_id: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  review_status: ReviewStatus;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetRatingRecord = {
  id: string;
  workspace_id: string | null;
  asset_id: string;
  rater_id: string | null;
  rater_name: string | null;
  rating: number;
  review: string | null;
  created_at: string;
};

// ============================================================
// Asset with joined data
// ============================================================

export type AssetWithRelations = ProposalAssetRecord & {
  category?: AssetCategoryRecord | null;
  tags?: AssetTagRecord[];
  relationships?: AssetRelationshipRecord[];
  average_rating?: number;
  rating_count?: number;
};

// ============================================================
// Search
// ============================================================

export type AssetSearchRequest = {
  query?: string;
  assetType?: AssetType;
  industry?: string;
  service?: string;
  categoryId?: string;
  tagIds?: string[];
  status?: AssetStatus;
  approvalStatus?: ApprovalStatus;
  minConfidence?: number;
  limit?: number;
  workspaceId?: string | null;
};

export type AssetSearchResult = {
  asset: ProposalAssetRecord;
  score: number;
  matched_fields: string[];
};

// ============================================================
// Create / Update
// ============================================================

export type AssetCreateRequest = {
  title: string;
  description?: string;
  assetType: AssetType;
  industry?: string;
  service?: string;
  content?: Record<string, unknown>;
  contentText?: string;
  categoryId?: string | null;
  tagIds?: string[];
  language?: string;
  owner?: string;
  confidenceScore?: number;
  expirationDate?: string | null;
  workspaceId?: string | null;
  createdBy?: string;
};

export type AssetUpdateRequest = {
  title?: string;
  description?: string;
  content?: Record<string, unknown>;
  contentText?: string;
  categoryId?: string | null;
  tagIds?: string[];
  industry?: string;
  service?: string;
  status?: AssetStatus;
  owner?: string;
  confidenceScore?: number;
  expirationDate?: string | null;
  updatedBy?: string;
};

// ============================================================
// Analytics
// ============================================================

export type AssetAnalytics = {
  total_assets: number;
  active_assets: number;
  archived_assets: number;
  expired_assets: number;
  pending_approval: number;
  approved_assets: number;
  total_usage: number;
  average_confidence: number;
  average_rating: number;
  type_distribution: Record<string, number>;
  industry_distribution: Record<string, number>;
  most_used: { id: string; title: string; usage_count: number; asset_type: string }[];
  least_used: { id: string; title: string; usage_count: number; asset_type: string }[];
  top_rated: { id: string; title: string; average_rating: number; asset_type: string }[];
  unused_assets: number;
  duplicate_candidates: { primary_id: string; duplicate_id: string; similarity: number }[];
};

// ============================================================
// Health
// ============================================================

export type AssetLibraryHealth = {
  healthy: boolean;
  total_assets: number;
  active_assets: number;
  pending_approval: number;
  expired_assets: number;
  total_categories: number;
  total_tags: number;
  total_versions: number;
  total_relationships: number;
  total_usage_events: number;
  average_confidence: number;
  average_rating: number;
  errors: string[];
};

// ============================================================
// Recommendations
// ============================================================

export type AssetRecommendation = {
  asset: ProposalAssetRecord;
  relevance_score: number;
  reason: string;
};

export type AssetRecommendationRequest = {
  proposalType?: string;
  industry?: string;
  service?: string;
  assetTypes?: AssetType[];
  limit?: number;
  workspaceId?: string | null;
};
