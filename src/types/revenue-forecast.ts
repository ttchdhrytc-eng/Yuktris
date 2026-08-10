// Phase 12 — Revenue Pipeline, Forecasting & AI Sales Command Center Types

export type ForecastType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type ForecastModelType = 'weighted_pipeline' | 'ai_predictive' | 'historical_avg' | 'ml_regression' | 'hybrid';
export type DealType = 'new_business' | 'renewal' | 'upsell' | 'cross_sell' | 'expansion';
export type DealClosedStatus = 'won' | 'lost' | 'pending';
export type LeakageType = 'stalled' | 'no_activity' | 'meeting_overdue' | 'proposal_ignored' | 'no_reply' | 'competitor_detected' | 'negative_sentiment' | 'dm_missing' | 'wrong_icp' | 'low_engagement' | 'budget_concern' | 'pricing_objection' | 'sequence_stopped' | 'lost_momentum';
export type AlertType = 'forecast_increased' | 'forecast_decreased' | 'large_deal_at_risk' | 'large_deal_won' | 'pipeline_shrinking' | 'pipeline_growing' | 'proposal_accepted' | 'proposal_ignored' | 'meeting_cancelled' | 'meeting_scheduled' | 'mrr_increased' | 'arr_increased' | 'low_forecast_confidence' | 'pipeline_bottleneck' | 'revenue_milestone';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type InsightType = 'trend' | 'opportunity' | 'risk' | 'anomaly' | 'recommendation' | 'benchmark' | 'prediction';
export type SummaryType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'board';
export type OpportunityType = 'upsell' | 'cross_sell' | 'expansion' | 'renewal' | 'new_business' | 'win_back';
export type AnomalyType = 'spike' | 'drop' | 'unusual_pattern' | 'outlier' | 'threshold_breach';
export type RenewalStatus = 'pending' | 'renewed' | 'churned' | 'at_risk';

export interface PipelineStage {
  id: string;
  workspace_id: string;
  stage_name: string;
  stage_order: number;
  default_probability: number;
  is_won_stage: boolean;
  is_lost_stage: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineDeal {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  meeting_id: string | null;
  conversation_id: string | null;
  proposal_project_id: string | null;
  deal_name: string;
  company_name: string | null;
  contact_name: string | null;
  current_stage: string;
  previous_stage: string | null;
  stage_entered_at: string;
  deal_value: number;
  weighted_value: number;
  probability_to_close: number;
  expected_close_date: string | null;
  actual_close_date: string | null;
  ai_confidence: number;
  ai_reasoning: string | null;
  risk_score: number;
  health_score: number;
  last_activity_at: string | null;
  days_in_stage: number;
  next_recommended_action: string | null;
  deal_type: DealType;
  source_channel: string | null;
  campaign_id: string | null;
  industry: string | null;
  geography: string | null;
  is_closed: boolean;
  closed_status: DealClosedStatus | null;
  close_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineMovement {
  id: string;
  workspace_id: string;
  deal_id: string;
  from_stage: string | null;
  to_stage: string;
  probability_before: number | null;
  probability_after: number | null;
  value_before: number | null;
  value_after: number | null;
  reason: string | null;
  moved_by: string;
  days_in_previous_stage: number | null;
  created_at: string;
}

export interface PipelineSnapshot {
  id: string;
  workspace_id: string;
  snapshot_date: string;
  total_deals: number;
  total_pipeline_value: number;
  weighted_pipeline_value: number;
  deals_by_stage: Record<string, number>;
  deals_by_type: Record<string, number>;
  deals_by_channel: Record<string, number>;
  deals_by_industry: Record<string, number>;
  avg_deal_size: number;
  avg_probability: number;
  snapshot_data: Record<string, unknown>;
  created_at: string;
}

export interface PipelineVelocityRecord {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  stage_name: string;
  avg_days_in_stage: number;
  deal_count: number;
  conversion_rate: number;
  avg_value_entering: number;
  avg_value_exiting: number;
  velocity_score: number;
  created_at: string;
}

export interface PipelineHealthRecord {
  id: string;
  workspace_id: string;
  health_date: string;
  overall_health_score: number;
  pipeline_coverage: number;
  coverage_ratio: number;
  stale_deal_count: number;
  at_risk_count: number;
  bottleneck_stage: string | null;
  avg_days_in_pipeline: number;
  win_rate: number;
  loss_rate: number;
  health_factors: Record<string, unknown>;
  recommendations: unknown[];
  created_at: string;
}

export interface PipelinePrediction {
  id: string;
  workspace_id: string;
  deal_id: string;
  predicted_probability: number;
  predicted_close_date: string | null;
  predicted_value: number | null;
  ai_confidence: number;
  ai_reasoning: string | null;
  supporting_signals: unknown[];
  risk_factors: unknown[];
  recommended_action: string | null;
  prediction_version: number;
  created_at: string;
}

export interface PipelineLeakageRecord {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  leakage_type: LeakageType;
  leakage_description: string | null;
  risk_score: number;
  confidence: number;
  expected_impact: string | null;
  recommended_action: string | null;
  detected_at: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface RevenueForecast {
  id: string;
  workspace_id: string;
  forecast_type: ForecastType;
  period_start: string;
  period_end: string;
  expected_revenue: number;
  weighted_revenue: number;
  best_case_revenue: number;
  worst_case_revenue: number;
  committed_revenue: number;
  pipeline_revenue: number;
  forecast_confidence: number;
  deal_count: number;
  ai_reasoning: string | null;
  supporting_signals: unknown[];
  model_version: string;
  version: number;
  created_at: string;
}

export interface ForecastModel {
  id: string;
  workspace_id: string;
  model_name: string;
  model_type: ForecastModelType;
  parameters: Record<string, unknown>;
  accuracy_score: number;
  is_active: boolean;
  last_trained_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastAccuracyRecord {
  id: string;
  workspace_id: string;
  forecast_id: string | null;
  period_start: string;
  period_end: string;
  forecasted_revenue: number | null;
  actual_revenue: number | null;
  variance: number | null;
  variance_percentage: number | null;
  accuracy_score: number;
  bias: 'over_forecast' | 'under_forecast' | 'accurate' | null;
  created_at: string;
}

export interface ForecastHistoryRecord {
  id: string;
  workspace_id: string;
  snapshot_date: string;
  forecast_type: string;
  expected_revenue: number | null;
  weighted_revenue: number | null;
  actual_revenue: number | null;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BookedRevenue {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  company_id: string | null;
  amount: number;
  revenue_date: string;
  revenue_type: string;
  source_channel: string | null;
  campaign_id: string | null;
  industry: string | null;
  geography: string | null;
  created_at: string;
}

export interface MRRRecord {
  id: string;
  workspace_id: string;
  mrr_date: string;
  new_mrr: number;
  expansion_mrr: number;
  contraction_mrr: number;
  churn_mrr: number;
  net_new_mrr: number;
  total_mrr: number;
  created_at: string;
}

export interface ARRRecord {
  id: string;
  workspace_id: string;
  arr_date: string;
  new_arr: number;
  expansion_arr: number;
  contraction_arr: number;
  churn_arr: number;
  net_new_arr: number;
  total_arr: number;
  created_at: string;
}

export interface CashflowProjection {
  id: string;
  workspace_id: string;
  projection_date: string;
  expected_inflow: number;
  expected_outflow: number;
  net_cashflow: number;
  cumulative_cashflow: number;
  confidence: number;
  assumptions: Record<string, unknown>;
  created_at: string;
}

export interface SalesPerformance {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  rep_name: string | null;
  deals_won: number;
  deals_lost: number;
  total_pipeline_value: number;
  won_value: number;
  win_rate: number;
  avg_deal_size: number;
  avg_sales_cycle_days: number;
  quota_attainment: number;
  activities_count: number;
  meetings_count: number;
  created_at: string;
}

export interface CampaignPerformance {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  campaign_name: string;
  campaign_id: string | null;
  deals_generated: number;
  pipeline_value: number;
  won_value: number;
  conversion_rate: number;
  cost_per_acquisition: number;
  roi: number;
  created_at: string;
}

export interface ProposalPerformance {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  total_proposals: number;
  accepted_proposals: number;
  rejected_proposals: number;
  pending_proposals: number;
  acceptance_rate: number;
  avg_proposal_value: number;
  avg_time_to_accept_days: number;
  total_proposal_value: number;
  created_at: string;
}

export interface MeetingPerformance {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  total_meetings: number;
  completed_meetings: number;
  cancelled_meetings: number;
  moved_to_opportunity: number;
  conversion_rate: number;
  avg_meeting_score: number;
  created_at: string;
}

export interface ChannelPerformance {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  channel: string;
  deals_count: number;
  pipeline_value: number;
  won_value: number;
  conversion_rate: number;
  avg_deal_size: number;
  created_at: string;
}

export interface IndustryPerformance {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  industry: string;
  deals_count: number;
  pipeline_value: number;
  won_value: number;
  conversion_rate: number;
  avg_deal_size: number;
  created_at: string;
}

export interface ExecutiveSummary {
  id: string;
  workspace_id: string;
  summary_type: SummaryType;
  period_start: string;
  period_end: string;
  summary_text: string;
  key_metrics: Record<string, unknown>;
  highlights: unknown[];
  risks: unknown[];
  recommendations: unknown[];
  ai_confidence: number;
  version: number;
  created_at: string;
}

export interface ExecutiveBrief {
  id: string;
  workspace_id: string;
  brief_date: string;
  brief_type: string;
  headline: string;
  summary: string | null;
  key_points: unknown[];
  action_items: unknown[];
  metrics: Record<string, unknown>;
  ai_confidence: number;
  created_at: string;
}

export interface RevenueInsight {
  id: string;
  workspace_id: string;
  insight_type: InsightType;
  insight_title: string;
  insight_text: string;
  insight_data: Record<string, unknown>;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  is_read: boolean;
  created_at: string;
}

export interface RevenueAlert {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  alert_type: AlertType;
  alert_title: string;
  alert_message: string;
  severity: AlertSeverity;
  alert_data: Record<string, unknown>;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export interface RevenueOpportunity {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  opportunity_type: OpportunityType;
  opportunity_title: string;
  opportunity_description: string | null;
  estimated_value: number | null;
  probability: number;
  timeframe: string | null;
  ai_confidence: number;
  ai_reasoning: string | null;
  is_actioned: boolean;
  created_at: string;
}

export interface RevenueAnomaly {
  id: string;
  workspace_id: string;
  anomaly_type: AnomalyType;
  anomaly_description: string;
  metric_name: string;
  expected_value: number | null;
  actual_value: number | null;
  deviation_percentage: number | null;
  detected_at: string;
  is_investigated: boolean;
  created_at: string;
}

// ============================================================
// Command Center Dashboard
// ============================================================

export interface RevenueCommandCenter {
  // Pipeline
  deals: PipelineDeal[];
  stages: PipelineStage[];
  totalPipelineValue: number;
  weightedPipelineValue: number;
  dealCount: number;
  avgDealSize: number;
  avgProbability: number;
  // Forecast
  currentQuarterForecast: RevenueForecast | null;
  currentMonthForecast: RevenueForecast | null;
  // Health
  pipelineHealth: PipelineHealthRecord | null;
  // MRR/ARR
  latestMRR: MRRRecord | null;
  latestARR: ARRRecord | null;
  // Performance
  salesPerformance: SalesPerformance[];
  campaignPerformance: CampaignPerformance[];
  proposalPerformance: ProposalPerformance | null;
  meetingPerformance: MeetingPerformance | null;
  channelPerformance: ChannelPerformance[];
  industryPerformance: IndustryPerformance[];
  // Executive
  latestSummary: ExecutiveSummary | null;
  latestBrief: ExecutiveBrief | null;
  insights: RevenueInsight[];
  alerts: RevenueAlert[];
  opportunities: RevenueOpportunity[];
  anomalies: RevenueAnomaly[];
  // Leakage
  leakage: PipelineLeakageRecord[];
  // Velocity
  velocity: PipelineVelocityRecord[];
  // Forecast accuracy
  forecastAccuracy: ForecastAccuracyRecord[];
  // Forecast history
  forecastHistory: ForecastHistoryRecord[];
  // Cashflow
  cashflowProjections: CashflowProjection[];
}
