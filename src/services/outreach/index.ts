// ============================================================
// Enterprise Outreach Intelligence Engine — Service Index
// ============================================================

export { outreachEngine } from './OutreachEngine';
export { audienceSegmentationEngine } from './AudienceSegmentationEngine';
export { channelRecommendationEngine } from './ChannelRecommendationEngine';
export { timingRecommendationEngine } from './TimingRecommendationEngine';
export { messageStrategyEngine } from './MessageStrategyEngine';
export { personalizationEngine } from './PersonalizationEngine';
export { sequenceBuilder } from './SequenceBuilder';
export { engagementScoringEngine } from './EngagementScoringEngine';
export { replyClassificationEngine } from './ReplyClassificationEngine';
export { campaignOptimizationEngine } from './CampaignOptimizationEngine';
export { abTestingEngine } from './ABTestingEngine';

export type {
  CampaignType, CampaignStatus, Priority, ChannelType, MessageStatus,
  EventType, ReplyClassification, VariantType,
  OutreachCampaignRecord, CampaignSequenceRecord, CampaignStepRecord,
  OutreachMessageRecord, MessageVariantRecord, AudienceSegmentRecord,
  EngagementEventRecord, ReplyClassificationRecord, CampaignMetricsRecord,
  SendWindow, CampaignStrategy, MessageContent, GeneratedMessage,
  SequencePlan, AudienceSegment, ChannelRecommendation,
  TimingRecommendation, EngagementScore, ReplyAnalysis,
  OutreachGenerateRequest, OutreachGenerationResult,
  OutreachHealth, OutreachAnalytics,
} from '@/types/outreach';
