/*
# Phase 15 Part 2 — AI CEO: Monitoring, Autonomous Actions, Scenario Planning, AI Learning
*/

-- ============================================================
-- ANOMALY DETECTION
-- ============================================================
CREATE TABLE anomaly_detection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  anomaly_type text NOT NULL CHECK (anomaly_type IN ('revenue_drop','pipeline_drop','churn_spike','meeting_decline','proposal_loss','cashflow_issue','margin_decline','hiring_bottleneck','execution_bottleneck','usage_drop','engagement_drop','conversion_drop')),
  anomaly_title text NOT NULL,
  anomaly_description text,
  anomaly_data jsonb DEFAULT '{}'::jsonb,
  severity text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  source_module text,
  detected_value numeric(14,2),
  expected_value numeric(14,2),
  deviation_percent numeric(5,2) DEFAULT 0,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.75,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_anomaly_detection_workspace ON anomaly_detection(workspace_id);
CREATE INDEX idx_anomaly_detection_unresolved ON anomaly_detection(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_anomaly_detection_severity ON anomaly_detection(severity);
ALTER TABLE anomaly_detection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_anomaly_detection" ON anomaly_detection FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = anomaly_detection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_anomaly_detection" ON anomaly_detection FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = anomaly_detection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_anomaly_detection" ON anomaly_detection FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = anomaly_detection.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = anomaly_detection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_anomaly_detection" ON anomaly_detection FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = anomaly_detection.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TREND DETECTION
-- ============================================================
CREATE TABLE trend_detection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trend_type text NOT NULL CHECK (trend_type IN ('revenue_growth','pipeline_growth','customer_expansion','market_shift','competitive_shift','pricing_trend','hiring_trend','product_adoption','engagement_trend','efficiency_trend')),
  trend_title text NOT NULL,
  trend_description text,
  trend_direction text DEFAULT 'up' CHECK (trend_direction IN ('up','down','sideways')),
  trend_strength text DEFAULT 'moderate' CHECK (trend_strength IN ('weak','moderate','strong','very_strong')),
  trend_data jsonb DEFAULT '{}'::jsonb,
  source_module text,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.75,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trend_detection_workspace ON trend_detection(workspace_id);
CREATE INDEX idx_trend_detection_direction ON trend_detection(trend_direction);
ALTER TABLE trend_detection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_trend_detection" ON trend_detection FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trend_detection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_trend_detection" ON trend_detection FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trend_detection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_trend_detection" ON trend_detection FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trend_detection.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trend_detection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_trend_detection" ON trend_detection FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trend_detection.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- STRATEGIC ALERTS
-- ============================================================
CREATE TABLE strategic_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('revenue_decline','pipeline_shrinkage','churn_increase','meeting_decline','proposal_loss','customer_dissatisfaction','cashflow_problem','margin_decline','hiring_bottleneck','execution_bottleneck','market_shift','competitive_threat','strategic_misalignment','goal_at_risk','objective_behind')),
  alert_title text NOT NULL,
  alert_description text,
  alert_severity text DEFAULT 'medium' CHECK (alert_severity IN ('low','medium','high','critical')),
  related_entity_id uuid,
  related_entity_type text,
  amount_impacted numeric(14,2) DEFAULT 0,
  recommended_action text,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.8,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_strategic_alerts_workspace ON strategic_alerts(workspace_id);
CREATE INDEX idx_strategic_alerts_unresolved ON strategic_alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_strategic_alerts_severity ON strategic_alerts(alert_severity);
ALTER TABLE strategic_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_strategic_alerts" ON strategic_alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_strategic_alerts" ON strategic_alerts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_strategic_alerts" ON strategic_alerts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_alerts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_strategic_alerts" ON strategic_alerts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_alerts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PERFORMANCE ALERTS
-- ============================================================
CREATE TABLE performance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('kpi_miss','metric_decline','benchmark_underperform','quota_miss','target_miss','efficiency_drop','productivity_drop','conversion_drop','velocity_drop')),
  alert_title text NOT NULL,
  alert_description text,
  metric_name text,
  current_value numeric(14,2),
  target_value numeric(14,2),
  deviation_percent numeric(5,2) DEFAULT 0,
  alert_severity text DEFAULT 'medium' CHECK (alert_severity IN ('low','medium','high','critical')),
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_performance_alerts_workspace ON performance_alerts(workspace_id);
CREATE INDEX idx_performance_alerts_unresolved ON performance_alerts(is_resolved) WHERE is_resolved = false;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_performance_alerts" ON performance_alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = performance_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_performance_alerts" ON performance_alerts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = performance_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_performance_alerts" ON performance_alerts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = performance_alerts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = performance_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_performance_alerts" ON performance_alerts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = performance_alerts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE NOTIFICATIONS
-- ============================================================
CREATE TABLE executive_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('risk','opportunity','decision_required','milestone','alert','brief','report','anomaly','trend','recommendation')),
  notification_title text NOT NULL,
  notification_message text,
  notification_data jsonb DEFAULT '{}'::jsonb,
  priority text DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  is_read boolean DEFAULT false,
  read_at timestamptz,
  action_taken text,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_executive_notifications_workspace ON executive_notifications(workspace_id);
CREATE INDEX idx_executive_notifications_unread ON executive_notifications(is_read) WHERE is_read = false;
ALTER TABLE executive_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_executive_notifications" ON executive_notifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_executive_notifications" ON executive_notifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_executive_notifications" ON executive_notifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_notifications.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_executive_notifications" ON executive_notifications FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_notifications.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AUTONOMOUS TASKS
-- ============================================================
CREATE TABLE autonomous_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_title text NOT NULL,
  task_description text,
  task_type text DEFAULT 'recommendation' CHECK (task_type IN ('recommendation','notification','workflow','analysis','follow_up','outreach','scheduling','report_generation','data_sync')),
  task_status text DEFAULT 'pending' CHECK (task_status IN ('pending','approved','executing','completed','failed','cancelled','requires_approval')),
  priority text DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  target_module text,
  target_entity_id uuid,
  target_entity_type text,
  execution_payload jsonb DEFAULT '{}'::jsonb,
  requires_approval boolean DEFAULT true,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  executed_at timestamptz,
  execution_result jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_autonomous_tasks_workspace ON autonomous_tasks(workspace_id);
CREATE INDEX idx_autonomous_tasks_status ON autonomous_tasks(task_status);
CREATE INDEX idx_autonomous_tasks_pending ON autonomous_tasks(task_status) WHERE task_status = 'pending';
ALTER TABLE autonomous_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_autonomous_tasks" ON autonomous_tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_autonomous_tasks" ON autonomous_tasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_autonomous_tasks" ON autonomous_tasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_tasks.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_autonomous_tasks" ON autonomous_tasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_tasks.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AUTONOMOUS WORKFLOWS
-- ============================================================
CREATE TABLE autonomous_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_name text NOT NULL,
  workflow_description text,
  workflow_type text DEFAULT 'sequential' CHECK (workflow_type IN ('sequential','parallel','conditional','loop','event_driven')),
  trigger_condition text,
  action_sequence jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  execution_count integer DEFAULT 0,
  last_executed_at timestamptz,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_autonomous_workflows_workspace ON autonomous_workflows(workspace_id);
ALTER TABLE autonomous_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_autonomous_workflows" ON autonomous_workflows FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_workflows.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_autonomous_workflows" ON autonomous_workflows FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_workflows.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_autonomous_workflows" ON autonomous_workflows FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_workflows.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_workflows.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_autonomous_workflows" ON autonomous_workflows FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_workflows.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AUTONOMOUS DECISIONS
-- ============================================================
CREATE TABLE autonomous_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_title text NOT NULL,
  decision_description text,
  decision_type text DEFAULT 'operational' CHECK (decision_type IN ('operational','tactical','strategic','financial','resource_allocation','priority_adjustment')),
  decision_rationale text,
  estimated_impact numeric(14,2) DEFAULT 0,
  confidence numeric DEFAULT 0.7,
  is_autonomous boolean DEFAULT false,
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  executed_at timestamptz,
  outcome text,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_autonomous_decisions_workspace ON autonomous_decisions(workspace_id);
ALTER TABLE autonomous_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_autonomous_decisions" ON autonomous_decisions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_autonomous_decisions" ON autonomous_decisions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_autonomous_decisions" ON autonomous_decisions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_decisions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_autonomous_decisions" ON autonomous_decisions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = autonomous_decisions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- DECISION HISTORY
-- ============================================================
CREATE TABLE decision_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES autonomous_decisions(id) ON DELETE SET NULL,
  ai_ceo_decision_id uuid REFERENCES ai_ceo_decisions(id) ON DELETE SET NULL,
  executive_decision_id uuid REFERENCES executive_decisions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('proposed','reviewed','approved','rejected','executed','completed','failed','reversed','learned')),
  event_description text,
  previous_status text,
  new_status text,
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_decision_history_workspace ON decision_history(workspace_id);
CREATE INDEX idx_decision_history_decision ON decision_history(decision_id);
ALTER TABLE decision_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_decision_history" ON decision_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_decision_history" ON decision_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_decision_history" ON decision_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_decision_history" ON decision_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTION HISTORY
-- ============================================================
CREATE TABLE execution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  autonomous_task_id uuid REFERENCES autonomous_tasks(id) ON DELETE SET NULL,
  autonomous_workflow_id uuid REFERENCES autonomous_workflows(id) ON DELETE SET NULL,
  execution_type text NOT NULL,
  execution_status text DEFAULT 'pending' CHECK (execution_status IN ('pending','running','completed','failed','timeout','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  result_data jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_execution_history_workspace ON execution_history(workspace_id);
CREATE INDEX idx_execution_history_task ON execution_history(autonomous_task_id);
ALTER TABLE execution_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_execution_history" ON execution_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = execution_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_execution_history" ON execution_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = execution_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_execution_history" ON execution_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = execution_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = execution_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_execution_history" ON execution_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = execution_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SCENARIO MODELS
-- ============================================================
CREATE TABLE scenario_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_name text NOT NULL,
  scenario_description text,
  scenario_type text DEFAULT 'what_if' CHECK (scenario_type IN ('what_if','sensitivity','monte_carlo','deterministic','comparative')),
  input_parameters jsonb DEFAULT '{}'::jsonb,
  output_projections jsonb DEFAULT '{}'::jsonb,
  assumptions jsonb DEFAULT '[]'::jsonb,
  confidence numeric DEFAULT 0.7,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenario_models_workspace ON scenario_models(workspace_id);
CREATE INDEX idx_scenario_models_type ON scenario_models(scenario_type);
ALTER TABLE scenario_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_scenario_models" ON scenario_models FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = scenario_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_scenario_models" ON scenario_models FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = scenario_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_scenario_models" ON scenario_models FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = scenario_models.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = scenario_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_scenario_models" ON scenario_models FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = scenario_models.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- WHAT IF ANALYSIS
-- ============================================================
CREATE TABLE what_if_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_model_id uuid REFERENCES scenario_models(id) ON DELETE SET NULL,
  question text NOT NULL,
  variable_changed text,
  change_value text,
  baseline_metric numeric(14,2),
  projected_metric numeric(14,2),
  impact_delta numeric(14,2),
  impact_percent numeric(5,2) DEFAULT 0,
  time_horizon text DEFAULT '90d' CHECK (time_horizon IN ('7d','14d','30d','60d','90d','180d','365d')),
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_what_if_analysis_workspace ON what_if_analysis(workspace_id);
ALTER TABLE what_if_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_what_if_analysis" ON what_if_analysis FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = what_if_analysis.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_what_if_analysis" ON what_if_analysis FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = what_if_analysis.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_what_if_analysis" ON what_if_analysis FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = what_if_analysis.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = what_if_analysis.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_what_if_analysis" ON what_if_analysis FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = what_if_analysis.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SIMULATIONS
-- ============================================================
CREATE TABLE simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_model_id uuid REFERENCES scenario_models(id) ON DELETE SET NULL,
  simulation_name text NOT NULL,
  simulation_type text DEFAULT 'deterministic' CHECK (simulation_type IN ('deterministic','stochastic','monte_carlo','sensitivity')),
  iterations integer DEFAULT 1,
  results jsonb DEFAULT '{}'::jsonb,
  summary text,
  confidence_interval jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_simulations_workspace ON simulations(workspace_id);
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_simulations" ON simulations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = simulations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_simulations" ON simulations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = simulations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_simulations" ON simulations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = simulations.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = simulations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_simulations" ON simulations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = simulations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- REVENUE SCENARIOS
-- ============================================================
CREATE TABLE revenue_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_name text NOT NULL,
  scenario_description text,
  baseline_revenue numeric(14,2) DEFAULT 0,
  projected_revenue numeric(14,2) DEFAULT 0,
  revenue_delta numeric(14,2) DEFAULT 0,
  revenue_delta_percent numeric(5,2) DEFAULT 0,
  assumptions jsonb DEFAULT '[]'::jsonb,
  time_horizon text DEFAULT '90d',
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_scenarios_workspace ON revenue_scenarios(workspace_id);
ALTER TABLE revenue_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_scenarios" ON revenue_scenarios FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_scenarios" ON revenue_scenarios FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_scenarios" ON revenue_scenarios FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_scenarios.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_scenarios" ON revenue_scenarios FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_scenarios.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- HIRING SCENARIOS
-- ============================================================
CREATE TABLE hiring_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_name text NOT NULL,
  scenario_description text,
  role_type text NOT NULL,
  headcount integer DEFAULT 1,
  annual_cost_per_head numeric(14,2) DEFAULT 0,
  total_annual_cost numeric(14,2) DEFAULT 0,
  estimated_revenue_impact numeric(14,2) DEFAULT 0,
  estimated_pipeline_impact numeric(14,2) DEFAULT 0,
  estimated_efficiency_gain numeric(5,2) DEFAULT 0,
  payback_period_months integer DEFAULT 0,
  roi numeric(5,2) DEFAULT 0,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hiring_scenarios_workspace ON hiring_scenarios(workspace_id);
ALTER TABLE hiring_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_hiring_scenarios" ON hiring_scenarios FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = hiring_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_hiring_scenarios" ON hiring_scenarios FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = hiring_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_hiring_scenarios" ON hiring_scenarios FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = hiring_scenarios.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = hiring_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_hiring_scenarios" ON hiring_scenarios FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = hiring_scenarios.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INVESTMENT SCENARIOS
-- ============================================================
CREATE TABLE investment_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_name text NOT NULL,
  scenario_description text,
  investment_type text DEFAULT 'growth' CHECK (investment_type IN ('growth','infrastructure','marketing','sales','product','market_expansion','acquisition','rnd')),
  investment_amount numeric(14,2) DEFAULT 0,
  estimated_return numeric(14,2) DEFAULT 0,
  estimated_roi numeric(5,2) DEFAULT 0,
  payback_period_months integer DEFAULT 0,
  risk_level text DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','very_high')),
  assumptions jsonb DEFAULT '[]'::jsonb,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_investment_scenarios_workspace ON investment_scenarios(workspace_id);
ALTER TABLE investment_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_investment_scenarios" ON investment_scenarios FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investment_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_investment_scenarios" ON investment_scenarios FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investment_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_investment_scenarios" ON investment_scenarios FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investment_scenarios.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investment_scenarios.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_investment_scenarios" ON investment_scenarios FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investment_scenarios.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- DECISION FEEDBACK
-- ============================================================
CREATE TABLE decision_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES ai_ceo_decisions(id) ON DELETE SET NULL,
  autonomous_decision_id uuid REFERENCES autonomous_decisions(id) ON DELETE SET NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('positive','negative','neutral','corrective','reinforcing')),
  feedback_text text,
  actual_outcome text,
  expected_outcome text,
  outcome_delta numeric(14,2) DEFAULT 0,
  lesson_learned text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_decision_feedback_workspace ON decision_feedback(workspace_id);
CREATE INDEX idx_decision_feedback_decision ON decision_feedback(decision_id);
ALTER TABLE decision_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_decision_feedback" ON decision_feedback FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_feedback.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_decision_feedback" ON decision_feedback FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_feedback.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_decision_feedback" ON decision_feedback FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_feedback.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_feedback.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_decision_feedback" ON decision_feedback FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = decision_feedback.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- RECOMMENDATION ACCURACY
-- ============================================================
CREATE TABLE recommendation_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES executive_recommendations(id) ON DELETE SET NULL,
  recommendation_type text,
  was_adopted boolean DEFAULT false,
  adoption_delay_days integer,
  actual_impact numeric(14,2),
  predicted_impact numeric(14,2),
  accuracy_score numeric(5,2) DEFAULT 0,
  feedback text,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recommendation_accuracy_workspace ON recommendation_accuracy(workspace_id);
ALTER TABLE recommendation_accuracy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_recommendation_accuracy" ON recommendation_accuracy FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recommendation_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_recommendation_accuracy" ON recommendation_accuracy FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recommendation_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_recommendation_accuracy" ON recommendation_accuracy FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recommendation_accuracy.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recommendation_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_recommendation_accuracy" ON recommendation_accuracy FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = recommendation_accuracy.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PREDICTION ACCURACY
-- ============================================================
CREATE TABLE prediction_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prediction_id uuid REFERENCES ai_ceo_predictions(id) ON DELETE SET NULL,
  prediction_type text,
  predicted_value numeric(14,2),
  actual_value numeric(14,2),
  error_percent numeric(5,2) DEFAULT 0,
  accuracy_score numeric(5,2) DEFAULT 0,
  was_accurate boolean DEFAULT false,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prediction_accuracy_workspace ON prediction_accuracy(workspace_id);
ALTER TABLE prediction_accuracy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_prediction_accuracy" ON prediction_accuracy FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prediction_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_prediction_accuracy" ON prediction_accuracy FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prediction_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_prediction_accuracy" ON prediction_accuracy FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prediction_accuracy.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prediction_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_prediction_accuracy" ON prediction_accuracy FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prediction_accuracy.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE LEARNING
-- ============================================================
CREATE TABLE executive_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  learning_type text NOT NULL CHECK (learning_type IN ('decision_pattern','risk_pattern','opportunity_pattern','market_pattern','customer_pattern','financial_pattern','operational_pattern','strategic_pattern','behavioral_pattern')),
  learning_title text NOT NULL,
  learning_description text,
  learning_data jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.7,
  times_observed integer DEFAULT 1,
  last_observed_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_executive_learning_workspace ON executive_learning(workspace_id);
CREATE INDEX idx_executive_learning_type ON executive_learning(learning_type);
ALTER TABLE executive_learning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_executive_learning" ON executive_learning FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_learning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_executive_learning" ON executive_learning FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_learning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_executive_learning" ON executive_learning FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_learning.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_learning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_executive_learning" ON executive_learning FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_learning.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS (Part 2)
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'anomaly_detection','trend_detection','strategic_alerts','performance_alerts','executive_notifications',
    'autonomous_tasks','autonomous_workflows','autonomous_decisions',
    'scenario_models','what_if_analysis','simulations','revenue_scenarios','hiring_scenarios','investment_scenarios',
    'decision_feedback','recommendation_accuracy','prediction_accuracy','executive_learning'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%I_ceo_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trigger_%I_ceo_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_ceo_updated_at();', t, t);
  END LOOP;
END $$;
