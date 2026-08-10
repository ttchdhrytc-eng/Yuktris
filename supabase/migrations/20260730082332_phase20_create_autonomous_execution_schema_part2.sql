/*
# Phase 20 — Autonomous Revenue Execution Engine (Part 2/3)

## Business Events, Decision Engine, Optimization & Learning Tables

### New Tables (16)
1. business_events — Important business events that trigger AI
2. business_event_rules — Rules defining which events trigger which actions
3. business_event_actions — Actions to execute when events fire
4. business_event_history — History of event firings
5. business_event_queue — Pending events awaiting processing
6. decision_engine — AI decision records with reasoning
7. decision_models — Decision model definitions and versions
8. decision_evidence — Evidence supporting each decision
9. decision_outcomes — Actual outcomes of decisions
10. decision_accuracy — Accuracy tracking for decision models
11. decision_versions — Version history of decision models
12. optimization_opportunities — Identified optimization opportunities
13. optimization_history — History of applied optimizations
14. learning_snapshots — Learning state snapshots
15. learning_history — Historical learning progression
16. recommendation_improvements — AI recommendation improvements over time

### Security
- RLS enabled on every table, 4 CRUD policies each via workspace_members join
*/

-- 1. business_events
CREATE TABLE IF NOT EXISTS business_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('lead_created','lead_replied','meeting_booked','proposal_viewed','proposal_accepted','invoice_overdue','customer_unhealthy','subscription_canceled','high_intent_detected','competitor_mentioned','website_visitor_identified','mrr_decreased','pipeline_stalled','customer_renewed','integration_connected','campaign_underperforming','revenue_forecast_changed','ai_ceo_recommendation','feature_flag_enabled','security_incident','deployment_completed','prospect_qualified','deal_won','deal_lost','payment_failed','payment_received','churn_risk_detected','upsell_opportunity','expansion_opportunity','renewal_due','custom')),
  event_source text NOT NULL,
  event_severity text NOT NULL DEFAULT 'info' CHECK (event_severity IN ('info','low','medium','high','critical')),
  entity_type text,
  entity_id text,
  event_data jsonb DEFAULT '{}'::jsonb,
  is_processed boolean DEFAULT false,
  processed_at timestamptz,
  triggered_actions integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_events_workspace ON business_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_events_type ON business_events(event_type);
CREATE INDEX IF NOT EXISTS idx_business_events_severity ON business_events(event_severity);
CREATE INDEX IF NOT EXISTS idx_business_events_processed ON business_events(is_processed);
CREATE INDEX IF NOT EXISTS idx_business_events_created ON business_events(created_at DESC);

DROP POLICY IF EXISTS "select_own_business_events" ON business_events;
CREATE POLICY "select_own_business_events" ON business_events FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_events.workspace_id));
DROP POLICY IF EXISTS "insert_own_business_events" ON business_events;
CREATE POLICY "insert_own_business_events" ON business_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_events.workspace_id));
DROP POLICY IF EXISTS "update_own_business_events" ON business_events;
CREATE POLICY "update_own_business_events" ON business_events FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_events.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_events.workspace_id));
DROP POLICY IF EXISTS "delete_own_business_events" ON business_events;
CREATE POLICY "delete_own_business_events" ON business_events FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_events.workspace_id));

-- 2. business_event_rules
CREATE TABLE IF NOT EXISTS business_event_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  rule_name text NOT NULL,
  rule_description text,
  trigger_event_type text NOT NULL,
  trigger_conditions jsonb DEFAULT '{}'::jsonb,
  action_type text NOT NULL CHECK (action_type IN ('create_plan','create_action','send_notification','trigger_workflow','escalate','create_recommendation','log_event','adjust_strategy','enrich_data','score_entity')),
  action_config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  priority integer NOT NULL DEFAULT 5,
  cooldown_minutes integer DEFAULT 60,
  last_triggered_at timestamptz,
  trigger_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_event_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_event_rules_workspace ON business_event_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_event_rules_trigger ON business_event_rules(trigger_event_type);
CREATE INDEX IF NOT EXISTS idx_business_event_rules_active ON business_event_rules(is_active);

DROP POLICY IF EXISTS "select_own_business_event_rules" ON business_event_rules;
CREATE POLICY "select_own_business_event_rules" ON business_event_rules FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_rules.workspace_id));
DROP POLICY IF EXISTS "insert_own_business_event_rules" ON business_event_rules;
CREATE POLICY "insert_own_business_event_rules" ON business_event_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_rules.workspace_id));
DROP POLICY IF EXISTS "update_own_business_event_rules" ON business_event_rules;
CREATE POLICY "update_own_business_event_rules" ON business_event_rules FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_rules.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_rules.workspace_id));
DROP POLICY IF EXISTS "delete_own_business_event_rules" ON business_event_rules;
CREATE POLICY "delete_own_business_event_rules" ON business_event_rules FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_rules.workspace_id));

-- 3. business_event_actions
CREATE TABLE IF NOT EXISTS business_event_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  event_id uuid REFERENCES business_events(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES business_event_rules(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_status text NOT NULL DEFAULT 'pending' CHECK (action_status IN ('pending','executing','completed','failed','skipped')),
  action_payload jsonb DEFAULT '{}'::jsonb,
  result_data jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_event_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_event_actions_workspace ON business_event_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_event_actions_event ON business_event_actions(event_id);
CREATE INDEX IF NOT EXISTS idx_business_event_actions_status ON business_event_actions(action_status);

DROP POLICY IF EXISTS "select_own_business_event_actions" ON business_event_actions;
CREATE POLICY "select_own_business_event_actions" ON business_event_actions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_actions.workspace_id));
DROP POLICY IF EXISTS "insert_own_business_event_actions" ON business_event_actions;
CREATE POLICY "insert_own_business_event_actions" ON business_event_actions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_actions.workspace_id));
DROP POLICY IF EXISTS "update_own_business_event_actions" ON business_event_actions;
CREATE POLICY "update_own_business_event_actions" ON business_event_actions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_actions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_actions.workspace_id));
DROP POLICY IF EXISTS "delete_own_business_event_actions" ON business_event_actions;
CREATE POLICY "delete_own_business_event_actions" ON business_event_actions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_actions.workspace_id));

-- 4. business_event_history
CREATE TABLE IF NOT EXISTS business_event_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  event_id uuid,
  rule_id uuid,
  action_id uuid,
  history_event text NOT NULL,
  history_description text,
  history_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_event_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_event_history_workspace ON business_event_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_event_history_event ON business_event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_business_event_history_created ON business_event_history(created_at DESC);

DROP POLICY IF EXISTS "select_own_business_event_history" ON business_event_history;
CREATE POLICY "select_own_business_event_history" ON business_event_history FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_history.workspace_id));
DROP POLICY IF EXISTS "insert_own_business_event_history" ON business_event_history;
CREATE POLICY "insert_own_business_event_history" ON business_event_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_history.workspace_id));
DROP POLICY IF EXISTS "update_own_business_event_history" ON business_event_history;
CREATE POLICY "update_own_business_event_history" ON business_event_history FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_history.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_history.workspace_id));
DROP POLICY IF EXISTS "delete_own_business_event_history" ON business_event_history;
CREATE POLICY "delete_own_business_event_history" ON business_event_history FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_history.workspace_id));

-- 5. business_event_queue
CREATE TABLE IF NOT EXISTS business_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  event_id uuid REFERENCES business_events(id) ON DELETE CASCADE,
  queue_status text NOT NULL DEFAULT 'pending' CHECK (queue_status IN ('pending','processing','completed','failed','dead_letter')),
  priority integer NOT NULL DEFAULT 5,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_event_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_event_queue_workspace ON business_event_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_event_queue_status ON business_event_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_business_event_queue_scheduled ON business_event_queue(scheduled_at);

DROP POLICY IF EXISTS "select_own_business_event_queue" ON business_event_queue;
CREATE POLICY "select_own_business_event_queue" ON business_event_queue FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_queue.workspace_id));
DROP POLICY IF EXISTS "insert_own_business_event_queue" ON business_event_queue;
CREATE POLICY "insert_own_business_event_queue" ON business_event_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_queue.workspace_id));
DROP POLICY IF EXISTS "update_own_business_event_queue" ON business_event_queue;
CREATE POLICY "update_own_business_event_queue" ON business_event_queue FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_queue.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_queue.workspace_id));
DROP POLICY IF EXISTS "delete_own_business_event_queue" ON business_event_queue;
CREATE POLICY "delete_own_business_event_queue" ON business_event_queue FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = business_event_queue.workspace_id));

-- 6. decision_engine
CREATE TABLE IF NOT EXISTS decision_engine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('execute','skip','escalate','optimize','prioritize','approve','deny','adjust','create','modify','cancel','recommend','predict','allocate')),
  decision_title text NOT NULL,
  decision_description text,
  decision_reason text NOT NULL,
  decision_status text NOT NULL DEFAULT 'pending' CHECK (decision_status IN ('pending','approved','executing','completed','failed','rolled_back','cancelled')),
  entity_type text,
  entity_id text,
  confidence_score numeric NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  risk_score numeric NOT NULL DEFAULT 0.5 CHECK (risk_score >= 0 AND risk_score <= 1),
  expected_roi numeric,
  predicted_impact jsonb DEFAULT '{}'::jsonb,
  actual_impact jsonb DEFAULT '{}'::jsonb,
  model_version text DEFAULT 'v1',
  decision_factors jsonb DEFAULT '{}'::jsonb,
  alternatives jsonb DEFAULT '[]'::jsonb,
  requires_approval boolean DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  measured_at timestamptz,
  created_by text DEFAULT 'ai_ceo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE decision_engine ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_decision_engine_workspace ON decision_engine(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decision_engine_type ON decision_engine(decision_type);
CREATE INDEX IF NOT EXISTS idx_decision_engine_status ON decision_engine(decision_status);
CREATE INDEX IF NOT EXISTS idx_decision_engine_confidence ON decision_engine(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_decision_engine_created ON decision_engine(created_at DESC);

DROP POLICY IF EXISTS "select_own_decision_engine" ON decision_engine;
CREATE POLICY "select_own_decision_engine" ON decision_engine FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_engine.workspace_id));
DROP POLICY IF EXISTS "insert_own_decision_engine" ON decision_engine;
CREATE POLICY "insert_own_decision_engine" ON decision_engine FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_engine.workspace_id));
DROP POLICY IF EXISTS "update_own_decision_engine" ON decision_engine;
CREATE POLICY "update_own_decision_engine" ON decision_engine FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_engine.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_engine.workspace_id));
DROP POLICY IF EXISTS "delete_own_decision_engine" ON decision_engine;
CREATE POLICY "delete_own_decision_engine" ON decision_engine FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_engine.workspace_id));

-- 7. decision_models
CREATE TABLE IF NOT EXISTS decision_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  model_name text NOT NULL,
  model_type text NOT NULL CHECK (model_type IN ('scoring','classification','prediction','optimization','recommendation','prioritization','risk_assessment')),
  model_description text,
  model_config jsonb DEFAULT '{}'::jsonb,
  model_weights jsonb DEFAULT '{}'::jsonb,
  model_features text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  model_version text NOT NULL DEFAULT 'v1',
  accuracy_score numeric,
  precision_score numeric,
  recall_score numeric,
  f1_score numeric,
  training_data_count integer DEFAULT 0,
  last_trained_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE decision_models ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_decision_models_workspace ON decision_models(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decision_models_type ON decision_models(model_type);
CREATE INDEX IF NOT EXISTS idx_decision_models_active ON decision_models(is_active);

DROP POLICY IF EXISTS "select_own_decision_models" ON decision_models;
CREATE POLICY "select_own_decision_models" ON decision_models FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_models.workspace_id));
DROP POLICY IF EXISTS "insert_own_decision_models" ON decision_models;
CREATE POLICY "insert_own_decision_models" ON decision_models FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_models.workspace_id));
DROP POLICY IF EXISTS "update_own_decision_models" ON decision_models;
CREATE POLICY "update_own_decision_models" ON decision_models FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_models.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_models.workspace_id));
DROP POLICY IF EXISTS "delete_own_decision_models" ON decision_models;
CREATE POLICY "delete_own_decision_models" ON decision_models FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_models.workspace_id));

-- 8. decision_evidence
CREATE TABLE IF NOT EXISTS decision_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  decision_id uuid REFERENCES decision_engine(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('data_point','historical_pattern','benchmark','market_signal','customer_signal','financial_metric','performance_metric','ai_reasoning','external_data','user_feedback')),
  evidence_source text NOT NULL,
  evidence_description text NOT NULL,
  evidence_weight numeric NOT NULL DEFAULT 0.5 CHECK (evidence_weight >= 0 AND evidence_weight <= 1),
  evidence_data jsonb DEFAULT '{}'::jsonb,
  supports_decision boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE decision_evidence ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_decision_evidence_workspace ON decision_evidence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decision_evidence_decision ON decision_evidence(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_evidence_type ON decision_evidence(evidence_type);

DROP POLICY IF EXISTS "select_own_decision_evidence" ON decision_evidence;
CREATE POLICY "select_own_decision_evidence" ON decision_evidence FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_evidence.workspace_id));
DROP POLICY IF EXISTS "insert_own_decision_evidence" ON decision_evidence;
CREATE POLICY "insert_own_decision_evidence" ON decision_evidence FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_evidence.workspace_id));
DROP POLICY IF EXISTS "update_own_decision_evidence" ON decision_evidence;
CREATE POLICY "update_own_decision_evidence" ON decision_evidence FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_evidence.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_evidence.workspace_id));
DROP POLICY IF EXISTS "delete_own_decision_evidence" ON decision_evidence;
CREATE POLICY "delete_own_decision_evidence" ON decision_evidence FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_evidence.workspace_id));

-- 9. decision_outcomes
CREATE TABLE IF NOT EXISTS decision_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  decision_id uuid REFERENCES decision_engine(id) ON DELETE CASCADE,
  outcome_status text NOT NULL DEFAULT 'pending' CHECK (outcome_status IN ('pending','positive','neutral','negative','mixed','inconclusive')),
  predicted_value numeric,
  actual_value numeric,
  variance numeric,
  accuracy_score numeric,
  measurement_period_hours integer DEFAULT 24,
  measured_at timestamptz,
  outcome_notes text,
  outcome_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_workspace ON decision_outcomes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_decision ON decision_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_status ON decision_outcomes(outcome_status);

DROP POLICY IF EXISTS "select_own_decision_outcomes" ON decision_outcomes;
CREATE POLICY "select_own_decision_outcomes" ON decision_outcomes FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_outcomes.workspace_id));
DROP POLICY IF EXISTS "insert_own_decision_outcomes" ON decision_outcomes;
CREATE POLICY "insert_own_decision_outcomes" ON decision_outcomes FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_outcomes.workspace_id));
DROP POLICY IF EXISTS "update_own_decision_outcomes" ON decision_outcomes;
CREATE POLICY "update_own_decision_outcomes" ON decision_outcomes FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_outcomes.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_outcomes.workspace_id));
DROP POLICY IF EXISTS "delete_own_decision_outcomes" ON decision_outcomes;
CREATE POLICY "delete_own_decision_outcomes" ON decision_outcomes FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_outcomes.workspace_id));

-- 10. decision_accuracy
CREATE TABLE IF NOT EXISTS decision_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  model_version text NOT NULL,
  decision_type text,
  total_decisions integer NOT NULL DEFAULT 0,
  correct_predictions integer NOT NULL DEFAULT 0,
  incorrect_predictions integer NOT NULL DEFAULT 0,
  accuracy_percentage numeric,
  precision_score numeric,
  recall_score numeric,
  f1_score numeric,
  improvement_trend numeric DEFAULT 0,
  measurement_period_start timestamptz,
  measurement_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE decision_accuracy ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_decision_accuracy_workspace ON decision_accuracy(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decision_accuracy_model ON decision_accuracy(model_version);

DROP POLICY IF EXISTS "select_own_decision_accuracy" ON decision_accuracy;
CREATE POLICY "select_own_decision_accuracy" ON decision_accuracy FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_accuracy.workspace_id));
DROP POLICY IF EXISTS "insert_own_decision_accuracy" ON decision_accuracy;
CREATE POLICY "insert_own_decision_accuracy" ON decision_accuracy FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_accuracy.workspace_id));
DROP POLICY IF EXISTS "update_own_decision_accuracy" ON decision_accuracy;
CREATE POLICY "update_own_decision_accuracy" ON decision_accuracy FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_accuracy.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_accuracy.workspace_id));
DROP POLICY IF EXISTS "delete_own_decision_accuracy" ON decision_accuracy;
CREATE POLICY "delete_own_decision_accuracy" ON decision_accuracy FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_accuracy.workspace_id));

-- 11. decision_versions
CREATE TABLE IF NOT EXISTS decision_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  model_id uuid REFERENCES decision_models(id) ON DELETE CASCADE,
  version_number text NOT NULL,
  version_description text,
  changelog jsonb DEFAULT '[]'::jsonb,
  model_config jsonb DEFAULT '{}'::jsonb,
  model_weights jsonb DEFAULT '{}'::jsonb,
  accuracy_score numeric,
  is_production boolean DEFAULT false,
  promoted_at timestamptz,
  created_by text DEFAULT 'ai_ceo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE decision_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_decision_versions_workspace ON decision_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decision_versions_model ON decision_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_decision_versions_production ON decision_versions(is_production);

DROP POLICY IF EXISTS "select_own_decision_versions" ON decision_versions;
CREATE POLICY "select_own_decision_versions" ON decision_versions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_versions.workspace_id));
DROP POLICY IF EXISTS "insert_own_decision_versions" ON decision_versions;
CREATE POLICY "insert_own_decision_versions" ON decision_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_versions.workspace_id));
DROP POLICY IF EXISTS "update_own_decision_versions" ON decision_versions;
CREATE POLICY "update_own_decision_versions" ON decision_versions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_versions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_versions.workspace_id));
DROP POLICY IF EXISTS "delete_own_decision_versions" ON decision_versions;
CREATE POLICY "delete_own_decision_versions" ON decision_versions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = decision_versions.workspace_id));

-- 12. optimization_opportunities
CREATE TABLE IF NOT EXISTS optimization_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  optimization_area text NOT NULL CHECK (optimization_area IN ('sales','marketing','messaging','pricing','follow_up_timing','proposal_quality','meeting_quality','forecast_accuracy','customer_health','collections','retention','expansion','ltv','cac','pipeline','revenue','profitability','process','cost','resource_allocation')),
  opportunity_title text NOT NULL,
  opportunity_description text,
  before_state jsonb DEFAULT '{}'::jsonb,
  after_state jsonb DEFAULT '{}'::jsonb,
  estimated_gain numeric,
  actual_gain numeric,
  confidence_score numeric DEFAULT 0.5,
  implementation_effort text DEFAULT 'medium' CHECK (implementation_effort IN ('low','medium','high','very_high')),
  is_implemented boolean DEFAULT false,
  implemented_at timestamptz,
  is_active boolean DEFAULT true,
  optimization_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE optimization_opportunities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_opt_opportunities_workspace ON optimization_opportunities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_opt_opportunities_area ON optimization_opportunities(optimization_area);
CREATE INDEX IF NOT EXISTS idx_opt_opportunities_implemented ON optimization_opportunities(is_implemented);
CREATE INDEX IF NOT EXISTS idx_opt_opportunities_created ON optimization_opportunities(created_at DESC);

DROP POLICY IF EXISTS "select_own_opt_opportunities" ON optimization_opportunities;
CREATE POLICY "select_own_opt_opportunities" ON optimization_opportunities FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_opportunities.workspace_id));
DROP POLICY IF EXISTS "insert_own_opt_opportunities" ON optimization_opportunities;
CREATE POLICY "insert_own_opt_opportunities" ON optimization_opportunities FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_opportunities.workspace_id));
DROP POLICY IF EXISTS "update_own_opt_opportunities" ON optimization_opportunities;
CREATE POLICY "update_own_opt_opportunities" ON optimization_opportunities FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_opportunities.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_opportunities.workspace_id));
DROP POLICY IF EXISTS "delete_own_opt_opportunities" ON optimization_opportunities;
CREATE POLICY "delete_own_opt_opportunities" ON optimization_opportunities FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_opportunities.workspace_id));

-- 13. optimization_history
CREATE TABLE IF NOT EXISTS optimization_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  opportunity_id uuid REFERENCES optimization_opportunities(id) ON DELETE CASCADE,
  optimization_status text NOT NULL DEFAULT 'pending' CHECK (optimization_status IN ('pending','in_progress','completed','failed','rolled_back','measuring')),
  before_value numeric,
  after_value numeric,
  measured_gain numeric,
  estimated_gain numeric,
  measurement_window_hours integer DEFAULT 168,
  is_significant boolean DEFAULT false,
  applied_at timestamptz,
  measured_at timestamptz,
  notes text,
  optimization_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE optimization_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_opt_history_workspace ON optimization_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_opt_history_opportunity ON optimization_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opt_history_status ON optimization_history(optimization_status);

DROP POLICY IF EXISTS "select_own_opt_history" ON optimization_history;
CREATE POLICY "select_own_opt_history" ON optimization_history FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_history.workspace_id));
DROP POLICY IF EXISTS "insert_own_opt_history" ON optimization_history;
CREATE POLICY "insert_own_opt_history" ON optimization_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_history.workspace_id));
DROP POLICY IF EXISTS "update_own_opt_history" ON optimization_history;
CREATE POLICY "update_own_opt_history" ON optimization_history FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_history.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_history.workspace_id));
DROP POLICY IF EXISTS "delete_own_opt_history" ON optimization_history;
CREATE POLICY "delete_own_opt_history" ON optimization_history FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = optimization_history.workspace_id));

-- 14. learning_snapshots
CREATE TABLE IF NOT EXISTS learning_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('success_patterns','failure_patterns','best_practices','industry_benchmarks','reasoning_improvements','prompt_improvements','workflow_improvements','tool_improvements','strategy_adjustments','comprehensive')),
  snapshot_name text NOT NULL,
  total_actions_analyzed integer NOT NULL DEFAULT 0,
  successful_patterns integer NOT NULL DEFAULT 0,
  failed_patterns integer NOT NULL DEFAULT 0,
  improvement_suggestions integer NOT NULL DEFAULT 0,
  benchmarks_compared integer NOT NULL DEFAULT 0,
  confidence_trend numeric DEFAULT 0,
  accuracy_trend numeric DEFAULT 0,
  snapshot_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE learning_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_learning_snapshots_workspace ON learning_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_learning_snapshots_type ON learning_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_learning_snapshots_created ON learning_snapshots(created_at DESC);

DROP POLICY IF EXISTS "select_own_learning_snapshots" ON learning_snapshots;
CREATE POLICY "select_own_learning_snapshots" ON learning_snapshots FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_snapshots.workspace_id));
DROP POLICY IF EXISTS "insert_own_learning_snapshots" ON learning_snapshots;
CREATE POLICY "insert_own_learning_snapshots" ON learning_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_snapshots.workspace_id));
DROP POLICY IF EXISTS "update_own_learning_snapshots" ON learning_snapshots;
CREATE POLICY "update_own_learning_snapshots" ON learning_snapshots FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_snapshots.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_snapshots.workspace_id));
DROP POLICY IF EXISTS "delete_own_learning_snapshots" ON learning_snapshots;
CREATE POLICY "delete_own_learning_snapshots" ON learning_snapshots FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_snapshots.workspace_id));

-- 15. learning_history
CREATE TABLE IF NOT EXISTS learning_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  snapshot_id uuid REFERENCES learning_snapshots(id) ON DELETE CASCADE,
  learning_category text NOT NULL CHECK (learning_category IN ('successful_actions','failed_actions','patterns','best_practices','benchmarks','reasoning','prompts','workflows','tools','strategy','audience','timing','messaging')),
  learning_description text NOT NULL,
  before_metric numeric,
  after_metric numeric,
  improvement_delta numeric,
  is_applied boolean DEFAULT false,
  applied_at timestamptz,
  learning_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE learning_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_learning_history_workspace ON learning_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_learning_history_snapshot ON learning_history(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_learning_history_category ON learning_history(learning_category);

DROP POLICY IF EXISTS "select_own_learning_history" ON learning_history;
CREATE POLICY "select_own_learning_history" ON learning_history FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_history.workspace_id));
DROP POLICY IF EXISTS "insert_own_learning_history" ON learning_history;
CREATE POLICY "insert_own_learning_history" ON learning_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_history.workspace_id));
DROP POLICY IF EXISTS "update_own_learning_history" ON learning_history;
CREATE POLICY "update_own_learning_history" ON learning_history FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_history.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_history.workspace_id));
DROP POLICY IF EXISTS "delete_own_learning_history" ON learning_history;
CREATE POLICY "delete_own_learning_history" ON learning_history FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = learning_history.workspace_id));

-- 16. recommendation_improvements
CREATE TABLE IF NOT EXISTS recommendation_improvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  improvement_type text NOT NULL CHECK (improvement_type IN ('reasoning','prompt','workflow','tool','strategy','scoring','prioritization','timing','messaging','audience','pricing','forecasting')),
  improvement_title text NOT NULL,
  improvement_description text,
  before_approach text,
  after_approach text,
  estimated_accuracy_gain numeric,
  actual_accuracy_gain numeric,
  estimated_efficiency_gain numeric,
  actual_efficiency_gain numeric,
  is_implemented boolean DEFAULT false,
  implemented_at timestamptz,
  improvement_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE recommendation_improvements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rec_improvements_workspace ON recommendation_improvements(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rec_improvements_type ON recommendation_improvements(improvement_type);
CREATE INDEX IF NOT EXISTS idx_rec_improvements_implemented ON recommendation_improvements(is_implemented);

DROP POLICY IF EXISTS "select_own_rec_improvements" ON recommendation_improvements;
CREATE POLICY "select_own_rec_improvements" ON recommendation_improvements FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = recommendation_improvements.workspace_id));
DROP POLICY IF EXISTS "insert_own_rec_improvements" ON recommendation_improvements;
CREATE POLICY "insert_own_rec_improvements" ON recommendation_improvements FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = recommendation_improvements.workspace_id));
DROP POLICY IF EXISTS "update_own_rec_improvements" ON recommendation_improvements;
CREATE POLICY "update_own_rec_improvements" ON recommendation_improvements FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = recommendation_improvements.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = recommendation_improvements.workspace_id));
DROP POLICY IF EXISTS "delete_own_rec_improvements" ON recommendation_improvements;
CREATE POLICY "delete_own_rec_improvements" ON recommendation_improvements FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = recommendation_improvements.workspace_id));