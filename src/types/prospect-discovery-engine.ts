// ============================================================
// Prospect Discovery Engine Types — Phase 6
// ============================================================

export type DiscoveryJobType = 'company_discovery' | 'contact_discovery' | 'enrichment' | 'scoring' | 'full_pipeline';
export type DiscoveryJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type SignalType =
  | 'buying_intent' | 'growth' | 'technology' | 'hiring' | 'market'
  | 'executive' | 'funding' | 'expansion' | 'product_launch' | 'leadership_change'
  | 'vendor_change' | 'compliance_change' | 'merger_acquisition';
export type ProviderType =
  | 'linkedin' | 'sales_navigator' | 'apollo' | 'zoominfo' | 'clearbit'
  | 'crunchbase' | 'people_data_labs' | 'hunter' | 'rocketreach'
  | 'firecrawl' | 'tavily' | 'ai_gateway';
export type SyncLogStatus = 'success' | 'failed' | 'partial' | 'rate_limited';
export type SyncOperation = 'company_search' | 'company_enrich' | 'contact_search' | 'contact_enrich' | 'signal_detection' | 'scoring';

// ============================================================
// Database Record Types
// ============================================================

export interface Company {
  id: string;
  workspace_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  country: string | null;
  linkedin_url: string | null;
  description: string | null;
  employee_count: string | null;
  estimated_revenue: string | null;
  headquarters: string | null;
  funding_stage: string | null;
  growth_score: number;
  market_score: number;
  opportunity_score: number;
  confidence_score: number;
  growth_stage: string | null;
  hiring_activity: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyLocation {
  id: string;
  company_id: string;
  workspace_id: string;
  location_type: 'headquarters' | 'office' | 'regional' | 'subsidiary';
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface CompanyTechnology {
  id: string;
  company_id: string;
  workspace_id: string;
  technology_name: string;
  category: string | null;
  subcategory: string | null;
  confidence_score: number;
  detected_at: string;
  created_at: string;
}

export interface CompanySignal {
  id: string;
  company_id: string;
  workspace_id: string;
  signal_type: SignalType;
  signal_data: Record<string, unknown>;
  signal_strength: number;
  signal_source: string | null;
  detected_at: string;
  confidence_score: number;
  created_at: string;
}

export interface Contact {
  id: string;
  workspace_id: string | null;
  company_id: string | null;
  research_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string | null;
  linkedin_url: string | null;
  email: string | null;
  public_email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  buying_role: string | null;
  decision_power: number | null;
  activity_score: number | null;
  influence_score: number | null;
  relationship_score: number | null;
  outreach_readiness: number | null;
  priority: string | null;
  status: string | null;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface ContactProfile {
  id: string;
  contact_id: string;
  workspace_id: string | null;
  location: string | null;
  years_current_role: string | null;
  years_company: string | null;
  education: string[];
  skills: string[];
  certifications: string[];
  previous_companies: string[];
  personal_summary: string | null;
  public_activity: Record<string, unknown>;
  recent_posts: unknown[];
  recent_news: unknown[];
  website_signals: unknown[];
  buying_signals: unknown[];
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface ContactSocialProfile {
  id: string;
  contact_id: string;
  workspace_id: string;
  platform: 'linkedin' | 'twitter' | 'github' | 'facebook' | 'instagram' | 'youtube' | 'other';
  profile_url: string | null;
  username: string | null;
  follower_count: number | null;
  post_frequency: string | null;
  last_active: string | null;
  confidence_score: number;
  created_at: string;
}

export interface ContactSkill {
  id: string;
  contact_id: string;
  workspace_id: string;
  skill_name: string;
  skill_category: string | null;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  confidence_score: number;
  created_at: string;
}

export interface ProspectScore {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  company_score: number;
  decision_maker_score: number;
  relationship_score: number;
  reply_probability: number;
  meeting_probability: number;
  revenue_probability: number;
  overall_prospect_score: number;
  scoring_factors: Record<string, unknown>;
  ai_explanation: string | null;
  confidence_score: number;
  scored_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProspectRecommendation {
  id: string;
  workspace_id: string | null;
  company_id: string;
  contact_id: string | null;
  recommendation: string;
  priority: string | null;
  reason: string | null;
  why_company: string | null;
  why_person: string | null;
  why_now: string | null;
  reply_probability: number | null;
  meeting_probability: number | null;
  suggested_campaign: string | null;
  suggested_messaging_angle: string | null;
  suggested_cta: string | null;
  recommended_persona: string | null;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface ProspectList {
  id: string;
  workspace_id: string;
  list_name: string;
  description: string | null;
  filter_criteria: Record<string, unknown>;
  member_count: number;
  is_dynamic: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProspectListMember {
  id: string;
  prospect_list_id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  added_at: string;
  created_at: string;
}

export interface DiscoveryJob {
  id: string;
  workspace_id: string;
  revenue_strategy_id: string | null;
  job_type: DiscoveryJobType;
  status: DiscoveryJobStatus;
  provider_used: string | null;
  search_criteria: Record<string, unknown>;
  companies_found: number;
  contacts_found: number;
  duplicates_merged: number;
  crm_matches: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderSource {
  id: string;
  workspace_id: string;
  provider_name: string;
  provider_type: ProviderType;
  is_active: boolean;
  api_key_configured: boolean;
  rate_limit_remaining: number | null;
  rate_limit_reset_at: string | null;
  last_used_at: string | null;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  capabilities: string[];
  created_at: string;
  updated_at: string;
}

export interface ProviderSyncLog {
  id: string;
  workspace_id: string;
  provider_source_id: string | null;
  provider_name: string;
  operation: SyncOperation;
  status: SyncLogStatus;
  request_params: Record<string, unknown>;
  response_summary: Record<string, unknown>;
  records_returned: number;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
}

// ============================================================
// Composite Types
// ============================================================

export interface CompanyWithDetails extends Company {
  locations: CompanyLocation[];
  technologies: CompanyTechnology[];
  signals: CompanySignal[];
  score: ProspectScore | null;
  recommendation: ProspectRecommendation | null;
}

export interface ContactWithDetails extends Contact {
  profile: ContactProfile | null;
  social_profiles: ContactSocialProfile[];
  skills: ContactSkill[];
  score: ProspectScore | null;
  recommendation: ProspectRecommendation | null;
  company: { id: string; name: string; industry: string | null } | null;
}

export interface DiscoveryDashboard {
  totalCompanies: number;
  totalContacts: number;
  totalQualified: number;
  avgScore: number;
  activeJobs: number;
  providersActive: number;
  recentJobs: DiscoveryJob[];
  topCompanies: CompanyWithDetails[];
  topContacts: ContactWithDetails[];
}

export interface SmartFilters {
  industry?: string;
  companySize?: string;
  revenue?: string;
  country?: string;
  state?: string;
  city?: string;
  technology?: string;
  hiring?: boolean;
  funding?: string;
  buyingSignals?: string[];
  growthStage?: string;
  replyProbability?: number;
  meetingProbability?: number;
  minScore?: number;
  persona?: string;
  department?: string;
  title?: string;
  crmStatus?: string;
  campaignStatus?: string;
}

// ============================================================
// Provider Interface
// ============================================================

export interface DiscoveryProviderDefinition {
  id: ProviderType;
  name: string;
  capabilities: ProviderCapability[];
  rateLimitPerHour: number;
  requiresApiKey: boolean;
}

export interface ProviderCapability {
  type: 'company_search' | 'company_enrich' | 'contact_search' | 'contact_enrich' | 'signal_detection';
  supported: boolean;
}

export interface CompanySearchParams {
  industry?: string;
  companySize?: string;
  revenue?: string;
  geography?: string;
  technologies?: string[];
  growthStage?: string;
  hiringActivity?: boolean;
  fundingStage?: string;
  limit?: number;
}

export interface CompanySearchResult {
  name: string;
  website?: string;
  industry?: string;
  employee_count?: string;
  estimated_revenue?: string;
  headquarters?: string;
  country?: string;
  description?: string;
  funding_stage?: string;
  growth_stage?: string;
  technologies?: string[];
  confidence: number;
  source: ProviderType;
}

export interface ContactSearchParams {
  company_id?: string;
  company_name?: string;
  roles?: string[];
  seniority?: string[];
  limit?: number;
}

export interface ContactSearchResult {
  first_name: string;
  last_name: string;
  full_name?: string;
  job_title?: string;
  department?: string;
  seniority?: string;
  linkedin_url?: string;
  public_email?: string;
  confidence: number;
  source: ProviderType;
}

export interface EnrichmentResult {
  personal_summary?: string;
  years_at_company?: string;
  previous_companies?: string[];
  education?: string[];
  skills?: string[];
  technologies?: string[];
  public_activity?: Record<string, unknown>;
  recent_posts?: unknown[];
  recent_news?: unknown[];
  website_signals?: unknown[];
  buying_signals?: unknown[];
  confidence: number;
}

export interface IDiscoveryProvider {
  definition: DiscoveryProviderDefinition;
  searchCompanies(params: CompanySearchParams): Promise<CompanySearchResult[]>;
  enrichCompany(domain: string): Promise<Partial<CompanySearchResult>>;
  searchContacts(params: ContactSearchParams): Promise<ContactSearchResult[]>;
  enrichContact(contactId: string): Promise<EnrichmentResult>;
  detectSignals(companyName: string, website?: string): Promise<{ type: SignalType; data: Record<string, unknown>; strength: number }[]>;
}

// ============================================================
// AI Scoring Types
// ============================================================

export interface ProspectScoringInput {
  company: { name: string; industry?: string; size?: string; revenue?: string; growth_score?: number; market_score?: number };
  contact?: { job_title?: string; department?: string; seniority?: string; influence_score?: number; activity_score?: number };
  signals: { type: SignalType; strength: number }[];
  revenueStrategy?: { best_icp?: Record<string, unknown>; confidence_score?: number };
}

export interface ProspectScoringResult {
  company_score: number;
  decision_maker_score: number;
  relationship_score: number;
  reply_probability: number;
  meeting_probability: number;
  revenue_probability: number;
  overall_prospect_score: number;
  scoring_factors: Record<string, unknown>;
  ai_explanation: string;
  confidence: number;
}

export interface AIRecommendation {
  why_company: string;
  why_person: string;
  why_now: string;
  reply_probability: number;
  meeting_probability: number;
  suggested_campaign: string;
  suggested_messaging_angle: string;
  suggested_cta: string;
  recommended_persona: string;
  confidence: number;
}
