// ============================================================
// Revenue Intelligence Engine — Service Index
// ============================================================

export { revenueIntelligenceEngine } from './RevenueIntelligenceEngine';
export { icpScoringService } from './ICPScoringService';
export { buyingSignalEngine } from './BuyingSignalEngine';
export { growthSignalEngine } from './GrowthSignalEngine';
export { technologyFitEngine } from './TechnologyFitEngine';
export { serviceFitEngine } from './ServiceFitEngine';
export { opportunityScoringEngine } from './OpportunityScoringEngine';
export { riskAnalysisEngine } from './RiskAnalysisEngine';
export { recommendationEngine } from './RecommendationEngine';
export { accountPrioritizationEngine } from './AccountPrioritizationEngine';
export { nextBestActionEngine } from './NextBestActionEngine';

export type {
  SignalType,
  SignalSource,
  IntelligenceSignal,
  ScoreResult,
  ScoreFactor,
  RevenueScores,
  Priority,
  RevenueProfileRecord,
  RevenueRecommendationRecord,
  RecommendationType,
  RecommendationStatus,
  CompanyIntelligenceInput,
  ICPDefinition,
  AnalysisContext,
  AnalysisResult,
  RevenueMonitorSummary,
  RevenueHealth,
} from '@/types/revenue-intelligence';
