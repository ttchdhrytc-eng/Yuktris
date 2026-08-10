// Phase 20 — Autonomous Revenue Execution Engine Types

export type CycleStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type CycleType = 'business_evaluation' | 'opportunity_detection' | 'plan_generation' | 'execution' | 'measurement' | 'learning' | 'optimization';
export type TriggeredBy = 'system' | 'user' | 'ai_ceo' | 'business_event' | 'schedule' | 'manual';

export type AutonomousExecutionCycle = {
  id: string;
  workspace_id: string;
  cycle_name: string;
  cycle_status: CycleStatus;
  cycle_type: CycleType;
  triggered_by: TriggeredBy;
  trigger_source: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  actions_executed: number;
  actions_succeeded: number;
  actions_failed: number;
  opportunities_detected: number;
  estimated_roi: number | null;
  actual_roi: number | null;
  cycle_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PlanStatus = 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
export type PlanType = 'revenue_growth' | 'churn_recovery' | 'pipeline_acceleration' | 'outbound_campaign' | 'meeting_generation' | 'proposal_improvement' | 'pricing_optimization' | 'customer_expansion' | 'retention' | 'cost_reduction' | 'market_expansion' | 'process_improvement' | 'custom';

export type ExecutionPlan = {
  id: string;
  workspace_id: string;
  cycle_id: string | null;
  plan_name: string;
  plan_description: string | null;
  plan_status: PlanStatus;
  plan_type: PlanType;
  priority: number;
  estimated_roi: number | null;
  estimated_duration_hours: number | null;
  estimated_cost: number;
  estimated_revenue_impact: number;
  required_approvals: string[];
  required_agents: string[];
  success_metrics: Record<string, unknown>;
  plan_steps: unknown[];
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout' | 'escalated';

export type ExecutionSession = {
  id: string;
  workspace_id: string;
  plan_id: string | null;
  session_name: string;
  session_status: SessionStatus;
  agent_type: string;
  agent_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  total_actions: number;
  successful_actions: number;
  failed_actions: number;
  session_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ActionType = 'send_email' | 'send_linkedin' | 'call_prospect' | 'book_meeting' | 'create_proposal' | 'update_crm' | 'enrich_company' | 'score_prospect' | 'generate_content' | 'adjust_pricing' | 'trigger_workflow' | 'notify_user' | 'create_task' | 'update_record' | 'execute_api_call' | 'escalate' | 'log_event';
export type ActionStatus = 'pending' | 'queued' | 'executing' | 'completed' | 'failed' | 'skipped' | 'cancelled' | 'retried';

export type ExecutionAction = {
  id: string;
  workspace_id: string;
  session_id: string | null;
  plan_id: string | null;
  action_type: ActionType;
  action_status: ActionStatus;
  action_payload: Record<string, unknown>;
  target_entity_type: string | null;
  target_entity_id: string | null;
  target_module: string | null;
  priority: number;
  attempts: number;
  max_attempts: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  result_data: Record<string, unknown> | null;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ResultStatus = 'pending' | 'success' | 'partial' | 'failure' | 'no_change' | 'pending_measurement';

export type ExecutionResult = {
  id: string;
  workspace_id: string;
  action_id: string | null;
  plan_id: string | null;
  session_id: string | null;
  result_status: ResultStatus;
  metric_name: string;
  metric_before: number | null;
  metric_after: number | null;
  metric_delta: number | null;
  metric_unit: string | null;
  measured_at: string | null;
  measurement_window_hours: number;
  is_significant: boolean;
  confidence_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ExecutionMetric = {
  id: string;
  workspace_id: string;
  cycle_id: string | null;
  plan_id: string | null;
  session_id: string | null;
  metric_key: string;
  metric_value: number;
  metric_category: string;
  metric_labels: Record<string, unknown>;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type FailureType = 'execution_error' | 'timeout' | 'rate_limit' | 'authentication' | 'validation' | 'dependency' | 'resource' | 'api_error' | 'business_rule' | 'approval_denied' | 'unknown';

export type ExecutionFailure = {
  id: string;
  workspace_id: string;
  action_id: string | null;
  session_id: string | null;
  plan_id: string | null;
  failure_type: FailureType;
  failure_severity: 'low' | 'medium' | 'high' | 'critical';
  error_message: string;
  error_stack: string | null;
  retry_count: number;
  max_retries: number;
  is_retried: boolean;
  is_escalated: boolean;
  escalated_at: string | null;
  escalated_to: string | null;
  resolution: string | null;
  resolved_at: string | null;
  failure_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LearningType = 'success_pattern' | 'failure_pattern' | 'optimization' | 'benchmark' | 'reasoning_improvement' | 'prompt_improvement' | 'workflow_improvement' | 'tool_improvement' | 'strategy_adjustment' | 'audience_insight' | 'timing_insight' | 'messaging_insight';

export type ExecutionLearning = {
  id: string;
  workspace_id: string;
  cycle_id: string | null;
  plan_id: string | null;
  learning_type: LearningType;
  learning_title: string;
  learning_description: string | null;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  estimated_gain: number | null;
  actual_gain: number | null;
  confidence_score: number;
  is_applied: boolean;
  applied_at: string | null;
  learning_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RecommendationType = 'scaling' | 'cost_savings' | 'infrastructure' | 'risk_mitigation' | 'revenue_opportunity' | 'process_improvement' | 'pricing_adjustment' | 'messaging_improvement' | 'timing_adjustment' | 'audience_adjustment' | 'resource_allocation' | 'strategic';

export type ExecutionRecommendation = {
  id: string;
  workspace_id: string;
  cycle_id: string | null;
  recommendation_type: RecommendationType;
  recommendation_title: string;
  recommendation_description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | 'strategic';
  estimated_impact: number | null;
  estimated_effort: 'low' | 'medium' | 'high' | 'very_high';
  estimated_roi: number | null;
  confidence_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  recommended_actions: unknown[];
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  is_dismissed: boolean;
  dismissed_at: string | null;
  is_implemented: boolean;
  implemented_at: string | null;
  actual_impact: number | null;
  recommendation_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ExecutionConfidence = {
  id: string;
  workspace_id: string;
  entity_type: 'plan' | 'action' | 'decision' | 'recommendation' | 'prediction' | 'playbook' | 'optimization' | 'learning';
  entity_id: string;
  confidence_score: number;
  confidence_factors: Record<string, unknown>;
  risk_score: number;
  expected_roi: number | null;
  predicted_impact: Record<string, unknown>;
  model_version: string;
  computed_at: string;
  created_at: string;
  updated_at: string;
};

export type ApprovalType = 'plan' | 'action' | 'recommendation' | 'playbook' | 'deployment' | 'cost_change' | 'pricing_change' | 'external_communication' | 'data_access' | 'configuration';
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'auto_approved' | 'escalated';

export type ExecutionApproval = {
  id: string;
  workspace_id: string;
  plan_id: string | null;
  action_id: string | null;
  approval_type: ApprovalType;
  approval_status: ApprovalStatus;
  approval_reason: string | null;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  auto_approval_rules: Record<string, unknown>;
  expires_at: string | null;
  approval_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AutopilotHistoryEventType = 'cycle_started' | 'cycle_completed' | 'plan_created' | 'plan_approved' | 'plan_executed' | 'plan_completed' | 'session_started' | 'session_completed' | 'action_queued' | 'action_started' | 'action_completed' | 'action_failed' | 'action_retried' | 'approval_requested' | 'approval_granted' | 'approval_denied' | 'recommendation_generated' | 'recommendation_approved' | 'recommendation_implemented' | 'learning_recorded' | 'optimization_applied' | 'escalation_triggered' | 'rollback_triggered';

export type AutopilotExecutionHistory = {
  id: string;
  workspace_id: string;
  cycle_id: string | null;
  plan_id: string | null;
  session_id: string | null;
  action_id: string | null;
  event_type: AutopilotHistoryEventType;
  event_description: string;
  event_data: Record<string, unknown>;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessEventType =
  | 'lead_created' | 'lead_replied' | 'meeting_booked' | 'proposal_viewed' | 'proposal_accepted'
  | 'invoice_overdue' | 'customer_unhealthy' | 'subscription_canceled' | 'high_intent_detected'
  | 'competitor_mentioned' | 'website_visitor_identified' | 'mrr_decreased' | 'pipeline_stalled'
  | 'customer_renewed' | 'integration_connected' | 'campaign_underperforming'
  | 'revenue_forecast_changed' | 'ai_ceo_recommendation' | 'feature_flag_enabled'
  | 'security_incident' | 'deployment_completed' | 'prospect_qualified' | 'deal_won' | 'deal_lost'
  | 'payment_failed' | 'payment_received' | 'churn_risk_detected' | 'upsell_opportunity'
  | 'expansion_opportunity' | 'renewal_due' | 'custom';

export type BusinessEvent = {
  id: string;
  workspace_id: string;
  event_type: BusinessEventType;
  event_source: string;
  event_severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  entity_type: string | null;
  entity_id: string | null;
  event_data: Record<string, unknown>;
  is_processed: boolean;
  processed_at: string | null;
  triggered_actions: number;
  created_at: string;
  updated_at: string;
};

export type BusinessEventRule = {
  id: string;
  workspace_id: string;
  rule_name: string;
  rule_description: string | null;
  trigger_event_type: string;
  trigger_conditions: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  priority: number;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
  updated_at: string;
};

export type BusinessEventAction = {
  id: string;
  workspace_id: string;
  event_id: string | null;
  rule_id: string | null;
  action_type: string;
  action_status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  action_payload: Record<string, unknown>;
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessEventHistory = {
  id: string;
  workspace_id: string;
  event_id: string | null;
  rule_id: string | null;
  action_id: string | null;
  history_event: string;
  history_description: string | null;
  history_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BusinessEventQueue = {
  id: string;
  workspace_id: string;
  event_id: string | null;
  queue_status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type DecisionType = 'execute' | 'skip' | 'escalate' | 'optimize' | 'prioritize' | 'approve' | 'deny' | 'adjust' | 'create' | 'modify' | 'cancel' | 'recommend' | 'predict' | 'allocate';
export type DecisionStatus = 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rolled_back' | 'cancelled';

export type DecisionEngine = {
  id: string;
  workspace_id: string;
  decision_type: DecisionType;
  decision_title: string;
  decision_description: string | null;
  decision_reason: string;
  decision_status: DecisionStatus;
  entity_type: string | null;
  entity_id: string | null;
  confidence_score: number;
  risk_score: number;
  expected_roi: number | null;
  predicted_impact: Record<string, unknown>;
  actual_impact: Record<string, unknown>;
  model_version: string;
  decision_factors: Record<string, unknown>;
  alternatives: unknown[];
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  measured_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DecisionModel = {
  id: string;
  workspace_id: string;
  model_name: string;
  model_type: string;
  model_description: string | null;
  model_config: Record<string, unknown>;
  model_weights: Record<string, unknown>;
  model_features: string[];
  is_active: boolean;
  model_version: string;
  accuracy_score: number | null;
  precision_score: number | null;
  recall_score: number | null;
  f1_score: number | null;
  training_data_count: number;
  last_trained_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DecisionEvidence = {
  id: string;
  workspace_id: string;
  decision_id: string | null;
  evidence_type: string;
  evidence_source: string;
  evidence_description: string;
  evidence_weight: number;
  evidence_data: Record<string, unknown>;
  supports_decision: boolean;
  created_at: string;
  updated_at: string;
};

export type DecisionOutcome = {
  id: string;
  workspace_id: string;
  decision_id: string | null;
  outcome_status: 'pending' | 'positive' | 'neutral' | 'negative' | 'mixed' | 'inconclusive';
  predicted_value: number | null;
  actual_value: number | null;
  variance: number | null;
  accuracy_score: number | null;
  measurement_period_hours: number;
  measured_at: string | null;
  outcome_notes: string | null;
  outcome_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DecisionAccuracy = {
  id: string;
  workspace_id: string;
  model_version: string;
  decision_type: string | null;
  total_decisions: number;
  correct_predictions: number;
  incorrect_predictions: number;
  accuracy_percentage: number | null;
  precision_score: number | null;
  recall_score: number | null;
  f1_score: number | null;
  improvement_trend: number;
  measurement_period_start: string | null;
  measurement_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type DecisionVersion = {
  id: string;
  workspace_id: string;
  model_id: string | null;
  version_number: string;
  version_description: string | null;
  changelog: unknown[];
  model_config: Record<string, unknown>;
  model_weights: Record<string, unknown>;
  accuracy_score: number | null;
  is_production: boolean;
  promoted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type OptimizationArea = 'sales' | 'marketing' | 'messaging' | 'pricing' | 'follow_up_timing' | 'proposal_quality' | 'meeting_quality' | 'forecast_accuracy' | 'customer_health' | 'collections' | 'retention' | 'expansion' | 'ltv' | 'cac' | 'pipeline' | 'revenue' | 'profitability' | 'process' | 'cost' | 'resource_allocation';

export type OptimizationOpportunity = {
  id: string;
  workspace_id: string;
  optimization_area: OptimizationArea;
  opportunity_title: string;
  opportunity_description: string | null;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  estimated_gain: number | null;
  actual_gain: number | null;
  confidence_score: number;
  implementation_effort: 'low' | 'medium' | 'high' | 'very_high';
  is_implemented: boolean;
  implemented_at: string | null;
  is_active: boolean;
  optimization_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OptimizationHistory = {
  id: string;
  workspace_id: string;
  opportunity_id: string | null;
  optimization_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back' | 'measuring';
  before_value: number | null;
  after_value: number | null;
  measured_gain: number | null;
  estimated_gain: number | null;
  measurement_window_hours: number;
  is_significant: boolean;
  applied_at: string | null;
  measured_at: string | null;
  notes: string | null;
  optimization_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LearningSnapshot = {
  id: string;
  workspace_id: string;
  snapshot_type: string;
  snapshot_name: string;
  total_actions_analyzed: number;
  successful_patterns: number;
  failed_patterns: number;
  improvement_suggestions: number;
  benchmarks_compared: number;
  confidence_trend: number;
  accuracy_trend: number;
  snapshot_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LearningHistoryRecord = {
  id: string;
  workspace_id: string;
  snapshot_id: string | null;
  learning_category: string;
  learning_description: string;
  before_metric: number | null;
  after_metric: number | null;
  improvement_delta: number | null;
  is_applied: boolean;
  applied_at: string | null;
  learning_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RecommendationImprovement = {
  id: string;
  workspace_id: string;
  improvement_type: string;
  improvement_title: string;
  improvement_description: string | null;
  before_approach: string | null;
  after_approach: string | null;
  estimated_accuracy_gain: number | null;
  actual_accuracy_gain: number | null;
  estimated_efficiency_gain: number | null;
  actual_efficiency_gain: number | null;
  is_implemented: boolean;
  implemented_at: string | null;
  improvement_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PlaybookCategory = 'churn_recovery' | 'lost_proposal_recovery' | 'reply_rate_increase' | 'meeting_generation' | 'revenue_growth' | 'outbound_campaign' | 'failed_payment_recovery' | 'customer_upsell' | 'customer_renewal' | 'account_expansion' | 'hiring' | 'market_expansion' | 'pricing_optimization' | 'pipeline_acceleration' | 'retention' | 'expansion' | 'custom';

export type ExecutionPlaybook = {
  id: string;
  workspace_id: string;
  playbook_name: string;
  playbook_description: string | null;
  playbook_category: PlaybookCategory;
  playbook_steps: unknown[];
  required_agents: string[];
  required_approvals: string[];
  estimated_roi: number | null;
  estimated_duration_hours: number | null;
  estimated_cost: number;
  estimated_revenue_impact: number;
  success_metrics: Record<string, unknown>;
  is_active: boolean;
  is_template: boolean;
  trigger_conditions: Record<string, unknown>;
  playbook_metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaybookExecution = {
  id: string;
  workspace_id: string;
  playbook_id: string | null;
  plan_id: string | null;
  execution_name: string;
  execution_status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'paused';
  target_entity_type: string | null;
  target_entity_id: string | null;
  current_step: number;
  total_steps: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  estimated_roi: number | null;
  actual_roi: number | null;
  success_metrics_snapshot: Record<string, unknown>;
  execution_metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AutopilotMode = 'off' | 'advisory' | 'semi_autonomous' | 'fully_autonomous';

export type AutopilotSettings = {
  id: string;
  workspace_id: string;
  autopilot_mode: AutopilotMode;
  is_active: boolean;
  max_daily_actions: number;
  max_daily_cost: number;
  max_concurrent_executions: number;
  requires_approval_threshold: number;
  auto_approval_confidence_threshold: number;
  auto_approval_risk_threshold: number;
  escalation_enabled: boolean;
  learning_enabled: boolean;
  optimization_enabled: boolean;
  business_event_processing_enabled: boolean;
  decision_engine_enabled: boolean;
  notification_preferences: Record<string, unknown>;
  last_cycle_at: string | null;
  total_cycles: number;
  total_actions_executed: number;
  total_actions_succeeded: number;
  total_actions_failed: number;
  total_roi: number;
  created_at: string;
  updated_at: string;
};

export type AutopilotModuleConfig = {
  id: string;
  workspace_id: string;
  module_name: string;
  module_display_name: string;
  allowed_actions: string[];
  approval_required_actions: string[];
  human_only_actions: string[];
  max_daily_actions: number;
  max_daily_cost: number;
  confidence_threshold: number;
  risk_threshold: number;
  is_enabled: boolean;
  module_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RoiTracking = {
  id: string;
  workspace_id: string;
  entity_type: 'plan' | 'action' | 'playbook' | 'optimization' | 'recommendation' | 'cycle' | 'campaign' | 'module';
  entity_id: string;
  roi_type: 'revenue' | 'cost_savings' | 'efficiency' | 'pipeline_value' | 'retention_value' | 'expansion_value' | 'avoided_loss' | 'opportunity_cost';
  investment_amount: number;
  return_amount: number;
  roi_percentage: number | null;
  roi_status: 'pending' | 'measuring' | 'realized' | 'projected' | 'failed' | 'partial';
  measurement_start: string | null;
  measurement_end: string | null;
  measurement_window_days: number;
  confidence_score: number;
  notes: string | null;
  roi_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RoiSnapshot = {
  id: string;
  workspace_id: string;
  snapshot_period: string;
  total_investment: number;
  total_return: number;
  total_roi: number;
  total_roi_percentage: number | null;
  plans_measured: number;
  actions_measured: number;
  optimizations_measured: number;
  top_performing_area: string | null;
  worst_performing_area: string | null;
  roi_by_area: Record<string, unknown>;
  snapshot_data: Record<string, unknown>;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

// Dashboard aggregate
export type AutopilotDashboard = {
  cycles: AutonomousExecutionCycle[];
  plans: ExecutionPlan[];
  sessions: ExecutionSession[];
  actions: ExecutionAction[];
  results: ExecutionResult[];
  metrics: ExecutionMetric[];
  failures: ExecutionFailure[];
  learnings: ExecutionLearning[];
  recommendations: ExecutionRecommendation[];
  confidence: ExecutionConfidence[];
  approvals: ExecutionApproval[];
  history: AutopilotExecutionHistory[];
  businessEvents: BusinessEvent[];
  businessEventRules: BusinessEventRule[];
  businessEventActions: BusinessEventAction[];
  businessEventQueue: BusinessEventQueue[];
  decisions: DecisionEngine[];
  decisionModels: DecisionModel[];
  decisionEvidence: DecisionEvidence[];
  decisionOutcomes: DecisionOutcome[];
  decisionAccuracy: DecisionAccuracy[];
  optimizationOpportunities: OptimizationOpportunity[];
  optimizationHistory: OptimizationHistory[];
  learningSnapshots: LearningSnapshot[];
  learningHistory: LearningHistoryRecord[];
  recommendationImprovements: RecommendationImprovement[];
  playbooks: ExecutionPlaybook[];
  playbookExecutions: PlaybookExecution[];
  autopilotSettings: AutopilotSettings | null;
  moduleConfigs: AutopilotModuleConfig[];
  roiTracking: RoiTracking[];
  roiSnapshots: RoiSnapshot[];
  // Computed
  activeCycles: number;
  activePlans: number;
  activeSessions: number;
  pendingActions: number;
  executingActions: number;
  completedActions: number;
  failedActions: number;
  pendingApprovals: number;
  totalROI: number;
  avgConfidence: number;
  totalRecommendations: number;
  pendingRecommendations: number;
  approvedRecommendations: number;
  implementedRecommendations: number;
  totalPlaybooks: number;
  activePlaybookExecutions: number;
  unprocessedEvents: number;
  totalDecisions: number;
  pendingDecisions: number;
  completedDecisions: number;
  avgDecisionAccuracy: number;
  totalOptimizations: number;
  implementedOptimizations: number;
  totalLearnings: number;
  appliedLearnings: number;
  autopilotMode: AutopilotMode;
  successRate: number;
};
