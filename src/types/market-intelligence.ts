// ============================================================
// Market Intelligence Agent — Types
// ============================================================

export type MarketStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type CompetitionLevel = 'low' | 'medium' | 'high' | 'very_high';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'transformative';

export type MarketAnalysis = {
  id: string;
  workspace_id: string;
  business_analysis_id: string | null;
  market_status: MarketStatus;
  market_size: string | null;
  growth_score: number;
  competition_score: number;
  opportunity_score: number;
  confidence_score: number;
  recommended_strategy: string | null;
  executive_summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type IndustryAnalysis = {
  id: string;
  market_analysis_id: string;
  industry_name: string;
  market_size: string | null;
  growth_rate: string | null;
  competition_level: CompetitionLevel;
  opportunity_score: number;
  priority: Priority;
  recommended: boolean;
};

export type CountryAnalysis = {
  id: string;
  market_analysis_id: string;
  country: string;
  market_size: string | null;
  competition: CompetitionLevel;
  language: string | null;
  buying_power: number;
  opportunity_score: number;
  recommended: boolean;
};

export type CompetitorAnalysis = {
  id: string;
  market_analysis_id: string;
  competitor: string;
  website: string | null;
  pricing_model: string | null;
  market_position: string | null;
  strengths: string[];
  weaknesses: string[];
  market_share: string | null;
};

export type TrendAnalysis = {
  id: string;
  market_analysis_id: string;
  trend: string;
  impact: ImpactLevel;
  opportunity: string | null;
  confidence: number;
};

export type BuyingSignal = {
  id: string;
  market_analysis_id: string;
  signal_name: string;
  description: string | null;
  priority: Priority;
  confidence: number;
};

export type FullMarketAnalysis = MarketAnalysis & {
  industries: IndustryAnalysis[];
  countries: CountryAnalysis[];
  competitors: CompetitorAnalysis[];
  trends: TrendAnalysis[];
  signals: BuyingSignal[];
};

export type MarketStage =
  | 'industry_research'
  | 'country_research'
  | 'competitor_research'
  | 'trend_research'
  | 'signal_research'
  | 'opportunity_scoring'
  | 'strategy_generation'
  | 'finalizing';

export type MarketStageInfo = {
  stage: MarketStage;
  label: string;
  description: string;
};

export type MarketTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// Service Interface Types
// ============================================================

export type MarketInsightResult = {
  industries: Omit<IndustryAnalysis, 'id' | 'market_analysis_id'>[];
  countries: Omit<CountryAnalysis, 'id' | 'market_analysis_id'>[];
  competitors: Omit<CompetitorAnalysis, 'id' | 'market_analysis_id'>[];
  trends: Omit<TrendAnalysis, 'id' | 'market_analysis_id'>[];
  signals: Omit<BuyingSignal, 'id' | 'market_analysis_id'>[];
};

export type StrategyResult = {
  recommendedIndustries: string[];
  recommendedCountries: string[];
  recommendedCompanySizes: string[];
  recommendedSalesStrategy: string;
  recommendedPositioning: string;
  recommendedMessaging: string;
  recommendedStrategy: string;
  executiveSummary: string;
};

export type IndustryResearch = {
  name: string;
  marketSize: string;
  growthRate: string;
  keyPlayers: string[];
  trends: string[];
};

export type CompetitorResearch = {
  name: string;
  website: string;
  pricing: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
};

export type CountryResearch = {
  country: string;
  marketSize: string;
  language: string;
  buyingPower: number;
  competition: CompetitionLevel;
};

export type MarketTrendResearch = {
  trend: string;
  impact: ImpactLevel;
  description: string;
  affectedIndustries: string[];
};

export type BuyingSignalResearch = {
  signal: string;
  description: string;
  priority: Priority;
  confidence: number;
};

export type EconomicData = {
  region: string;
  gdpGrowth: string;
  businessConfidence: string;
  techAdoption: string;
};
