// ============================================================
// Enterprise Proposal Intelligence Engine — Service Index
// ============================================================

export { proposalEngine } from './ProposalEngine';
export { proposalStrategyEngine } from './ProposalStrategyEngine';
export { proposalBuilder } from './ProposalBuilder';
export { executiveSummaryGenerator } from './ExecutiveSummaryGenerator';
export { painPointAnalyzer } from './PainPointAnalyzer';
export { solutionRecommendationEngine } from './SolutionRecommendationEngine';
export { pricingEngine } from './PricingEngine';
export { roiEngine } from './ROIEngine';
export { proposalFormatter } from './ProposalFormatter';
export { proposalVersionService } from './ProposalVersionService';
export { proposalTemplateService } from './ProposalTemplateService';
export { proposalReviewService } from './ProposalReviewService';

export type {
  ProposalType,
  ProposalStatus,
  Priority,
  SectionType,
  ExportFormat,
  PricingModel,
  PricingLineItem,
  PricingRecommendation,
  ROIEstimation,
  ProposalStrategy,
  PainPoint,
  SolutionRecommendation,
  RoadmapPhase,
  RiskAssessment,
  CaseStudyRecommendation,
  TeamRecommendation,
  CompetitiveDifferentiation,
  ProposalContent,
  ProposalProjectRecord,
  ProposalVersionRecord,
  ProposalSectionRecord,
  ProposalPricingRecord,
  ProposalAssetRecord,
  ProposalReviewRecord,
  ProposalApprovalRecord,
  ProposalTemplateRecord,
  ProposalGenerateRequest,
  ProposalGenerationResult,
  ProposalHealth,
  ProposalMonitorSummary,
} from '@/types/proposal';
