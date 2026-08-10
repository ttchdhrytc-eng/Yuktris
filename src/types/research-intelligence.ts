// ============================================================
// Enterprise Research Intelligence Engine — Type Definitions
// ============================================================

// ============================================================
// Provider Types
// ============================================================

export type ResearchProviderId =
  | 'firecrawl'
  | 'tavily'
  | 'google'
  | 'linkedin'
  | 'schema'
  | 'technology'
  | 'whois'
  | 'opengraph'
  | 'social';

export type ProviderStatus = 'active' | 'degraded' | 'inactive' | 'error';

export type ProviderHealth = {
  provider: ResearchProviderId;
  status: ProviderStatus;
  healthy: boolean;
  latency_ms: number | null;
  last_checked: string | null;
  error: string | null;
  capabilities: ResearchCapability[];
};

export type ResearchCapability =
  | 'website_crawling'
  | 'company_research'
  | 'business_model_detection'
  | 'icp_identification'
  | 'technology_stack_detection'
  | 'seo_analysis'
  | 'content_analysis'
  | 'service_extraction'
  | 'industry_classification'
  | 'competitive_positioning'
  | 'location_detection'
  | 'decision_maker_discovery'
  | 'buying_signal_detection'
  | 'growth_signal_detection'
  | 'hiring_signal_detection'
  | 'funding_detection'
  | 'social_presence_detection'
  | 'contact_information_discovery'
  | 'brand_messaging_analysis';

// ============================================================
// Research Request
// ============================================================

export type ResearchRequestType =
  | 'company_profile'
  | 'technology_stack'
  | 'seo_analysis'
  | 'business_model'
  | 'buying_signals'
  | 'growth_signals'
  | 'full_intelligence'
  | 'refresh';

export type ResearchRequestStatus =
  | 'pending'
  | 'planning'
  | 'in_progress'
  | 'aggregating'
  | 'normalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ResearchRequestRecord = {
  id: string;
  workspace_id: string | null;
  company_name: string;
  website: string | null;
  request_type: ResearchRequestType;
  status: ResearchRequestStatus;
  provider: string | null;
  providers_used: string[];
  confidence_score: number | null;
  error_message: string | null;
  result_summary: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
};

// ============================================================
// Company Intelligence — Unified Output Model
// ============================================================

export type TechnologyItem = {
  name: string;
  category: string;
  confidence: number;
};

export type ServiceItem = {
  name: string;
  description: string;
  category: string;
};

export type ProductItem = {
  name: string;
  description: string;
  category: string;
};

export type TargetMarketItem = {
  segment: string;
  description: string;
};

export type SocialProfile = {
  platform: string;
  url: string;
  followers: number | null;
  verified: boolean;
};

export type ContactInformation = {
  email: string[];
  phone: string[];
  address: string[];
  linkedin: string | null;
  twitter: string | null;
};

export type BuyingSignal = {
  signal_type: string;
  description: string;
  confidence: number;
  source: string;
  detected_at: string;
};

export type GrowthSignal = {
  signal_type: string;
  description: string;
  confidence: number;
  source: string;
  detected_at: string;
};

export type DecisionMaker = {
  name: string;
  title: string;
  department: string;
  linkedin_url: string | null;
  confidence: number;
};

export type CompetitivePosition = {
  competitors: string[];
  differentiators: string[];
  market_position: string;
};

export type SEOSummary = {
  domain_authority: number | null;
  organic_keywords: number | null;
  organic_traffic: number | null;
  top_keywords: string[];
  backlinks: number | null;
};

export type CompanyIntelligenceRecord = {
  id: string;
  workspace_id: string | null;
  company_name: string;
  website: string | null;
  industry: string | null;
  sub_industry: string | null;
  business_model: string | null;
  company_size: string | null;
  locations: string[];
  summary: string | null;
  technology_stack: TechnologyItem[];
  services: ServiceItem[];
  products: ProductItem[];
  target_market: TargetMarketItem[];
  brand_positioning: string | null;
  seo_summary: SEOSummary;
  social_profiles: SocialProfile[];
  contact_information: ContactInformation;
  buying_signals: BuyingSignal[];
  growth_signals: GrowthSignal[];
  decision_makers: DecisionMaker[];
  competitive_positioning: CompetitivePosition;
  confidence_score: number | null;
  last_updated: string;
  created_at: string;
};

// ============================================================
// Research Sources
// ============================================================

export type ResearchSourceRecord = {
  id: string;
  company_intelligence_id: string;
  provider: ResearchProviderId;
  source_url: string | null;
  confidence_score: number | null;
  retrieved_at: string;
};

// ============================================================
// Research Pipeline Types
// ============================================================

export type ResearchPlan = {
  requestId: string;
  companyName: string;
  website: string | null;
  requestType: ResearchRequestType;
  providers: ResearchProviderId[];
  capabilities: ResearchCapability[];
  parallel: boolean;
  maxRetries: number;
};

export type ProviderResult = {
  provider: ResearchProviderId;
  success: boolean;
  data: Record<string, unknown>;
  confidence: number;
  latency_ms: number;
  error: string | null;
  source_url: string | null;
};

export type AggregatedResult = {
  results: ProviderResult[];
  successful: number;
  failed: number;
  totalConfidence: number;
  merged: Record<string, unknown>;
};

export type NormalizedIntelligence = {
  companyIntelligence: Partial<CompanyIntelligenceRecord>;
  sources: Omit<ResearchSourceRecord, 'id' | 'company_intelligence_id'>[];
  confidenceScore: number;
};

// ============================================================
// Provider Interface
// ============================================================

export type ResearchContext = {
  companyName: string;
  website: string | null;
  requestType: ResearchRequestType;
  capabilities: ResearchCapability[];
};

export interface IResearchProvider {
  readonly id: ResearchProviderId;
  readonly name: string;
  readonly capabilities: ResearchCapability[];

  initialize(): Promise<void>;
  validate(context: ResearchContext): boolean;
  research(context: ResearchContext): Promise<ProviderResult>;
  normalize(rawData: Record<string, unknown>): Partial<CompanyIntelligenceRecord>;
  healthCheck(): Promise<ProviderHealth>;
}

// ============================================================
// Monitoring
// ============================================================

export type ResearchMonitorSummary = {
  total_requests: number;
  pending_requests: number;
  in_progress_requests: number;
  completed_requests: number;
  failed_requests: number;
  total_intelligence_records: number;
  average_confidence_score: number;
  average_duration_ms: number;
  cache_hit_rate: number;
  failed_requests_count: number;
  provider_usage: Record<string, number>;
  provider_health: ProviderHealth[];
};

// ============================================================
// Cache
// ============================================================

export type CacheEntry<T> = {
  key: string;
  value: T;
  created_at: string;
  expires_at: string;
  version: number;
  confidence: number;
};

export type CacheStats = {
  total_entries: number;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  oldest_entry: string | null;
  newest_entry: string | null;
};

// ============================================================
// Events
// ============================================================

export type ResearchEventType =
  | 'research_started'
  | 'research_planned'
  | 'provider_selected'
  | 'provider_started'
  | 'provider_completed'
  | 'provider_failed'
  | 'research_aggregated'
  | 'research_normalized'
  | 'research_cached'
  | 'research_completed'
  | 'research_failed'
  | 'research_cancelled';

export type ResearchEvent = {
  type: ResearchEventType;
  requestId?: string;
  provider?: ResearchProviderId;
  data?: Record<string, unknown>;
  timestamp: string;
};

export type ResearchEventHandler = (event: ResearchEvent) => void;
