// ============================================================
// Enterprise Proposal Intelligence Engine — Type Definitions
// ============================================================

// ============================================================
// Proposal Types
// ============================================================

export type ProposalType =
  | 'executive'
  | 'sales'
  | 'seo'
  | 'google_ads'
  | 'meta_ads'
  | 'linkedin_ads'
  | 'digital_marketing'
  | 'website'
  | 'software'
  | 'ai_solution'
  | 'custom';

export type ProposalStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'sent' | 'archived';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type SectionType =
  | 'executive_summary'
  | 'company_overview'
  | 'problem_analysis'
  | 'business_objectives'
  | 'pain_points'
  | 'recommended_strategy'
  | 'recommended_deliverables'
  | 'solution_recommendation'
  | 'implementation_roadmap'
  | 'timeline'
  | 'pricing'
  | 'expected_roi'
  | 'risk_assessment'
  | 'competitive_differentiation'
  | 'case_studies'
  | 'team_recommendation'
  | 'faqs'
  | 'call_to_action';

// ============================================================
// Export Formats
// ============================================================

export type ExportFormat = 'html' | 'pdf' | 'docx' | 'markdown' | 'json' | 'presentation';

// ============================================================
// Pricing
// ============================================================

export type PricingModel = 'one_time' | 'monthly' | 'quarterly' | 'annual' | 'milestone' | 'retainer' | 'performance';

export type PricingLineItem = {
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  category: string;
};

export type PricingRecommendation = {
  model: PricingModel;
  line_items: PricingLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  payment_terms: string;
  valid_until: string;
  rationale: string;
};

// ============================================================
// ROI
// ============================================================

export type ROIEstimation = {
  investment: number;
  projected_revenue: number;
  projected_cost_savings: number;
  projected_efficiency_gain: number;
  total_projected_value: number;
  roi_percentage: number;
  payback_period_months: number;
  assumptions: string[];
  confidence: number;
};

// ============================================================
// Strategy
// ============================================================

export type ProposalStrategy = {
  approach: string;
  primary_objectives: string[];
  key_differentiators: string[];
  risk_factors: string[];
  success_metrics: { metric: string; target: string; timeframe: string }[];
  competitive_positioning: string;
  recommended_timeline_weeks: number;
};

// ============================================================
// Pain Points
// ============================================================

export type PainPoint = {
  pain_point: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  evidence: string;
  proposed_solution: string;
};

// ============================================================
// Solution Recommendation
// ============================================================

export type SolutionRecommendation = {
  service_name: string;
  description: string;
  rationale: string;
  deliverables: string[];
  timeline_weeks: number;
  dependencies: string[];
  priority: Priority;
};

// ============================================================
// Implementation Roadmap
// ============================================================

export type RoadmapPhase = {
  phase: string;
  title: string;
  description: string;
  duration_weeks: number;
  deliverables: string[];
  milestones: string[];
  dependencies: string[];
};

// ============================================================
// Risk Assessment
// ============================================================

export type RiskAssessment = {
  overall_risk: 'low' | 'medium' | 'high';
  risks: { risk: string; probability: number; impact: number; mitigation: string }[];
  assumptions: string[];
};

// ============================================================
// Case Study
// ============================================================

export type CaseStudyRecommendation = {
  title: string;
  client: string;
  industry: string;
  challenge: string;
  solution: string;
  results: string[];
  relevance: string;
};

// ============================================================
// Team Recommendation
// ============================================================

export type TeamRecommendation = {
  role: string;
  responsibility: string;
  allocation: string;
  expertise: string;
};

// ============================================================
// Competitive Differentiation
// ============================================================

export type CompetitiveDifferentiation = {
  competitor: string;
  their_approach: string;
  our_advantage: string;
  key_difference: string;
};

// ============================================================
// Proposal Content (full assembled proposal)
// ============================================================

export type ProposalContent = {
  strategy: ProposalStrategy;
  executive_summary: string;
  company_overview: string;
  problem_analysis: PainPoint[];
  business_objectives: string[];
  recommended_strategy: string;
  solution_recommendations: SolutionRecommendation[];
  implementation_roadmap: RoadmapPhase[];
  timeline: { phase: string; start_week: number; end_week: number; milestone: string }[];
  pricing: PricingRecommendation;
  roi: ROIEstimation;
  risk_assessment: RiskAssessment;
  competitive_differentiation: CompetitiveDifferentiation[];
  case_studies: CaseStudyRecommendation[];
  team_recommendation: TeamRecommendation[];
  faqs: { question: string; answer: string }[];
  call_to_action: string;
};

// ============================================================
// Database Records
// ============================================================

export type ProposalProjectRecord = {
  id: string;
  workspace_id: string | null;
  company_id: string;
  project_name: string;
  proposal_type: ProposalType;
  status: ProposalStatus;
  priority: Priority;
  strategy: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProposalVersionRecord = {
  id: string;
  workspace_id: string | null;
  proposal_project_id: string;
  version_number: number;
  content: ProposalContent;
  executive_summary: string | null;
  problem_analysis: PainPoint[];
  solution_recommendation: SolutionRecommendation[];
  implementation_roadmap: RoadmapPhase[];
  risk_assessment: RiskAssessment;
  competitive_differentiation: CompetitiveDifferentiation[];
  roi_estimation: ROIEstimation;
  team_recommendation: TeamRecommendation[];
  case_studies: CaseStudyRecommendation[];
  token_count: number;
  generation_duration_ms: number | null;
  is_latest: boolean;
  created_by: string | null;
  created_at: string;
};

export type ProposalSectionRecord = {
  id: string;
  workspace_id: string | null;
  proposal_version_id: string;
  section_type: SectionType;
  title: string;
  content: Record<string, unknown>;
  display_order: number;
  is_visible: boolean;
  created_at: string;
};

export type ProposalPricingRecord = {
  id: string;
  workspace_id: string | null;
  proposal_version_id: string;
  pricing_model: PricingModel;
  line_items: PricingLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  payment_terms: string | null;
  valid_until: string | null;
  created_at: string;
};

export type ProposalAssetRecord = {
  id: string;
  workspace_id: string | null;
  proposal_version_id: string;
  asset_type: ExportFormat;
  asset_url: string | null;
  content: string | null;
  file_size: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ProposalReviewRecord = {
  id: string;
  workspace_id: string | null;
  proposal_version_id: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  review_status: 'pending' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';
  review_notes: string | null;
  section_feedback: { section: string; feedback: string }[];
  overall_score: number;
  created_at: string;
  updated_at: string;
};

export type ProposalApprovalRecord = {
  id: string;
  workspace_id: string | null;
  proposal_version_id: string;
  approver_id: string | null;
  approver_name: string | null;
  approval_status: 'pending' | 'approved' | 'rejected' | 'conditionally_approved';
  approval_notes: string | null;
  conditions: string[];
  approved_at: string | null;
  created_at: string;
};

export type ProposalTemplateRecord = {
  id: string;
  workspace_id: string | null;
  template_name: string;
  proposal_type: ProposalType;
  sections: { section_type: SectionType; title: string; display_order: number }[];
  styling: Record<string, unknown>;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Generation Request
// ============================================================

export type ProposalGenerateRequest = {
  companyId: string;
  proposalType: ProposalType;
  projectName?: string;
  workspaceId?: string | null;
  priority?: Priority;
  templateId?: string | null;
  customInstructions?: string;
};

// ============================================================
// Generation Result
// ============================================================

export type ProposalGenerationResult = {
  projectId: string;
  versionId: string;
  versionNumber: number;
  content: ProposalContent;
  tokenCount: number;
  durationMs: number;
};

// ============================================================
// Health
// ============================================================

export type ProposalHealth = {
  healthy: boolean;
  total_projects: number;
  total_versions: number;
  draft_count: number;
  in_review_count: number;
  approved_count: number;
  sent_count: number;
  rejected_count: number;
  total_assets: number;
  total_reviews: number;
  total_approvals: number;
  errors: string[];
};

export type ProposalMonitorSummary = {
  total_projects: number;
  total_versions: number;
  status_distribution: Record<string, number>;
  type_distribution: Record<string, number>;
  total_assets: number;
  total_reviews: number;
  total_approvals: number;
  pending_approvals: number;
  average_generation_duration_ms: number;
  average_token_count: number;
  recent_projects: ProposalProjectRecord[];
};
