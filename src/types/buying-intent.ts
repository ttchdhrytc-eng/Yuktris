// ============================================================
// Buying Intent Agent — Types
// ============================================================

export type IntentStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type IntentLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export type SignalPriority = 'low' | 'medium' | 'high' | 'critical';

export type SignalType =
  | 'hiring'
  | 'funding'
  | 'expansion'
  | 'technology'
  | 'website'
  | 'leadership'
  | 'product'
  | 'partnership'
  | 'acquisition'
  | 'revenue'
  | 'employee_growth'
  | 'market'
  | 'digital'
  | 'competitive'
  | 'security'
  | 'infrastructure';

// ============================================================
// Main Records
// ============================================================

export type BuyingIntentAnalysis = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  research_id: string | null;
  intent_score: number;
  opportunity_score: number;
  urgency_score: number;
  confidence_score: number;
  intent_level: IntentLevel;
  buying_window: string | null;
  recommended_priority: SignalPriority;
  status: IntentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type IntentSignal = {
  id: string;
  analysis_id: string;
  signal_name: string;
  signal_type: SignalType;
  signal_value: string | null;
  signal_weight: number;
  confidence: number;
  priority: SignalPriority;
  created_at: string;
};

export type StakeholderSignal = {
  id: string;
  analysis_id: string;
  contact_id: string | null;
  activity_score: number;
  engagement_score: number;
  influence_score: number;
  buying_readiness: number;
  created_at: string;
};

export type IntentPrediction = {
  id: string;
  analysis_id: string;
  purchase_probability: number;
  estimated_deal_size: string | null;
  estimated_sales_cycle: string | null;
  expected_close_rate: number;
  risk_score: number;
  created_at: string;
};

export type IntentRecommendation = {
  id: string;
  analysis_id: string;
  recommendation: string;
  priority: SignalPriority;
  reason: string | null;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullBuyingIntentAnalysis = BuyingIntentAnalysis & {
  signals: IntentSignal[];
  stakeholder_signals: StakeholderSignal[];
  prediction: IntentPrediction | null;
  recommendations: IntentRecommendation[];
};

// ============================================================
// Pipeline Stages
// ============================================================

export type IntentStage =
  | 'loading_research'
  | 'collecting_signals'
  | 'analyzing_companies'
  | 'analyzing_stakeholders'
  | 'calculating_scores'
  | 'predicting_intent'
  | 'generating_recommendations'
  | 'saving_results';

export type IntentStageInfo = {
  stage: IntentStage;
  label: string;
  description: string;
};

export type IntentTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// AI Recommendations Summary
// ============================================================

export type IntentAIRecommendations = {
  executive_summary: string;
  why_this_prospect: string;
  recommended_messaging_theme: string;
  recommended_contact_order: string[];
  recommended_outreach_time: string;
  expected_outcome: string;
};

// ============================================================
// Priority Queue Entry
// ============================================================

export type PriorityQueueEntry = {
  rank: number;
  company: string;
  primary_contact: string;
  intent_score: number;
  opportunity_score: number;
  recommended_action: string;
  recommended_timing: string;
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

export type OpenAIIntentResult = {
  intent_score: number;
  intent_level: IntentLevel;
  buying_window: string;
  reasoning: string;
};

export type FirecrawlSignalResult = {
  url: string;
  change_type: string;
  content_diff: string;
  detected_at: string;
};

export type TavilyNewsResult = {
  title: string;
  source: string;
  date: string;
  summary: string;
  url: string;
};

export type LinkedInActivityResult = {
  contact_name: string;
  activity_level: 'high' | 'medium' | 'low';
  posts: number;
  engagement: number;
};

export type ApolloContactSignalResult = {
  contact_name: string;
  job_change: boolean;
  promotion: boolean;
  new_company: string | null;
};

export type CrunchbaseFundingResult = {
  round: string;
  amount: string;
  date: string;
  investors: string[];
};

export type BuiltWithTechChangeResult = {
  technology: string;
  change_type: 'added' | 'removed';
  category: string;
  detected_at: string;
};
