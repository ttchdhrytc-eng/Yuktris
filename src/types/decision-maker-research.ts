// ============================================================
// Decision Maker Research Agent — Types
// ============================================================

export type DMResearchStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type BuyingRole =
  | 'economic_buyer'
  | 'technical_buyer'
  | 'champion'
  | 'influencer'
  | 'evaluator'
  | 'blocker'
  | 'procurement'
  | 'end_user'
  | 'unknown';

export type ContactPriority = 'low' | 'medium' | 'high' | 'critical';

export type ContactStatus = 'researched' | 'saved' | 'ignored';

// ============================================================
// Main Records
// ============================================================

export type DecisionMakerResearch = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  status: DMResearchStatus;
  research_score: number;
  confidence_score: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  research_id: string;
  first_name: string;
  last_name: string;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  buying_role: BuyingRole;
  decision_power: number;
  activity_score: number;
  influence_score: number;
  relationship_score: number;
  outreach_readiness: number;
  priority: ContactPriority;
  status: ContactStatus;
  created_at: string;
};

export type ContactProfile = {
  id: string;
  contact_id: string;
  location: string | null;
  years_current_role: string | null;
  years_company: string | null;
  education: string[];
  skills: string[];
  certifications: string[];
  previous_companies: string[];
  created_at: string;
};

export type LinkedInActivity = {
  id: string;
  contact_id: string;
  post_frequency: string | null;
  engagement_score: number;
  thought_leadership_score: number;
  primary_topics: string[];
  last_active: string | null;
  created_at: string;
};

export type BuyingCommittee = {
  id: string;
  research_id: string;
  economic_buyer: string | null;
  technical_buyer: string | null;
  champion: string | null;
  influencer: string | null;
  evaluator: string | null;
  blocker: string | null;
  procurement: string | null;
  created_at: string;
};

export type Recommendation = {
  id: string;
  contact_id: string;
  recommendation: string;
  priority: ContactPriority;
  reason: string | null;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullContact = Contact & {
  profile: ContactProfile | null;
  linkedin_activity: LinkedInActivity | null;
  recommendation: Recommendation | null;
};

export type FullDecisionMakerResearch = DecisionMakerResearch & {
  contacts: FullContact[];
  buying_committee: BuyingCommittee | null;
};

// ============================================================
// Pipeline Stages
// ============================================================

export type DMResearchStage =
  | 'loading_company'
  | 'identifying_committee'
  | 'identifying_decision_makers'
  | 'researching_profiles'
  | 'analyzing_activity'
  | 'calculating_scores'
  | 'generating_recommendations'
  | 'saving_results';

export type DMResearchStageInfo = {
  stage: DMResearchStage;
  label: string;
  description: string;
};

export type DMResearchTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// AI Recommendations Summary
// ============================================================

export type DMRecommendations = {
  executive_summary: string;
  primary_contact: string;
  secondary_contacts: string[];
  recommended_outreach_order: string[];
  recommended_communication_style: string;
  recommended_next_action: string;
};

// ============================================================
// Export Types
// ============================================================

export type ExportFormat = 'json' | 'csv';

export type ExportConfig = {
  format: ExportFormat;
  data: string;
  filename: string;
};

// ============================================================
// Service Interface Types (for future API integrations)
// ============================================================

export type LinkedInProfileResult = {
  name: string;
  headline: string;
  location: string;
  connections: number;
  activity_level: 'high' | 'medium' | 'low';
};

export type ApolloEnrichmentResult = {
  email: string | null;
  phone: string | null;
  verified: boolean;
};

export type ClearbitPersonResult = {
  name: string;
  title: string;
  seniority: string;
  company: string;
};

export type TavilyPersonResult = {
  name: string;
  source: string;
  summary: string;
  url: string;
};

export type OpenAIAnalysisResult = {
  buying_role: BuyingRole;
  influence_score: number;
  outreach_readiness: number;
  reasoning: string;
};
