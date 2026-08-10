// Phase 13 — Customer Success, Account Intelligence & Expansion Engine Types

export type AccountTier = 'standard' | 'growth' | 'enterprise' | 'strategic';
export type AccountStatus = 'active' | 'onboarding' | 'at_risk' | 'churned' | 'paused' | 'trial';
export type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RenewalStatus = 'pending' | 'in_progress' | 'at_risk' | 'renewed' | 'churned' | 'cancelled';
export type RenewalHealth = 'healthy' | 'watch' | 'at_risk' | 'critical';
export type OnboardingStatus = 'planned' | 'in_progress' | 'completed' | 'delayed' | 'at_risk' | 'cancelled';
export type ExpansionType = 'upsell' | 'cross_sell' | 'new_department' | 'new_geography' | 'enterprise' | 'additional_licenses' | 'premium_upgrade' | 'professional_services' | 'partnership';
export type ChurnSignalType = 'declining_engagement' | 'no_meetings' | 'no_replies' | 'negative_sentiment' | 'support_complaints' | 'missed_milestones' | 'low_adoption' | 'competitor_activity' | 'pricing_concerns' | 'executive_disengagement' | 'delayed_onboarding' | 'poor_roi' | 'budget_issues' | 'leadership_changes' | 'reduced_usage' | 'contract_objection';
export type JourneyStage = 'prospect' | 'onboarding' | 'activation' | 'adoption' | 'expansion' | 'renewal' | 'advocacy' | 'churn';
export type EngagementType = 'meeting' | 'email' | 'call' | 'message' | 'support_ticket' | 'product_usage' | 'feedback' | 'review' | 'referral' | 'event' | 'training';

export interface CustomerAccount {
  id: string;
  workspace_id: string;
  company_id: string | null;
  deal_id: string | null;
  account_name: string;
  account_tier: AccountTier;
  account_status: AccountStatus;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number;
  mrr: number;
  arr: number;
  industry: string | null;
  geography: string | null;
  employee_count: number | null;
  executive_sponsor: string | null;
  primary_contact_id: string | null;
  cs_owner: string | null;
  last_health_check: string | null;
  last_contact_at: string | null;
  last_meeting_at: string | null;
  last_qbr_at: string | null;
  health_score: number;
  churn_risk_score: number;
  expansion_score: number;
  renewal_probability: number;
  ai_reasoning: string | null;
  ai_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerHealthRecord {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  health_date: string;
  overall_health_score: number;
  relationship_score: number;
  engagement_score: number;
  product_adoption_score: number;
  communication_score: number;
  expansion_score: number;
  renewal_probability: number;
  churn_probability: number;
  executive_relationship_score: number;
  customer_satisfaction_score: number;
  health_factors: Record<string, unknown>;
  ai_reasoning: string | null;
  ai_confidence: number;
  supporting_evidence: unknown[];
  recommended_actions: unknown[];
  version: number;
  created_at: string;
}

export interface CustomerJourneyRecord {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  journey_stage: JourneyStage;
  stage_entered_at: string;
  stage_exited_at: string | null;
  duration_days: number | null;
  stage_data: Record<string, unknown>;
  milestone_achieved: boolean;
  created_at: string;
}

export interface OnboardingProject {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  project_name: string;
  project_status: OnboardingStatus;
  start_date: string | null;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  progress_percentage: number;
  onboarding_owner: string | null;
  priority: string;
  ai_reasoning: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  id: string;
  workspace_id: string;
  onboarding_project_id: string;
  task_name: string;
  task_description: string | null;
  task_status: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  task_order: number;
  is_milestone: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnboardingMilestone {
  id: string;
  workspace_id: string;
  onboarding_project_id: string;
  milestone_name: string;
  milestone_description: string | null;
  target_date: string | null;
  achieved_date: string | null;
  is_achieved: boolean;
  milestone_order: number;
  ai_assessment: string | null;
  created_at: string;
}

export interface CustomerSuccessPlan {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  plan_type: string;
  plan_status: string;
  plan_summary: string | null;
  success_criteria: unknown[];
  key_objectives: unknown[];
  action_items: unknown[];
  ai_generated: boolean;
  ai_reasoning: string | null;
  ai_confidence: number;
  review_frequency: string;
  next_review_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuccessGoal {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  success_plan_id: string | null;
  goal_name: string;
  goal_description: string | null;
  goal_type: string;
  target_value: number | null;
  current_value: number;
  target_date: string | null;
  is_achieved: boolean;
  achieved_at: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface ExecutiveBusinessReview {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  review_date: string;
  review_status: string;
  review_type: string;
  executive_summary: string | null;
  key_achievements: unknown[];
  key_challenges: unknown[];
  roi_analysis: Record<string, unknown>;
  value_delivered: string | null;
  future_roadmap: unknown[];
  action_items: unknown[];
  attendees: unknown[];
  ai_generated: boolean;
  ai_reasoning: string | null;
  ai_confidence: number;
  next_review_date: string | null;
  created_at: string;
}

export interface CustomerRiskRecord {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  risk_type: string;
  risk_level: string;
  risk_score: number;
  risk_description: string | null;
  detected_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
  mitigation_plan: string | null;
  recommended_actions: unknown[];
  ai_confidence: number;
  created_at: string;
}

export interface CustomerSentimentRecord {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  sentiment_score: number;
  sentiment_label: string;
  sentiment_source: string | null;
  sentiment_date: string;
  sentiment_drivers: unknown[];
  ai_reasoning: string | null;
  created_at: string;
}

export interface CustomerFeedback {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  feedback_type: string;
  feedback_score: number | null;
  feedback_text: string | null;
  feedback_source: string | null;
  feedback_date: string;
  sentiment: string;
  is_actioned: boolean;
  ai_analysis: string | null;
  created_at: string;
}

export interface CustomerEngagementRecord {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  engagement_type: EngagementType;
  engagement_date: string;
  engagement_direction: string;
  engagement_score: number;
  sentiment: string;
  engagement_summary: string | null;
  engagement_data: Record<string, unknown>;
  created_at: string;
}

export interface RenewalPipelineRecord {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  renewal_date: string;
  renewal_value: number;
  renewal_probability: number;
  renewal_status: RenewalStatus;
  renewal_health: RenewalHealth;
  executive_sponsor: string | null;
  renewal_blockers: unknown[];
  pricing_risk: string | null;
  contract_risk: string | null;
  recommended_strategy: string | null;
  ai_reasoning: string | null;
  ai_confidence: number;
  days_to_renewal: number | null;
  created_at: string;
  updated_at: string;
}

export interface RenewalForecast {
  id: string;
  workspace_id: string;
  forecast_period: string;
  period_start: string;
  period_end: string;
  total_renewal_value: number;
  expected_renewal_value: number;
  at_risk_value: number;
  renewal_count: number;
  avg_renewal_probability: number;
  ai_reasoning: string | null;
  ai_confidence: number;
  created_at: string;
}

export interface RenewalTask {
  id: string;
  workspace_id: string;
  renewal_pipeline_id: string;
  task_name: string;
  task_description: string | null;
  task_type: string;
  task_status: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface RenewalReminder {
  id: string;
  workspace_id: string;
  renewal_pipeline_id: string;
  reminder_date: string;
  reminder_type: string;
  reminder_message: string | null;
  is_sent: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface RenewalHistoryRecord {
  id: string;
  workspace_id: string;
  customer_account_id: string | null;
  renewal_date: string;
  renewal_value: number | null;
  renewal_outcome: string | null;
  renewal_reason: string | null;
  previous_value: number | null;
  new_value: number | null;
  created_at: string;
}

export interface UpsellOpportunity {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  opportunity_name: string;
  opportunity_description: string | null;
  current_product: string | null;
  upsell_product: string | null;
  estimated_value: number;
  probability: number;
  likelihood_to_close: number;
  recommended_timing: string | null;
  decision_makers: unknown[];
  supporting_reasons: unknown[];
  expansion_score: number;
  ai_reasoning: string | null;
  ai_confidence: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CrossSellOpportunity {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  opportunity_name: string;
  opportunity_description: string | null;
  original_product: string | null;
  cross_sell_product: string | null;
  estimated_value: number;
  probability: number;
  likelihood_to_close: number;
  recommended_timing: string | null;
  decision_makers: unknown[];
  supporting_reasons: unknown[];
  expansion_score: number;
  ai_reasoning: string | null;
  ai_confidence: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ExpansionOpportunity {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  expansion_type: ExpansionType;
  opportunity_name: string;
  opportunity_description: string | null;
  estimated_value: number;
  probability: number;
  likelihood_to_close: number;
  recommended_timing: string | null;
  decision_makers: unknown[];
  supporting_reasons: unknown[];
  ai_reasoning: string | null;
  ai_confidence: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ExpansionScoreRecord {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  score_date: string;
  overall_expansion_score: number;
  upsell_score: number;
  cross_sell_score: number;
  new_department_score: number;
  new_geography_score: number;
  enterprise_score: number;
  scoring_factors: Record<string, unknown>;
  ai_reasoning: string | null;
  ai_confidence: number;
  created_at: string;
}

export interface ChurnPrediction {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  prediction_date: string;
  churn_probability_30d: number;
  churn_probability_60d: number;
  churn_probability_90d: number;
  churn_probability_annual: number;
  churn_risk_level: ChurnRiskLevel;
  ai_reasoning: string | null;
  ai_confidence: number;
  supporting_signals: unknown[];
  mitigation_plan: string | null;
  recommended_actions: unknown[];
  prediction_version: number;
  created_at: string;
}

export interface ChurnSignal {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  signal_type: ChurnSignalType;
  signal_description: string | null;
  signal_strength: number;
  detected_at: string;
  is_active: boolean;
  resolved_at: string | null;
  ai_confidence: number;
  created_at: string;
}

export interface ReferralOpportunity {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  referral_target_company: string | null;
  referral_target_contact: string | null;
  referral_value: number;
  referral_probability: number;
  referral_status: string;
  ai_reasoning: string | null;
  ai_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerTestimonial {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  testimonial_text: string;
  testimonial_author: string | null;
  testimonial_title: string | null;
  testimonial_type: string;
  is_approved: boolean;
  is_published: boolean;
  published_at: string | null;
  ai_generated: boolean;
  ai_reasoning: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseStudy {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  case_study_title: string;
  case_study_content: string | null;
  case_study_summary: string | null;
  key_results: unknown[];
  industry: string | null;
  company_size: string | null;
  use_case: string | null;
  is_approved: boolean;
  is_published: boolean;
  ai_generated: boolean;
  ai_reasoning: string | null;
  ai_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerChampion {
  id: string;
  workspace_id: string;
  customer_account_id: string;
  champion_name: string;
  champion_title: string | null;
  champion_email: string | null;
  champion_score: number;
  advocacy_type: string;
  engagement_level: string;
  last_engaged_at: string | null;
  ai_reasoning: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Command Center Dashboard
// ============================================================

export interface CustomerSuccessCommandCenter {
  accounts: CustomerAccount[];
  healthRecords: CustomerHealthRecord[];
  journey: CustomerJourneyRecord[];
  onboardingProjects: OnboardingProject[];
  onboardingTasks: OnboardingTask[];
  onboardingMilestones: OnboardingMilestone[];
  successPlans: CustomerSuccessPlan[];
  successGoals: SuccessGoal[];
  executiveReviews: ExecutiveBusinessReview[];
  risks: CustomerRiskRecord[];
  sentiment: CustomerSentimentRecord[];
  feedback: CustomerFeedback[];
  engagement: CustomerEngagementRecord[];
  renewals: RenewalPipelineRecord[];
  renewalForecasts: RenewalForecast[];
  renewalTasks: RenewalTask[];
  renewalReminders: RenewalReminder[];
  renewalHistory: RenewalHistoryRecord[];
  upsellOpportunities: UpsellOpportunity[];
  crossSellOpportunities: CrossSellOpportunity[];
  expansionOpportunities: ExpansionOpportunity[];
  expansionScores: ExpansionScoreRecord[];
  churnPredictions: ChurnPrediction[];
  churnSignals: ChurnSignal[];
  referrals: ReferralOpportunity[];
  testimonials: CustomerTestimonial[];
  caseStudies: CaseStudy[];
  champions: CustomerChampion[];
  // Summary metrics
  totalAccounts: number;
  healthyAccounts: number;
  atRiskAccounts: number;
  churnedAccounts: number;
  totalARR: number;
  totalMRR: number;
  avgHealthScore: number;
  avgChurnRisk: number;
  avgExpansionScore: number;
  upcomingRenewals: number;
  atRiskRenewalValue: number;
  totalExpansionValue: number;
  totalReferralValue: number;
}
