// ============================================================
// Enterprise Context Engine — Type Definitions
// ============================================================

// ============================================================
// Context Sources
// ============================================================

export type ContextSourceId =
  | 'knowledge_graph'
  | 'revenue_intelligence'
  | 'research_intelligence'
  | 'google_workspace'
  | 'crm'
  | 'linkedin'
  | 'firecrawl'
  | 'tavily'
  | 'documents'
  | 'emails'
  | 'calendar_events'
  | 'meetings'
  | 'tasks'
  | 'notes'
  | 'company_profile'
  | 'contacts'
  | 'past_ai_outputs'
  | 'user_preferences'
  | 'conversation_history'
  | 'memory_engine';

export type ContextSourceType = ContextSourceId | 'future_provider';

// ============================================================
// Context Types
// ============================================================

export type ContextType =
  | 'company'
  | 'prospect'
  | 'contact'
  | 'meeting'
  | 'task'
  | 'conversation'
  | 'outreach'
  | 'proposal'
  | 'custom';

export type ContextStatus = 'active' | 'stale' | 'archived' | 'error';

// ============================================================
// Context Fragment — A single piece of context from one source
// ============================================================

export type ContextFragment = {
  source: ContextSourceId;
  source_label: string;
  priority: ContextPriority;
  content: Record<string, unknown>;
  token_estimate: number;
  confidence: number;
  retrieved_at: string;
  metadata?: Record<string, unknown>;
};

// ============================================================
// Priority
// ============================================================

export type ContextPriority = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

// ============================================================
// Context Request
// ============================================================

export type ContextRequest = {
  contextType: ContextType;
  entityType?: string;
  entityId?: string;
  workspaceId?: string | null;
  tokenBudget?: number;
  sources?: ContextSourceId[];
  excludeSources?: ContextSourceId[];
  includeSystemContext?: boolean;
  includeBusinessContext?: boolean;
  userId?: string | null;
  conversationId?: string | null;
};

// ============================================================
// Assembled Context
// ============================================================

export type AssembledContext = {
  system: SystemContext;
  business?: BusinessContext;
  company?: CompanyContext;
  prospect?: ProspectContext;
  relationship?: RelationshipContext;
  research?: ResearchContext;
  revenue?: RevenueContext;
  task?: TaskContext;
  user?: UserContext;
  conversation?: ConversationContext;
  execution?: ExecutionContext;
  metadata: ContextMetadata;
};

export type SystemContext = {
  role: string;
  instructions: string;
  capabilities: string[];
  limitations: string[];
};

export type BusinessContext = {
  workspace_name: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  target_market: string[];
};

export type CompanyContext = {
  company_id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
  business_model: string | null;
  company_size: string | null;
  summary: string | null;
  technology_stack: string[];
  services: string[];
  products: string[];
  locations: string[];
  social_profiles: { platform: string; url: string }[];
  confidence_score: number | null;
};

export type ProspectContext = {
  company_name: string;
  contact_name: string | null;
  contact_title: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
};

export type RelationshipContext = {
  relationship_type: string;
  target_name: string;
  target_type: string;
  strength: number;
  history: { event: string; timestamp: string }[];
};

export type ResearchContext = {
  research_id: string | null;
  summary: string | null;
  key_findings: string[];
  buying_signals: { type: string; description: string; confidence: number }[];
  growth_signals: { type: string; description: string; confidence: number }[];
  technology_stack: { name: string; category: string }[];
  competitors: string[];
  confidence_score: number | null;
};

export type RevenueContext = {
  profile_id: string | null;
  overall_score: number;
  icp_score: number;
  opportunity_score: number;
  buying_intent_score: number;
  growth_score: number;
  risk_score: number;
  priority: string;
  recommended_action: string | null;
  recommendations: { type: string; title: string; description: string | null }[];
  signals: { type: string; description: string; strength: number }[];
};

export type TaskContext = {
  task_id: string | null;
  task_type: string;
  description: string;
  status: string;
  priority: string;
  deadline: string | null;
};

export type UserContext = {
  user_id: string | null;
  name: string | null;
  role: string | null;
  preferences: Record<string, unknown>;
};

export type ConversationContext = {
  conversation_id: string | null;
  history: { role: string; content: string; timestamp: string }[];
  summary: string | null;
};

export type ExecutionContext = {
  execution_id: string | null;
  agent_id: string | null;
  agent_type: string | null;
  current_step: string | null;
  previous_outputs: { agent: string; output: string }[];
};

export type ContextMetadata = {
  version: number;
  token_count: number;
  source_count: number;
  sources_used: ContextSourceId[];
  compression_ratio: number;
  quality_score: number;
  build_duration_ms: number;
  created_at: string;
};

// ============================================================
// Database Records
// ============================================================

export type ContextProfileRecord = {
  id: string;
  workspace_id: string | null;
  context_name: string;
  context_type: ContextType;
  entity_type: string | null;
  entity_id: string | null;
  version: number;
  status: ContextStatus;
  token_count: number;
  source_count: number;
  compression_ratio: number;
  quality_score: number;
  build_duration_ms: number | null;
  created_at: string;
  updated_at: string;
};

export type ContextSnapshotRecord = {
  id: string;
  workspace_id: string | null;
  context_profile_id: string;
  snapshot_version: number;
  assembled_context: AssembledContext;
  token_count: number;
  source_contributions: SourceContribution[];
  created_at: string;
};

export type ContextCacheRecord = {
  id: string;
  workspace_id: string | null;
  cache_key: string;
  entity_type: string | null;
  entity_id: string | null;
  context: AssembledContext;
  token_count: number;
  expires_at: string;
  created_at: string;
};

export type SourceContribution = {
  source: ContextSourceId;
  source_label: string;
  token_count: number;
  priority: ContextPriority;
  contribution_ratio: number;
};

// ============================================================
// Health & Monitoring
// ============================================================

export type ContextHealth = {
  healthy: boolean;
  total_profiles: number;
  active_profiles: number;
  stale_profiles: number;
  total_snapshots: number;
  cache_entries: number;
  cache_hit_rate: number;
  average_token_count: number;
  average_build_duration_ms: number;
  average_quality_score: number;
  average_compression_ratio: number;
  errors: string[];
};

export type ContextMonitorSummary = {
  total_profiles: number;
  active_profiles: number;
  stale_profiles: number;
  total_snapshots: number;
  cache_entries: number;
  cache_hit_rate: number;
  average_token_count: number;
  average_build_duration_ms: number;
  average_quality_score: number;
  average_compression_ratio: number;
  average_sources_used: number;
  context_type_distribution: Record<string, number>;
  source_usage: Record<string, number>;
};

// ============================================================
// Token Estimation
// ============================================================

export type TokenBudget = {
  max_tokens: number;
  allocated_tokens: number;
  used_tokens: number;
  remaining_tokens: number;
  fragments_dropped: number;
};
