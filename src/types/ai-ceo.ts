export type CEOState = {
  id: string; workspace_id: string; overall_company_score: number; health_score: number;
  growth_score: number; efficiency_score: number; risk_score: number; opportunity_score: number;
  last_analysis_at: string; ai_reasoning: string | null;
};
export type CEOObjective = {
  id: string; workspace_id: string; objective_title: string; objective_description: string;
  objective_type: string; status: string; priority: number; target_date: string | null;
  created_at: string;
};
export type CEOMetric = {
  id: string; workspace_id: string; metric_name: string; metric_value: number;
  measurement_date: string; created_at: string;
};
export type CEODecision = {
  id: string; workspace_id: string; decision_title: string; decision_description: string;
  decision_type: string; decision_status: string; ai_reasoning: string | null;
  confidence: number; created_at: string;
};
export type CEOObservation = {
  id: string; workspace_id: string; observation_text: string; observation_type: string;
  detected_at: string; created_at: string;
};
export type CEOPrediction = {
  id: string; workspace_id: string; prediction_text: string; prediction_type: string;
  confidence: number; created_at: string;
};
export type ExecutiveBrief = {
  id: string; workspace_id: string; brief_date: string; executive_summary: string;
  wins: string | null; losses: string | null; risks: string | null;
  revenue_summary: string | null; forecast_summary: string | null;
  customer_health_summary: string | null; finance_summary: string | null;
  cashflow_summary: string | null; hiring_summary: string | null;
  growth_summary: string | null; competition_summary: string | null;
  strategic_priorities: string | null; ai_reasoning: string | null;
  ai_confidence: number; full_brief: unknown; created_at: string;
};
export type ExecutiveRisk = {
  id: string; workspace_id: string; risk_title: string; risk_description: string;
  risk_category: string; risk_level: string; probability: number; impact: number;
  mitigation_strategy: string | null; status: string; ai_reasoning: string | null;
  ai_confidence: number; created_at: string;
};
export type ExecutiveOpportunity = {
  id: string; workspace_id: string; opportunity_title: string; opportunity_description: string;
  opportunity_type: string; estimated_value: number; probability: number;
  time_horizon: string | null; status: string; ai_reasoning: string | null;
  ai_confidence: number; created_at: string;
};
export type ExecutiveRecommendation = {
  id: string; workspace_id: string; recommendation_title: string; recommendation_description: string;
  recommendation_type: string; priority: string; estimated_value: number;
  confidence: number; status: string; ai_reasoning: string | null; created_at: string;
};
export type BoardReport = {
  id: string; workspace_id: string; report_period: string; period_start: string;
  period_end: string; revenue_summary: string; forecast_summary: string;
  pipeline_summary: string; profit_summary: string; customer_summary: string;
  risk_summary: string; opportunity_summary: string; strategic_summary: string;
  ai_reasoning: string | null; ai_confidence: number; full_report: unknown; created_at: string;
};
export type CompanyHealth = {
  id: string; workspace_id: string; measurement_date: string; overall_health: number;
  revenue_health: number; customer_health: number; operational_health: number;
  created_at: string;
};
export type StrategicAlert = {
  id: string; workspace_id: string; alert_title: string; alert_description: string;
  alert_type: string; severity: string; is_resolved: boolean; created_at: string;
};
export type OKR = {
  id: string; workspace_id: string; objective_title: string; objective_description: string;
  status: string; created_at: string;
};
export type KeyResult = {
  id: string; workspace_id: string; okr_id: string | null; key_result_title: string;
  current_value: number; target_value: number; created_at: string;
};
export type StrategicInitiative = {
  id: string; workspace_id: string; initiative_name: string; initiative_description: string;
  initiative_type: string; status: string; priority: string; target_end_date: string | null;
  expected_roi: number; ai_reasoning: string | null; created_at: string;
};
export type CompanyPriority = {
  id: string; workspace_id: string; priority_title: string; priority_description: string;
  priority_level: string; status: string; created_at: string;
};
export type AutonomousTask = {
  id: string; workspace_id: string; task_title: string; task_description: string;
  status: string; ai_reasoning: string | null; created_at: string;
};
export type ScenarioModel = {
  id: string; workspace_id: string; scenario_name: string; scenario_description: string;
  scenario_type: string; confidence: number; ai_reasoning: string | null; created_at: string;
};
export type WhatIfAnalysis = {
  id: string; workspace_id: string; scenario_model_id: string | null; question: string;
  variable_changed: string; change_value: string; baseline_metric: number;
  projected_metric: number; impact_delta: number; impact_percent: number;
  time_horizon: string; ai_reasoning: string | null; ai_confidence: number; created_at: string;
};
export type ExecutiveLearning = {
  id: string; workspace_id: string; learning_title: string; learning_description: string;
  is_active: boolean; created_at: string;
};
export type AnomalyDetection = {
  id: string; workspace_id: string; anomaly_text: string; anomaly_type: string;
  detected_at: string; is_resolved: boolean; created_at: string;
};
export type TrendDetection = {
  id: string; workspace_id: string; trend_text: string; trend_type: string;
  detected_at: string; created_at: string;
};
export type CEOCommandCenter = {
  state: CEOState | null; objectives: CEOObjective[]; goals: unknown[]; metrics: CEOMetric[];
  decisions: CEODecision[]; observations: CEOObservation[]; predictions: CEOPrediction[];
  strategicInitiatives: StrategicInitiative[]; priorities: CompanyPriority[];
  okrs: OKR[]; keyResults: KeyResult[]; executiveBriefs: ExecutiveBrief[];
  risks: ExecutiveRisk[]; opportunities: ExecutiveOpportunity[];
  recommendations: ExecutiveRecommendation[]; boardReports: BoardReport[];
  companyHealth: CompanyHealth[]; anomalies: AnomalyDetection[];
  trends: TrendDetection[]; strategicAlerts: StrategicAlert[];
  autonomousTasks: AutonomousTask[]; scenarios: ScenarioModel[];
  whatIfAnalyses: WhatIfAnalysis[]; learnings: ExecutiveLearning[];
  totalMRR: number; totalARR: number; totalPipeline: number;
  activeCustomers: number; activeSubscriptions: number;
  overdueAmount: number; failedPayments: number;
  churnRiskCount: number; avgCustomerHealth: number;
  grossMargin: number; avgLTV: number; avgCAC: number;
  winRate: number; meetingCount: number; proposalCount: number;
};
