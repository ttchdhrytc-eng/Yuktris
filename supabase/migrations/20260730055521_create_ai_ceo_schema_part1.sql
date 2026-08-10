/*
# Phase 15 Part 1 — AI CEO: State, Memory, Objectives, Goals, Metrics, Decisions, Reasoning, Actions, Observations, Predictions
*/

-- ============================================================
-- AI CEO STATE
-- ============================================================
CREATE TABLE ai_ceo_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  overall_company_score numeric(5,2) DEFAULT 0,
  health_score numeric(5,2) DEFAULT 0,
  growth_score numeric(5,2) DEFAULT 0,
  efficiency_score numeric(5,2) DEFAULT 0,
  risk_score numeric(5,2) DEFAULT 0,
  opportunity_score numeric(5,2) DEFAULT 0,
  last_analysis_at timestamptz,
  last_brief_at timestamptz,
  last_monitor_at timestamptz,
  active_objectives_count integer DEFAULT 0,
  active_risks_count integer DEFAULT 0,
  active_opportunities_count integer DEFAULT 0,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_state_workspace ON ai_ceo_state(workspace_id);
ALTER TABLE ai_ceo_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_state" ON ai_ceo_state FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_state.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_state" ON ai_ceo_state FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_state.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_state" ON ai_ceo_state FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_state.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_state.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_state" ON ai_ceo_state FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_state.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO MEMORY
-- ============================================================
CREATE TABLE ai_ceo_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('analysis','brief','decision','risk','opportunity','prediction','observation','learning','feedback','scenario','plan')),
  memory_title text NOT NULL,
  memory_content text,
  memory_data jsonb DEFAULT '{}'::jsonb,
  importance_score numeric DEFAULT 0.5,
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_memory_workspace ON ai_ceo_memory(workspace_id);
CREATE INDEX idx_ai_ceo_memory_type ON ai_ceo_memory(memory_type);
ALTER TABLE ai_ceo_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_memory" ON ai_ceo_memory FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_memory.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_memory" ON ai_ceo_memory FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_memory.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_memory" ON ai_ceo_memory FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_memory.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_memory.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_memory" ON ai_ceo_memory FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_memory.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO OBJECTIVES
-- ============================================================
CREATE TABLE ai_ceo_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  objective_name text NOT NULL,
  objective_description text,
  objective_type text DEFAULT 'strategic' CHECK (objective_type IN ('strategic','operational','financial','growth','efficiency','customer','market','team')),
  priority text DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  status text DEFAULT 'active' CHECK (status IN ('active','completed','paused','archived')),
  target_value numeric(14,2),
  current_value numeric(14,2),
  progress_percent numeric(5,2) DEFAULT 0,
  target_date date,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_objectives_workspace ON ai_ceo_objectives(workspace_id);
CREATE INDEX idx_ai_ceo_objectives_status ON ai_ceo_objectives(status);
ALTER TABLE ai_ceo_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_objectives" ON ai_ceo_objectives FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_objectives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_objectives" ON ai_ceo_objectives FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_objectives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_objectives" ON ai_ceo_objectives FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_objectives.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_objectives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_objectives" ON ai_ceo_objectives FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_objectives.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO GOALS
-- ============================================================
CREATE TABLE ai_ceo_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  objective_id uuid REFERENCES ai_ceo_objectives(id) ON DELETE CASCADE,
  goal_name text NOT NULL,
  goal_description text,
  goal_type text DEFAULT 'quarterly' CHECK (goal_type IN ('monthly','quarterly','annual','custom')),
  target_metric text,
  target_value numeric(14,2),
  current_value numeric(14,2) DEFAULT 0,
  progress_percent numeric(5,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active','on_track','at_risk','behind','completed','failed')),
  due_date date,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_goals_workspace ON ai_ceo_goals(workspace_id);
CREATE INDEX idx_ai_ceo_goals_objective ON ai_ceo_goals(objective_id);
ALTER TABLE ai_ceo_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_goals" ON ai_ceo_goals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_goals" ON ai_ceo_goals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_goals" ON ai_ceo_goals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_goals.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_goals" ON ai_ceo_goals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_goals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO METRICS
-- ============================================================
CREATE TABLE ai_ceo_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_category text NOT NULL CHECK (metric_category IN ('revenue','growth','efficiency','operational','customer','financial','sales','marketing','team','market')),
  metric_value numeric(14,2),
  metric_unit text,
  metric_target numeric(14,2),
  metric_trend text DEFAULT 'stable' CHECK (metric_trend IN ('up','down','stable','volatile')),
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_metrics_workspace ON ai_ceo_metrics(workspace_id);
CREATE INDEX idx_ai_ceo_metrics_category ON ai_ceo_metrics(metric_category);
CREATE INDEX idx_ai_ceo_metrics_date ON ai_ceo_metrics(measurement_date DESC);
ALTER TABLE ai_ceo_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_metrics" ON ai_ceo_metrics FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_metrics" ON ai_ceo_metrics FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_metrics" ON ai_ceo_metrics FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_metrics.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_metrics" ON ai_ceo_metrics FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_metrics.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO DECISIONS
-- ============================================================
CREATE TABLE ai_ceo_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_title text NOT NULL,
  decision_description text,
  decision_type text DEFAULT 'strategic' CHECK (decision_type IN ('strategic','operational','financial','hiring','investment','market','product','customer','pricing','growth')),
  decision_status text DEFAULT 'recommended' CHECK (decision_status IN ('recommended','approved','rejected','executing','completed','archived')),
  impact_level text DEFAULT 'medium' CHECK (impact_level IN ('low','medium','high','critical')),
  estimated_impact numeric(14,2),
  confidence numeric DEFAULT 0.7,
  reasoning text,
  alternatives jsonb DEFAULT '[]'::jsonb,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  executed_at timestamptz,
  outcome text,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_decisions_workspace ON ai_ceo_decisions(workspace_id);
CREATE INDEX idx_ai_ceo_decisions_status ON ai_ceo_decisions(decision_status);
ALTER TABLE ai_ceo_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_decisions" ON ai_ceo_decisions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_decisions" ON ai_ceo_decisions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_decisions" ON ai_ceo_decisions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_decisions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_decisions" ON ai_ceo_decisions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_decisions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO REASONING
-- ============================================================
CREATE TABLE ai_ceo_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reasoning_type text NOT NULL CHECK (reasoning_type IN ('analysis','decision','prediction','recommendation','risk_assessment','opportunity_assessment','scenario','learning')),
  reasoning_title text NOT NULL,
  reasoning_text text,
  reasoning_chain jsonb DEFAULT '[]'::jsonb,
  confidence numeric DEFAULT 0.7,
  related_entity_id uuid,
  related_entity_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_reasoning_workspace ON ai_ceo_reasoning(workspace_id);
CREATE INDEX idx_ai_ceo_reasoning_type ON ai_ceo_reasoning(reasoning_type);
ALTER TABLE ai_ceo_reasoning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_reasoning" ON ai_ceo_reasoning FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_reasoning" ON ai_ceo_reasoning FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_reasoning" ON ai_ceo_reasoning FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_reasoning.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_reasoning" ON ai_ceo_reasoning FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_reasoning.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO ACTIONS
-- ============================================================
CREATE TABLE ai_ceo_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES ai_ceo_decisions(id) ON DELETE SET NULL,
  action_title text NOT NULL,
  action_description text,
  action_type text DEFAULT 'recommendation' CHECK (action_type IN ('recommendation','task','notification','workflow','autonomous')),
  action_status text DEFAULT 'pending' CHECK (action_status IN ('pending','approved','executing','completed','failed','cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  assigned_to text,
  due_date date,
  executed_at timestamptz,
  result text,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_actions_workspace ON ai_ceo_actions(workspace_id);
CREATE INDEX idx_ai_ceo_actions_status ON ai_ceo_actions(action_status);
ALTER TABLE ai_ceo_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_actions" ON ai_ceo_actions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_actions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_actions" ON ai_ceo_actions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_actions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_actions" ON ai_ceo_actions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_actions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_actions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_actions" ON ai_ceo_actions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_actions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO OBSERVATIONS
-- ============================================================
CREATE TABLE ai_ceo_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  observation_type text NOT NULL CHECK (observation_type IN ('trend','anomaly','change','milestone','alert','insight','pattern','benchmark')),
  observation_title text NOT NULL,
  observation_description text,
  observation_data jsonb DEFAULT '{}'::jsonb,
  severity text DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  source_module text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_observations_workspace ON ai_ceo_observations(workspace_id);
CREATE INDEX idx_ai_ceo_observations_type ON ai_ceo_observations(observation_type);
ALTER TABLE ai_ceo_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_observations" ON ai_ceo_observations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_observations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_observations" ON ai_ceo_observations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_observations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_observations" ON ai_ceo_observations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_observations.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_observations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_observations" ON ai_ceo_observations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_observations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- AI CEO PREDICTIONS
-- ============================================================
CREATE TABLE ai_ceo_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prediction_type text NOT NULL CHECK (prediction_type IN ('revenue','churn','growth','pipeline','cashflow','market','hiring','competitive','customer','product')),
  prediction_title text NOT NULL,
  prediction_description text,
  prediction_value numeric(14,2),
  prediction_confidence numeric DEFAULT 0.7,
  prediction_horizon text DEFAULT '30d' CHECK (prediction_horizon IN ('7d','14d','30d','60d','90d','180d','365d')),
  prediction_data jsonb DEFAULT '{}'::jsonb,
  actual_value numeric(14,2),
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  accuracy_score numeric(5,2),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_predictions_workspace ON ai_ceo_predictions(workspace_id);
CREATE INDEX idx_ai_ceo_predictions_type ON ai_ceo_predictions(prediction_type);
ALTER TABLE ai_ceo_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_predictions" ON ai_ceo_predictions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_predictions" ON ai_ceo_predictions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_predictions" ON ai_ceo_predictions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_predictions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_predictions" ON ai_ceo_predictions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_predictions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- STRATEGIC INITIATIVES
-- ============================================================
CREATE TABLE strategic_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  initiative_name text NOT NULL,
  initiative_description text,
  initiative_type text DEFAULT 'growth' CHECK (initiative_type IN ('growth','efficiency','market','product','customer','operational','transformation','expansion')),
  status text DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  start_date date,
  target_end_date date,
  actual_end_date date,
  progress_percent numeric(5,2) DEFAULT 0,
  owner text,
  budget numeric(14,2) DEFAULT 0,
  expected_roi numeric(5,2) DEFAULT 0,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_strategic_initiatives_workspace ON strategic_initiatives(workspace_id);
CREATE INDEX idx_strategic_initiatives_status ON strategic_initiatives(status);
ALTER TABLE strategic_initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_strategic_initiatives" ON strategic_initiatives FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_initiatives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_strategic_initiatives" ON strategic_initiatives FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_initiatives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_strategic_initiatives" ON strategic_initiatives FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_initiatives.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_initiatives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_strategic_initiatives" ON strategic_initiatives FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategic_initiatives.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- COMPANY PRIORITIES
-- ============================================================
CREATE TABLE company_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  priority_name text NOT NULL,
  priority_description text,
  priority_level integer DEFAULT 3 CHECK (priority_level >= 1 AND priority_level <= 5),
  priority_category text DEFAULT 'strategic' CHECK (priority_category IN ('strategic','operational','financial','customer','growth','team','market','risk')),
  status text DEFAULT 'active' CHECK (status IN ('active','completed','deferred','cancelled')),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_priorities_workspace ON company_priorities(workspace_id);
CREATE INDEX idx_company_priorities_level ON company_priorities(priority_level);
ALTER TABLE company_priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_company_priorities" ON company_priorities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_priorities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_company_priorities" ON company_priorities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_priorities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_company_priorities" ON company_priorities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_priorities.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_priorities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_company_priorities" ON company_priorities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_priorities.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- QUARTERLY GOALS
-- ============================================================
CREATE TABLE quarterly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quarter text NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  goal_name text NOT NULL,
  goal_description text,
  goal_category text DEFAULT 'revenue' CHECK (goal_category IN ('revenue','growth','customer','market','product','team','operational','financial')),
  target_value numeric(14,2),
  current_value numeric(14,2) DEFAULT 0,
  progress_percent numeric(5,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active','on_track','at_risk','behind','completed','failed')),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quarterly_goals_workspace ON quarterly_goals(workspace_id);
CREATE INDEX idx_quarterly_goals_quarter ON quarterly_goals(quarter, year);
ALTER TABLE quarterly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_quarterly_goals" ON quarterly_goals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = quarterly_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_quarterly_goals" ON quarterly_goals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = quarterly_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_quarterly_goals" ON quarterly_goals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = quarterly_goals.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = quarterly_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_quarterly_goals" ON quarterly_goals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = quarterly_goals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ANNUAL GOALS
-- ============================================================
CREATE TABLE annual_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  goal_name text NOT NULL,
  goal_description text,
  goal_category text DEFAULT 'revenue' CHECK (goal_category IN ('revenue','growth','customer','market','product','team','operational','financial')),
  target_value numeric(14,2),
  current_value numeric(14,2) DEFAULT 0,
  progress_percent numeric(5,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active','on_track','at_risk','behind','completed','failed')),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_annual_goals_workspace ON annual_goals(workspace_id);
CREATE INDEX idx_annual_goals_year ON annual_goals(year);
ALTER TABLE annual_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_annual_goals" ON annual_goals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_annual_goals" ON annual_goals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_annual_goals" ON annual_goals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_goals.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_annual_goals" ON annual_goals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_goals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- OKRS
-- ============================================================
CREATE TABLE okrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  objective_text text NOT NULL,
  objective_description text,
  quarter text NOT NULL,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  owner text,
  status text DEFAULT 'active' CHECK (status IN ('active','completed','at_risk','behind','cancelled')),
  progress_percent numeric(5,2) DEFAULT 0,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_okrs_workspace ON okrs(workspace_id);
CREATE INDEX idx_okrs_quarter ON okrs(quarter, year);
ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_okrs" ON okrs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = okrs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_okrs" ON okrs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = okrs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_okrs" ON okrs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = okrs.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = okrs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_okrs" ON okrs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = okrs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- KEY RESULTS
-- ============================================================
CREATE TABLE key_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  okr_id uuid NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  key_result_text text NOT NULL,
  key_result_description text,
  target_value numeric(14,2),
  current_value numeric(14,2) DEFAULT 0,
  progress_percent numeric(5,2) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active','on_track','at_risk','behind','completed','failed')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_key_results_workspace ON key_results(workspace_id);
CREATE INDEX idx_key_results_okr ON key_results(okr_id);
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_key_results" ON key_results FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = key_results.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_key_results" ON key_results FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = key_results.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_key_results" ON key_results FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = key_results.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = key_results.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_key_results" ON key_results FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = key_results.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INITIATIVES
-- ============================================================
CREATE TABLE initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  strategic_initiative_id uuid REFERENCES strategic_initiatives(id) ON DELETE SET NULL,
  initiative_name text NOT NULL,
  initiative_description text,
  initiative_owner text,
  status text DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','on_hold','cancelled')),
  start_date date,
  end_date date,
  progress_percent numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_initiatives_workspace ON initiatives(workspace_id);
CREATE INDEX idx_initiatives_status ON initiatives(status);
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_initiatives" ON initiatives FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiatives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_initiatives" ON initiatives FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiatives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_initiatives" ON initiatives FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiatives.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiatives.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_initiatives" ON initiatives FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiatives.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INITIATIVE PROGRESS
-- ============================================================
CREATE TABLE initiative_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  initiative_id uuid NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  progress_date date NOT NULL DEFAULT CURRENT_DATE,
  progress_percent numeric(5,2) DEFAULT 0,
  progress_notes text,
  milestones_completed integer DEFAULT 0,
  milestones_total integer DEFAULT 0,
  blockers text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_initiative_progress_workspace ON initiative_progress(workspace_id);
CREATE INDEX idx_initiative_progress_initiative ON initiative_progress(initiative_id);
ALTER TABLE initiative_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_initiative_progress" ON initiative_progress FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiative_progress.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_initiative_progress" ON initiative_progress FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiative_progress.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_initiative_progress" ON initiative_progress FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiative_progress.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiative_progress.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_initiative_progress" ON initiative_progress FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = initiative_progress.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE DECISIONS
-- ============================================================
CREATE TABLE executive_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_title text NOT NULL,
  decision_description text,
  decision_category text DEFAULT 'strategic' CHECK (decision_category IN ('strategic','financial','operational','hiring','investment','market','product','pricing')),
  decision_maker text,
  impact_assessment text,
  financial_impact numeric(14,2) DEFAULT 0,
  risk_assessment text,
  status text DEFAULT 'proposed' CHECK (status IN ('proposed','under_review','approved','rejected','implemented')),
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_executive_decisions_workspace ON executive_decisions(workspace_id);
CREATE INDEX idx_executive_decisions_status ON executive_decisions(status);
ALTER TABLE executive_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_executive_decisions" ON executive_decisions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_executive_decisions" ON executive_decisions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_executive_decisions" ON executive_decisions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_decisions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_executive_decisions" ON executive_decisions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_decisions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE RECOMMENDATIONS
-- ============================================================
CREATE TABLE executive_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  recommendation_title text NOT NULL,
  recommendation_description text,
  recommendation_type text DEFAULT 'immediate' CHECK (recommendation_type IN ('immediate','short_term','long_term','strategic','investment','hiring','market','revenue')),
  priority text DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  expected_impact text,
  estimated_value numeric(14,2) DEFAULT 0,
  confidence numeric DEFAULT 0.7,
  status text DEFAULT 'active' CHECK (status IN ('active','accepted','rejected','implemented','archived')),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_executive_recommendations_workspace ON executive_recommendations(workspace_id);
CREATE INDEX idx_executive_recommendations_type ON executive_recommendations(recommendation_type);
ALTER TABLE executive_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_executive_recommendations" ON executive_recommendations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_executive_recommendations" ON executive_recommendations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_executive_recommendations" ON executive_recommendations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_recommendations.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_executive_recommendations" ON executive_recommendations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_recommendations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE RISKS
-- ============================================================
CREATE TABLE executive_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  risk_title text NOT NULL,
  risk_description text,
  risk_category text DEFAULT 'operational' CHECK (risk_category IN ('revenue','pipeline','customer','financial','operational','market','competitive','regulatory','team','technology')),
  risk_level text DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  probability numeric(5,2) DEFAULT 50,
  impact numeric(14,2) DEFAULT 0,
  mitigation_strategy text,
  status text DEFAULT 'active' CHECK (status IN ('active','mitigated','resolved','ignored')),
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_executive_risks_workspace ON executive_risks(workspace_id);
CREATE INDEX idx_executive_risks_level ON executive_risks(risk_level);
ALTER TABLE executive_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_executive_risks" ON executive_risks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_risks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_executive_risks" ON executive_risks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_risks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_executive_risks" ON executive_risks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_risks.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_risks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_executive_risks" ON executive_risks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_risks.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE OPPORTUNITIES
-- ============================================================
CREATE TABLE executive_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  opportunity_title text NOT NULL,
  opportunity_description text,
  opportunity_type text DEFAULT 'growth' CHECK (opportunity_type IN ('upsell','cross_sell','enterprise','new_industry','new_market','pricing','sales_efficiency','marketing','referral','hiring','partnership','product','expansion')),
  estimated_value numeric(14,2) DEFAULT 0,
  probability numeric(5,2) DEFAULT 50,
  time_horizon text DEFAULT '30d' CHECK (time_horizon IN ('7d','14d','30d','60d','90d','180d','365d')),
  status text DEFAULT 'identified' CHECK (status IN ('identified','evaluating','approved','in_progress','captured','missed')),
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_executive_opportunities_workspace ON executive_opportunities(workspace_id);
CREATE INDEX idx_executive_opportunities_type ON executive_opportunities(opportunity_type);
ALTER TABLE executive_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_executive_opportunities" ON executive_opportunities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_executive_opportunities" ON executive_opportunities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_executive_opportunities" ON executive_opportunities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_opportunities.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_executive_opportunities" ON executive_opportunities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_opportunities.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE BRIEFS
-- ============================================================
CREATE TABLE ai_ceo_executive_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brief_date date NOT NULL DEFAULT CURRENT_DATE,
  executive_summary text,
  wins text,
  losses text,
  risks text,
  revenue_summary text,
  forecast_summary text,
  customer_health_summary text,
  finance_summary text,
  cashflow_summary text,
  hiring_summary text,
  growth_summary text,
  competition_summary text,
  strategic_priorities text,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.75,
  full_brief jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_executive_briefs_workspace ON ai_ceo_executive_briefs(workspace_id);
CREATE INDEX idx_ai_ceo_executive_briefs_date ON ai_ceo_executive_briefs(brief_date DESC);
ALTER TABLE ai_ceo_executive_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_executive_briefs" ON ai_ceo_executive_briefs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_executive_briefs" ON ai_ceo_executive_briefs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_executive_briefs" ON ai_ceo_executive_briefs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_briefs.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_executive_briefs" ON ai_ceo_executive_briefs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_briefs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE REPORTS
-- ============================================================
CREATE TABLE ai_ceo_executive_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('weekly','monthly','quarterly','annual','ad_hoc','board','investor')),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  report_title text NOT NULL,
  report_content text,
  report_data jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.75,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_ceo_executive_reports_workspace ON ai_ceo_executive_reports(workspace_id);
CREATE INDEX idx_ai_ceo_executive_reports_type ON ai_ceo_executive_reports(report_type);
ALTER TABLE ai_ceo_executive_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_ceo_executive_reports" ON ai_ceo_executive_reports FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_ai_ceo_executive_reports" ON ai_ceo_executive_reports FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_ai_ceo_executive_reports" ON ai_ceo_executive_reports FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_reports.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_ai_ceo_executive_reports" ON ai_ceo_executive_reports FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = ai_ceo_executive_reports.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- BOARD REPORTS
-- ============================================================
CREATE TABLE board_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  report_period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  revenue_summary text,
  forecast_summary text,
  pipeline_summary text,
  profit_summary text,
  customer_summary text,
  risk_summary text,
  opportunity_summary text,
  strategic_summary text,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.75,
  full_report jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_reports_workspace ON board_reports(workspace_id);
CREATE INDEX idx_board_reports_period ON board_reports(report_period);
ALTER TABLE board_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_board_reports" ON board_reports FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = board_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_board_reports" ON board_reports FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = board_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_board_reports" ON board_reports FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = board_reports.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = board_reports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_board_reports" ON board_reports FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = board_reports.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INVESTOR UPDATES
-- ============================================================
CREATE TABLE investor_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  update_period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  headline_metrics jsonb DEFAULT '{}'::jsonb,
  revenue_performance text,
  growth_metrics text,
  burn_rate text,
  runway text,
  key_wins text,
  key_challenges text,
  strategic_focus text,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.75,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_investor_updates_workspace ON investor_updates(workspace_id);
ALTER TABLE investor_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_investor_updates" ON investor_updates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investor_updates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_investor_updates" ON investor_updates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investor_updates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_investor_updates" ON investor_updates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investor_updates.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investor_updates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_investor_updates" ON investor_updates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = investor_updates.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- COMPANY HEALTH
-- ============================================================
CREATE TABLE company_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_score numeric(5,2) DEFAULT 0,
  revenue_health numeric(5,2) DEFAULT 0,
  pipeline_health numeric(5,2) DEFAULT 0,
  customer_health numeric(5,2) DEFAULT 0,
  team_health numeric(5,2) DEFAULT 0,
  financial_health numeric(5,2) DEFAULT 0,
  market_health numeric(5,2) DEFAULT 0,
  operational_health numeric(5,2) DEFAULT 0,
  growth_health numeric(5,2) DEFAULT 0,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.75,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_health_workspace ON company_health(workspace_id);
CREATE INDEX idx_company_health_date ON company_health(measurement_date DESC);
ALTER TABLE company_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_company_health" ON company_health FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_company_health" ON company_health FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_company_health" ON company_health FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_health.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_company_health" ON company_health FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_health.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- HEALTH DIMENSIONS
-- ============================================================
CREATE TABLE health_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_health_id uuid REFERENCES company_health(id) ON DELETE SET NULL,
  dimension_name text NOT NULL,
  dimension_score numeric(5,2) DEFAULT 0,
  dimension_status text DEFAULT 'healthy' CHECK (dimension_status IN ('healthy','warning','critical','unknown')),
  trend text DEFAULT 'stable' CHECK (trend IN ('improving','stable','declining','volatile')),
  contributing_factors jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_dimensions_workspace ON health_dimensions(workspace_id);
CREATE INDEX idx_health_dimensions_health ON health_dimensions(company_health_id);
ALTER TABLE health_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_health_dimensions" ON health_dimensions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = health_dimensions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_health_dimensions" ON health_dimensions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = health_dimensions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_health_dimensions" ON health_dimensions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = health_dimensions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = health_dimensions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_health_dimensions" ON health_dimensions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = health_dimensions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- GROWTH METRICS
-- ============================================================
CREATE TABLE growth_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric(14,2),
  previous_value numeric(14,2),
  growth_rate numeric(5,2) DEFAULT 0,
  growth_type text DEFAULT 'absolute' CHECK (growth_type IN ('absolute','percentage','compound','exponential')),
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_growth_metrics_workspace ON growth_metrics(workspace_id);
CREATE INDEX idx_growth_metrics_date ON growth_metrics(measurement_date DESC);
ALTER TABLE growth_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_growth_metrics" ON growth_metrics FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = growth_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_growth_metrics" ON growth_metrics FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = growth_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_growth_metrics" ON growth_metrics FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = growth_metrics.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = growth_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_growth_metrics" ON growth_metrics FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = growth_metrics.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EFFICIENCY METRICS
-- ============================================================
CREATE TABLE efficiency_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric(14,2),
  benchmark_value numeric(14,2),
  efficiency_ratio numeric(5,2) DEFAULT 0,
  metric_unit text,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_efficiency_metrics_workspace ON efficiency_metrics(workspace_id);
CREATE INDEX idx_efficiency_metrics_date ON efficiency_metrics(measurement_date DESC);
ALTER TABLE efficiency_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_efficiency_metrics" ON efficiency_metrics FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = efficiency_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_efficiency_metrics" ON efficiency_metrics FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = efficiency_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_efficiency_metrics" ON efficiency_metrics FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = efficiency_metrics.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = efficiency_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_efficiency_metrics" ON efficiency_metrics FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = efficiency_metrics.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- OPERATIONAL METRICS
-- ============================================================
CREATE TABLE operational_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric(14,2),
  metric_unit text,
  metric_category text DEFAULT 'general' CHECK (metric_category IN ('sales','marketing','customer_success','finance','operations','team','product','general')),
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_operational_metrics_workspace ON operational_metrics(workspace_id);
CREATE INDEX idx_operational_metrics_category ON operational_metrics(metric_category);
CREATE INDEX idx_operational_metrics_date ON operational_metrics(measurement_date DESC);
ALTER TABLE operational_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_operational_metrics" ON operational_metrics FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = operational_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_operational_metrics" ON operational_metrics FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = operational_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_operational_metrics" ON operational_metrics FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = operational_metrics.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = operational_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_operational_metrics" ON operational_metrics FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = operational_metrics.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- BUSINESS SCORECARDS
-- ============================================================
CREATE TABLE business_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scorecard_name text NOT NULL,
  scorecard_period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  overall_score numeric(5,2) DEFAULT 0,
  dimensions jsonb DEFAULT '{}'::jsonb,
  kpis jsonb DEFAULT '[]'::jsonb,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.75,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_business_scorecards_workspace ON business_scorecards(workspace_id);
ALTER TABLE business_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_business_scorecards" ON business_scorecards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = business_scorecards.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_business_scorecards" ON business_scorecards FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = business_scorecards.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_business_scorecards" ON business_scorecards FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = business_scorecards.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = business_scorecards.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_business_scorecards" ON business_scorecards FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = business_scorecards.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS (Part 1)
-- ============================================================
CREATE OR REPLACE FUNCTION update_ceo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_ceo_state','ai_ceo_objectives','ai_ceo_goals','ai_ceo_decisions','ai_ceo_actions',
    'strategic_initiatives','company_priorities','quarterly_goals','annual_goals','okrs','key_results',
    'initiatives','initiative_progress',
    'executive_decisions','executive_recommendations','executive_risks','executive_opportunities',
    'board_reports','investor_updates','company_health'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%I_ceo_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trigger_%I_ceo_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_ceo_updated_at();', t, t);
  END LOOP;
END $$;
