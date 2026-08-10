/*
# Phase 20 — Autonomous Revenue Execution Engine (Part 1/3)

## Autonomous Execution Engine Tables

Note: `autopilot_execution_history` used instead of `execution_history` because
an earlier phase already created an `execution_history` table.

### New Tables (12)
1. autonomous_execution_cycles — Top-level execution cycle records (continuous business evaluation runs)
2. execution_plans — AI-generated plans for executing work
3. execution_sessions — Individual execution sessions within a plan
4. execution_actions — Atomic actions within a session
5. execution_results — Outcome measurements for actions
6. execution_metrics — KPIs tracked per cycle/session/action
7. execution_failures — Failed execution records with error details
8. execution_learning — Learning snapshots from execution outcomes
9. execution_recommendations — AI-generated recommendations from analysis
10. execution_confidence — Confidence scores for AI decisions
11. execution_approvals — Human approval queue for semi-autonomous mode
12. autopilot_execution_history — Full audit trail of all execution events

### Security
- RLS enabled on every table
- 4 CRUD policies per table scoped via workspace_members join
- All tables have workspace_id for isolation
- All tables have indexes on workspace_id and frequently-queried columns
*/

-- 1. autonomous_execution_cycles
CREATE TABLE IF NOT EXISTS autonomous_execution_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  cycle_name text NOT NULL,
  cycle_status text NOT NULL DEFAULT 'pending' CHECK (cycle_status IN ('pending','running','completed','failed','cancelled','paused')),
  cycle_type text NOT NULL DEFAULT 'business_evaluation' CHECK (cycle_type IN ('business_evaluation','opportunity_detection','plan_generation','execution','measurement','learning','optimization')),
  triggered_by text NOT NULL DEFAULT 'system' CHECK (triggered_by IN ('system','user','ai_ceo','business_event','schedule','manual')),
  trigger_source text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  actions_executed integer NOT NULL DEFAULT 0,
  actions_succeeded integer NOT NULL DEFAULT 0,
  actions_failed integer NOT NULL DEFAULT 0,
  opportunities_detected integer NOT NULL DEFAULT 0,
  estimated_roi numeric,
  actual_roi numeric,
  cycle_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE autonomous_execution_cycles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_auto_exec_cycles_workspace ON autonomous_execution_cycles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_auto_exec_cycles_status ON autonomous_execution_cycles(cycle_status);
CREATE INDEX IF NOT EXISTS idx_auto_exec_cycles_type ON autonomous_execution_cycles(cycle_type);
CREATE INDEX IF NOT EXISTS idx_auto_exec_cycles_created ON autonomous_execution_cycles(created_at DESC);

DROP POLICY IF EXISTS "select_own_auto_exec_cycles" ON autonomous_execution_cycles;
CREATE POLICY "select_own_auto_exec_cycles" ON autonomous_execution_cycles FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autonomous_execution_cycles.workspace_id));
DROP POLICY IF EXISTS "insert_own_auto_exec_cycles" ON autonomous_execution_cycles;
CREATE POLICY "insert_own_auto_exec_cycles" ON autonomous_execution_cycles FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autonomous_execution_cycles.workspace_id));
DROP POLICY IF EXISTS "update_own_auto_exec_cycles" ON autonomous_execution_cycles;
CREATE POLICY "update_own_auto_exec_cycles" ON autonomous_execution_cycles FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autonomous_execution_cycles.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autonomous_execution_cycles.workspace_id));
DROP POLICY IF EXISTS "delete_own_auto_exec_cycles" ON autonomous_execution_cycles;
CREATE POLICY "delete_own_auto_exec_cycles" ON autonomous_execution_cycles FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autonomous_execution_cycles.workspace_id));

-- 2. execution_plans
CREATE TABLE IF NOT EXISTS execution_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  cycle_id uuid REFERENCES autonomous_execution_cycles(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  plan_description text,
  plan_status text NOT NULL DEFAULT 'draft' CHECK (plan_status IN ('draft','pending_approval','approved','executing','completed','failed','cancelled','rolled_back')),
  plan_type text NOT NULL CHECK (plan_type IN ('revenue_growth','churn_recovery','pipeline_acceleration','outbound_campaign','meeting_generation','proposal_improvement','pricing_optimization','customer_expansion','retention','cost_reduction','market_expansion','process_improvement','custom')),
  priority integer NOT NULL DEFAULT 5 CHECK (priority >= 0 AND priority <= 10),
  estimated_roi numeric,
  estimated_duration_hours integer,
  estimated_cost numeric DEFAULT 0,
  estimated_revenue_impact numeric DEFAULT 0,
  required_approvals text[] DEFAULT '{}'::text[],
  required_agents text[] DEFAULT '{}'::text[],
  success_metrics jsonb DEFAULT '{}'::jsonb,
  plan_steps jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_plans ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_plans_workspace ON execution_plans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_plans_status ON execution_plans(plan_status);
CREATE INDEX IF NOT EXISTS idx_exec_plans_type ON execution_plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_exec_plans_priority ON execution_plans(priority DESC);
CREATE INDEX IF NOT EXISTS idx_exec_plans_cycle ON execution_plans(cycle_id);
CREATE INDEX IF NOT EXISTS idx_exec_plans_created ON execution_plans(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_plans" ON execution_plans;
CREATE POLICY "select_own_exec_plans" ON execution_plans FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_plans.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_plans" ON execution_plans;
CREATE POLICY "insert_own_exec_plans" ON execution_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_plans.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_plans" ON execution_plans;
CREATE POLICY "update_own_exec_plans" ON execution_plans FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_plans.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_plans.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_plans" ON execution_plans;
CREATE POLICY "delete_own_exec_plans" ON execution_plans FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_plans.workspace_id));

-- 3. execution_sessions
CREATE TABLE IF NOT EXISTS execution_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  plan_id uuid REFERENCES execution_plans(id) ON DELETE CASCADE,
  session_name text NOT NULL,
  session_status text NOT NULL DEFAULT 'pending' CHECK (session_status IN ('pending','running','completed','failed','cancelled','timeout','escalated')),
  agent_type text NOT NULL,
  agent_id text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  total_actions integer NOT NULL DEFAULT 0,
  successful_actions integer NOT NULL DEFAULT 0,
  failed_actions integer NOT NULL DEFAULT 0,
  session_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_sessions_workspace ON execution_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_sessions_status ON execution_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_exec_sessions_plan ON execution_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_exec_sessions_created ON execution_sessions(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_sessions" ON execution_sessions;
CREATE POLICY "select_own_exec_sessions" ON execution_sessions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_sessions.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_sessions" ON execution_sessions;
CREATE POLICY "insert_own_exec_sessions" ON execution_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_sessions.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_sessions" ON execution_sessions;
CREATE POLICY "update_own_exec_sessions" ON execution_sessions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_sessions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_sessions.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_sessions" ON execution_sessions;
CREATE POLICY "delete_own_exec_sessions" ON execution_sessions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_sessions.workspace_id));

-- 4. execution_actions
CREATE TABLE IF NOT EXISTS execution_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  session_id uuid REFERENCES execution_sessions(id) ON DELETE CASCADE,
  plan_id uuid,
  action_type text NOT NULL CHECK (action_type IN ('send_email','send_linkedin','call_prospect','book_meeting','create_proposal','update_crm','enrich_company','score_prospect','generate_content','adjust_pricing','trigger_workflow','notify_user','create_task','update_record','execute_api_call','escalate','log_event')),
  action_status text NOT NULL DEFAULT 'pending' CHECK (action_status IN ('pending','queued','executing','completed','failed','skipped','cancelled','retried')),
  action_payload jsonb DEFAULT '{}'::jsonb,
  target_entity_type text,
  target_entity_id text,
  target_module text,
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  error_message text,
  result_data jsonb,
  requires_approval boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_actions_workspace ON execution_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_actions_status ON execution_actions(action_status);
CREATE INDEX IF NOT EXISTS idx_exec_actions_type ON execution_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_exec_actions_session ON execution_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_exec_actions_created ON execution_actions(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_actions" ON execution_actions;
CREATE POLICY "select_own_exec_actions" ON execution_actions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_actions.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_actions" ON execution_actions;
CREATE POLICY "insert_own_exec_actions" ON execution_actions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_actions.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_actions" ON execution_actions;
CREATE POLICY "update_own_exec_actions" ON execution_actions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_actions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_actions.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_actions" ON execution_actions;
CREATE POLICY "delete_own_exec_actions" ON execution_actions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_actions.workspace_id));

-- 5. execution_results
CREATE TABLE IF NOT EXISTS execution_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  action_id uuid REFERENCES execution_actions(id) ON DELETE CASCADE,
  plan_id uuid,
  session_id uuid,
  result_status text NOT NULL DEFAULT 'pending' CHECK (result_status IN ('pending','success','partial','failure','no_change','pending_measurement')),
  metric_name text NOT NULL,
  metric_before numeric,
  metric_after numeric,
  metric_delta numeric,
  metric_unit text,
  measured_at timestamptz,
  measurement_window_hours integer DEFAULT 24,
  is_significant boolean DEFAULT false,
  confidence_score numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_results ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_results_workspace ON execution_results(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_results_status ON execution_results(result_status);
CREATE INDEX IF NOT EXISTS idx_exec_results_action ON execution_results(action_id);
CREATE INDEX IF NOT EXISTS idx_exec_results_created ON execution_results(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_results" ON execution_results;
CREATE POLICY "select_own_exec_results" ON execution_results FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_results.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_results" ON execution_results;
CREATE POLICY "insert_own_exec_results" ON execution_results FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_results.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_results" ON execution_results;
CREATE POLICY "update_own_exec_results" ON execution_results FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_results.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_results.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_results" ON execution_results;
CREATE POLICY "delete_own_exec_results" ON execution_results FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_results.workspace_id));

-- 6. execution_metrics
CREATE TABLE IF NOT EXISTS execution_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  cycle_id uuid,
  plan_id uuid,
  session_id uuid,
  metric_key text NOT NULL,
  metric_value numeric NOT NULL,
  metric_category text NOT NULL CHECK (metric_category IN ('revenue','pipeline','conversion','efficiency','cost','quality','speed','accuracy','engagement','retention','growth','roi')),
  metric_labels jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_metrics_workspace ON execution_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_metrics_key ON execution_metrics(metric_key);
CREATE INDEX IF NOT EXISTS idx_exec_metrics_category ON execution_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_exec_metrics_recorded ON execution_metrics(recorded_at DESC);

DROP POLICY IF EXISTS "select_own_exec_metrics" ON execution_metrics;
CREATE POLICY "select_own_exec_metrics" ON execution_metrics FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_metrics.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_metrics" ON execution_metrics;
CREATE POLICY "insert_own_exec_metrics" ON execution_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_metrics.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_metrics" ON execution_metrics;
CREATE POLICY "update_own_exec_metrics" ON execution_metrics FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_metrics.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_metrics.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_metrics" ON execution_metrics;
CREATE POLICY "delete_own_exec_metrics" ON execution_metrics FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_metrics.workspace_id));

-- 7. execution_failures
CREATE TABLE IF NOT EXISTS execution_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  action_id uuid REFERENCES execution_actions(id) ON DELETE CASCADE,
  session_id uuid,
  plan_id uuid,
  failure_type text NOT NULL CHECK (failure_type IN ('execution_error','timeout','rate_limit','authentication','validation','dependency','resource','api_error','business_rule','approval_denied','unknown')),
  failure_severity text NOT NULL DEFAULT 'medium' CHECK (failure_severity IN ('low','medium','high','critical')),
  error_message text NOT NULL,
  error_stack text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  is_retried boolean DEFAULT false,
  is_escalated boolean DEFAULT false,
  escalated_at timestamptz,
  escalated_to text,
  resolution text,
  resolved_at timestamptz,
  failure_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_failures ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_failures_workspace ON execution_failures(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_failures_type ON execution_failures(failure_type);
CREATE INDEX IF NOT EXISTS idx_exec_failures_severity ON execution_failures(failure_severity);
CREATE INDEX IF NOT EXISTS idx_exec_failures_action ON execution_failures(action_id);
CREATE INDEX IF NOT EXISTS idx_exec_failures_created ON execution_failures(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_failures" ON execution_failures;
CREATE POLICY "select_own_exec_failures" ON execution_failures FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_failures.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_failures" ON execution_failures;
CREATE POLICY "insert_own_exec_failures" ON execution_failures FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_failures.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_failures" ON execution_failures;
CREATE POLICY "update_own_exec_failures" ON execution_failures FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_failures.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_failures.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_failures" ON execution_failures;
CREATE POLICY "delete_own_exec_failures" ON execution_failures FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_failures.workspace_id));

-- 8. execution_learning
CREATE TABLE IF NOT EXISTS execution_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  cycle_id uuid,
  plan_id uuid,
  learning_type text NOT NULL CHECK (learning_type IN ('success_pattern','failure_pattern','optimization','benchmark','reasoning_improvement','prompt_improvement','workflow_improvement','tool_improvement','strategy_adjustment','audience_insight','timing_insight','messaging_insight')),
  learning_title text NOT NULL,
  learning_description text,
  before_state jsonb DEFAULT '{}'::jsonb,
  after_state jsonb DEFAULT '{}'::jsonb,
  estimated_gain numeric,
  actual_gain numeric,
  confidence_score numeric DEFAULT 0.5,
  is_applied boolean DEFAULT false,
  applied_at timestamptz,
  learning_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_learning ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_learning_workspace ON execution_learning(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_learning_type ON execution_learning(learning_type);
CREATE INDEX IF NOT EXISTS idx_exec_learning_applied ON execution_learning(is_applied);
CREATE INDEX IF NOT EXISTS idx_exec_learning_created ON execution_learning(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_learning" ON execution_learning;
CREATE POLICY "select_own_exec_learning" ON execution_learning FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_learning.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_learning" ON execution_learning;
CREATE POLICY "insert_own_exec_learning" ON execution_learning FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_learning.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_learning" ON execution_learning;
CREATE POLICY "update_own_exec_learning" ON execution_learning FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_learning.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_learning.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_learning" ON execution_learning;
CREATE POLICY "delete_own_exec_learning" ON execution_learning FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_learning.workspace_id));

-- 9. execution_recommendations
CREATE TABLE IF NOT EXISTS execution_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  cycle_id uuid,
  recommendation_type text NOT NULL CHECK (recommendation_type IN ('scaling','cost_savings','infrastructure','risk_mitigation','revenue_opportunity','process_improvement','pricing_adjustment','messaging_improvement','timing_adjustment','audience_adjustment','resource_allocation','strategic')),
  recommendation_title text NOT NULL,
  recommendation_description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical','strategic')),
  estimated_impact numeric,
  estimated_effort text DEFAULT 'medium' CHECK (estimated_effort IN ('low','medium','high','very_high')),
  estimated_roi numeric,
  confidence_score numeric DEFAULT 0.5,
  risk_level text DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  recommended_actions jsonb DEFAULT '[]'::jsonb,
  is_approved boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  is_dismissed boolean DEFAULT false,
  dismissed_at timestamptz,
  is_implemented boolean DEFAULT false,
  implemented_at timestamptz,
  actual_impact numeric,
  recommendation_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_recommendations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_recs_workspace ON execution_recommendations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_recs_type ON execution_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_exec_recs_priority ON execution_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_exec_recs_approved ON execution_recommendations(is_approved);
CREATE INDEX IF NOT EXISTS idx_exec_recs_created ON execution_recommendations(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_recs" ON execution_recommendations;
CREATE POLICY "select_own_exec_recs" ON execution_recommendations FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_recommendations.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_recs" ON execution_recommendations;
CREATE POLICY "insert_own_exec_recs" ON execution_recommendations FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_recommendations.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_recs" ON execution_recommendations;
CREATE POLICY "update_own_exec_recs" ON execution_recommendations FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_recommendations.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_recommendations.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_recs" ON execution_recommendations;
CREATE POLICY "delete_own_exec_recs" ON execution_recommendations FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_recommendations.workspace_id));

-- 10. execution_confidence
CREATE TABLE IF NOT EXISTS execution_confidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('plan','action','decision','recommendation','prediction','playbook','optimization','learning')),
  entity_id uuid NOT NULL,
  confidence_score numeric NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  confidence_factors jsonb DEFAULT '{}'::jsonb,
  risk_score numeric DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 1),
  expected_roi numeric,
  predicted_impact jsonb DEFAULT '{}'::jsonb,
  model_version text DEFAULT 'v1',
  computed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_confidence ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_confidence_workspace ON execution_confidence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_confidence_entity ON execution_confidence(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_exec_confidence_score ON execution_confidence(confidence_score DESC);

DROP POLICY IF EXISTS "select_own_exec_confidence" ON execution_confidence;
CREATE POLICY "select_own_exec_confidence" ON execution_confidence FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_confidence.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_confidence" ON execution_confidence;
CREATE POLICY "insert_own_exec_confidence" ON execution_confidence FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_confidence.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_confidence" ON execution_confidence;
CREATE POLICY "update_own_exec_confidence" ON execution_confidence FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_confidence.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_confidence.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_confidence" ON execution_confidence;
CREATE POLICY "delete_own_exec_confidence" ON execution_confidence FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_confidence.workspace_id));

-- 11. execution_approvals
CREATE TABLE IF NOT EXISTS execution_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  plan_id uuid,
  action_id uuid,
  approval_type text NOT NULL CHECK (approval_type IN ('plan','action','recommendation','playbook','deployment','cost_change','pricing_change','external_communication','data_access','configuration')),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','denied','expired','auto_approved','escalated')),
  approval_reason text,
  requested_by text NOT NULL DEFAULT 'ai_ceo',
  requested_at timestamptz DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  auto_approval_rules jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  approval_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_approvals ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_approvals_workspace ON execution_approvals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_approvals_status ON execution_approvals(approval_status);
CREATE INDEX IF NOT EXISTS idx_exec_approvals_type ON execution_approvals(approval_type);
CREATE INDEX IF NOT EXISTS idx_exec_approvals_plan ON execution_approvals(plan_id);
CREATE INDEX IF NOT EXISTS idx_exec_approvals_created ON execution_approvals(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_approvals" ON execution_approvals;
CREATE POLICY "select_own_exec_approvals" ON execution_approvals FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_approvals.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_approvals" ON execution_approvals;
CREATE POLICY "insert_own_exec_approvals" ON execution_approvals FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_approvals.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_approvals" ON execution_approvals;
CREATE POLICY "update_own_exec_approvals" ON execution_approvals FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_approvals.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_approvals.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_approvals" ON execution_approvals;
CREATE POLICY "delete_own_exec_approvals" ON execution_approvals FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_approvals.workspace_id));

-- 12. autopilot_execution_history
CREATE TABLE IF NOT EXISTS autopilot_execution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  cycle_id uuid,
  plan_id uuid,
  session_id uuid,
  action_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('cycle_started','cycle_completed','plan_created','plan_approved','plan_executed','plan_completed','session_started','session_completed','action_queued','action_started','action_completed','action_failed','action_retried','approval_requested','approval_granted','approval_denied','recommendation_generated','recommendation_approved','recommendation_implemented','learning_recorded','optimization_applied','escalation_triggered','rollback_triggered')),
  event_description text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  entity_type text,
  entity_id text,
  user_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE autopilot_execution_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_autopilot_history_workspace ON autopilot_execution_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_history_type ON autopilot_execution_history(event_type);
CREATE INDEX IF NOT EXISTS idx_autopilot_history_cycle ON autopilot_execution_history(cycle_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_history_plan ON autopilot_execution_history(plan_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_history_created ON autopilot_execution_history(created_at DESC);

DROP POLICY IF EXISTS "select_own_autopilot_history" ON autopilot_execution_history;
CREATE POLICY "select_own_autopilot_history" ON autopilot_execution_history FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_execution_history.workspace_id));
DROP POLICY IF EXISTS "insert_own_autopilot_history" ON autopilot_execution_history;
CREATE POLICY "insert_own_autopilot_history" ON autopilot_execution_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_execution_history.workspace_id));
DROP POLICY IF EXISTS "update_own_autopilot_history" ON autopilot_execution_history;
CREATE POLICY "update_own_autopilot_history" ON autopilot_execution_history FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_execution_history.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_execution_history.workspace_id));
DROP POLICY IF EXISTS "delete_own_autopilot_history" ON autopilot_execution_history;
CREATE POLICY "delete_own_autopilot_history" ON autopilot_execution_history FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_execution_history.workspace_id));