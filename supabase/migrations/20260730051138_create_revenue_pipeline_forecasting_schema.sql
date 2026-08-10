/*
# Phase 12 — Revenue Pipeline, Forecasting & AI Sales Command Center
# 40+ tables: pipeline, forecasting, revenue tracking, performance, executive intelligence.
*/

-- ============================================================
-- PIPELINE STAGES
-- ============================================================
CREATE TABLE pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  stage_order integer NOT NULL DEFAULT 0,
  default_probability integer DEFAULT 20,
  is_won_stage boolean DEFAULT false,
  is_lost_stage boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_pipeline_stages_ws_order ON pipeline_stages(workspace_id, stage_order);
CREATE INDEX idx_pipeline_stages_workspace ON pipeline_stages(workspace_id);
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pipeline_stages" ON pipeline_stages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_stages.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pipeline_stages" ON pipeline_stages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_stages.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pipeline_stages" ON pipeline_stages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_stages.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_stages.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pipeline_stages" ON pipeline_stages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_stages.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PIPELINE DEALS
-- ============================================================
CREATE TABLE pipeline_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  meeting_id uuid REFERENCES meeting_scheduler(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  proposal_project_id uuid REFERENCES proposal_projects(id) ON DELETE SET NULL,
  deal_name text NOT NULL,
  company_name text,
  contact_name text,
  current_stage text NOT NULL DEFAULT 'qualification',
  previous_stage text,
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  deal_value numeric(14,2) NOT NULL DEFAULT 0,
  weighted_value numeric(14,2) DEFAULT 0,
  probability_to_close integer DEFAULT 20,
  expected_close_date date,
  actual_close_date date,
  ai_confidence numeric DEFAULT 0.5,
  ai_reasoning text,
  risk_score integer DEFAULT 0,
  health_score integer DEFAULT 50,
  last_activity_at timestamptz,
  days_in_stage integer DEFAULT 0,
  next_recommended_action text,
  deal_type text DEFAULT 'new_business' CHECK (deal_type IN ('new_business','renewal','upsell','cross_sell','expansion')),
  source_channel text,
  campaign_id text,
  industry text,
  geography text,
  is_closed boolean DEFAULT false,
  closed_status text CHECK (closed_status IN ('won','lost','pending')),
  close_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_deals_workspace ON pipeline_deals(workspace_id);
CREATE INDEX idx_pipeline_deals_stage ON pipeline_deals(current_stage);
CREATE INDEX idx_pipeline_deals_company ON pipeline_deals(company_id);
CREATE INDEX idx_pipeline_deals_closed ON pipeline_deals(is_closed);
CREATE INDEX idx_pipeline_deals_expected_close ON pipeline_deals(expected_close_date);
CREATE INDEX idx_pipeline_deals_proposal ON pipeline_deals(proposal_project_id);
ALTER TABLE pipeline_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pipeline_deals" ON pipeline_deals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_deals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pipeline_deals" ON pipeline_deals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_deals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pipeline_deals" ON pipeline_deals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_deals.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_deals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pipeline_deals" ON pipeline_deals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_deals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PIPELINE MOVEMENTS
-- ============================================================
CREATE TABLE pipeline_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES pipeline_deals(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  probability_before integer,
  probability_after integer,
  value_before numeric(14,2),
  value_after numeric(14,2),
  reason text,
  moved_by text DEFAULT 'ai' CHECK (moved_by IN ('ai','human','system')),
  days_in_previous_stage integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_movements_workspace ON pipeline_movements(workspace_id);
CREATE INDEX idx_pipeline_movements_deal ON pipeline_movements(deal_id);
CREATE INDEX idx_pipeline_movements_created ON pipeline_movements(created_at DESC);
ALTER TABLE pipeline_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pipeline_movements" ON pipeline_movements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_movements.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pipeline_movements" ON pipeline_movements FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_movements.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pipeline_movements" ON pipeline_movements FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_movements.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_movements.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pipeline_movements" ON pipeline_movements FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_movements.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PIPELINE SNAPSHOTS
-- ============================================================
CREATE TABLE pipeline_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_deals integer DEFAULT 0,
  total_pipeline_value numeric(14,2) DEFAULT 0,
  weighted_pipeline_value numeric(14,2) DEFAULT 0,
  deals_by_stage jsonb DEFAULT '{}'::jsonb,
  deals_by_type jsonb DEFAULT '{}'::jsonb,
  deals_by_channel jsonb DEFAULT '{}'::jsonb,
  deals_by_industry jsonb DEFAULT '{}'::jsonb,
  avg_deal_size numeric(14,2) DEFAULT 0,
  avg_probability integer DEFAULT 0,
  snapshot_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_snapshots_workspace ON pipeline_snapshots(workspace_id);
CREATE INDEX idx_pipeline_snapshots_date ON pipeline_snapshots(snapshot_date DESC);
CREATE UNIQUE INDEX idx_pipeline_snapshots_ws_date ON pipeline_snapshots(workspace_id, snapshot_date);
ALTER TABLE pipeline_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pipeline_snapshots" ON pipeline_snapshots FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_snapshots.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pipeline_snapshots" ON pipeline_snapshots FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_snapshots.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pipeline_snapshots" ON pipeline_snapshots FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_snapshots.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_snapshots.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pipeline_snapshots" ON pipeline_snapshots FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_snapshots.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PIPELINE VELOCITY
-- ============================================================
CREATE TABLE pipeline_velocity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  stage_name text NOT NULL,
  avg_days_in_stage numeric(8,2) DEFAULT 0,
  deal_count integer DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  avg_value_entering numeric(14,2) DEFAULT 0,
  avg_value_exiting numeric(14,2) DEFAULT 0,
  velocity_score numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_velocity_workspace ON pipeline_velocity(workspace_id);
CREATE INDEX idx_pipeline_velocity_period ON pipeline_velocity(period_start, period_end);
ALTER TABLE pipeline_velocity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pipeline_velocity" ON pipeline_velocity FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_velocity.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pipeline_velocity" ON pipeline_velocity FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_velocity.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pipeline_velocity" ON pipeline_velocity FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_velocity.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_velocity.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pipeline_velocity" ON pipeline_velocity FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_velocity.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PIPELINE HEALTH
-- ============================================================
CREATE TABLE pipeline_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  health_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_health_score integer DEFAULT 50,
  pipeline_coverage numeric(14,2) DEFAULT 0,
  coverage_ratio numeric(5,2) DEFAULT 0,
  stale_deal_count integer DEFAULT 0,
  at_risk_count integer DEFAULT 0,
  bottleneck_stage text,
  avg_days_in_pipeline numeric(8,2) DEFAULT 0,
  win_rate numeric(5,2) DEFAULT 0,
  loss_rate numeric(5,2) DEFAULT 0,
  health_factors jsonb DEFAULT '{}'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_health_workspace ON pipeline_health(workspace_id);
CREATE INDEX idx_pipeline_health_date ON pipeline_health(health_date DESC);
ALTER TABLE pipeline_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pipeline_health" ON pipeline_health FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pipeline_health" ON pipeline_health FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pipeline_health" ON pipeline_health FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_health.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pipeline_health" ON pipeline_health FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_health.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PIPELINE PREDICTIONS
-- ============================================================
CREATE TABLE pipeline_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES pipeline_deals(id) ON DELETE CASCADE,
  predicted_probability integer NOT NULL,
  predicted_close_date date,
  predicted_value numeric(14,2),
  ai_confidence numeric DEFAULT 0.5,
  ai_reasoning text,
  supporting_signals jsonb DEFAULT '[]'::jsonb,
  risk_factors jsonb DEFAULT '[]'::jsonb,
  recommended_action text,
  prediction_version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_predictions_workspace ON pipeline_predictions(workspace_id);
CREATE INDEX idx_pipeline_predictions_deal ON pipeline_predictions(deal_id);
CREATE INDEX idx_pipeline_predictions_created ON pipeline_predictions(created_at DESC);
ALTER TABLE pipeline_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pipeline_predictions" ON pipeline_predictions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pipeline_predictions" ON pipeline_predictions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pipeline_predictions" ON pipeline_predictions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_predictions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pipeline_predictions" ON pipeline_predictions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_predictions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PIPELINE LEAKAGE
-- ============================================================
CREATE TABLE pipeline_leakage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  leakage_type text NOT NULL CHECK (leakage_type IN ('stalled','no_activity','meeting_overdue','proposal_ignored','no_reply','competitor_detected','negative_sentiment','dm_missing','wrong_icp','low_engagement','budget_concern','pricing_objection','sequence_stopped','lost_momentum')),
  leakage_description text,
  risk_score integer DEFAULT 0,
  confidence numeric DEFAULT 0.5,
  expected_impact text,
  recommended_action text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_leakage_workspace ON pipeline_leakage(workspace_id);
CREATE INDEX idx_pipeline_leakage_deal ON pipeline_leakage(deal_id);
CREATE INDEX idx_pipeline_leakage_resolved ON pipeline_leakage(resolved) WHERE resolved = false;
ALTER TABLE pipeline_leakage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pipeline_leakage" ON pipeline_leakage FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_leakage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_pipeline_leakage" ON pipeline_leakage FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_leakage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_pipeline_leakage" ON pipeline_leakage FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_leakage.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_leakage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_pipeline_leakage" ON pipeline_leakage FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = pipeline_leakage.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- REVENUE FORECASTS
-- ============================================================
CREATE TABLE revenue_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  forecast_type text NOT NULL CHECK (forecast_type IN ('daily','weekly','monthly','quarterly','annual')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  expected_revenue numeric(14,2) DEFAULT 0,
  weighted_revenue numeric(14,2) DEFAULT 0,
  best_case_revenue numeric(14,2) DEFAULT 0,
  worst_case_revenue numeric(14,2) DEFAULT 0,
  committed_revenue numeric(14,2) DEFAULT 0,
  pipeline_revenue numeric(14,2) DEFAULT 0,
  forecast_confidence numeric DEFAULT 0.5,
  deal_count integer DEFAULT 0,
  ai_reasoning text,
  supporting_signals jsonb DEFAULT '[]'::jsonb,
  model_version text DEFAULT 'v1',
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_forecasts_workspace ON revenue_forecasts(workspace_id);
CREATE INDEX idx_revenue_forecasts_type ON revenue_forecasts(forecast_type);
CREATE INDEX idx_revenue_forecasts_period ON revenue_forecasts(period_start, period_end);
ALTER TABLE revenue_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_forecasts" ON revenue_forecasts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_forecasts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_forecasts" ON revenue_forecasts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_forecasts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_forecasts" ON revenue_forecasts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_forecasts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_forecasts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_forecasts" ON revenue_forecasts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_forecasts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FORECAST MODELS
-- ============================================================
CREATE TABLE forecast_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  model_type text NOT NULL CHECK (model_type IN ('weighted_pipeline','ai_predictive','historical_avg','ml_regression','hybrid')),
  parameters jsonb DEFAULT '{}'::jsonb,
  accuracy_score numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  last_trained_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forecast_models_workspace ON forecast_models(workspace_id);
ALTER TABLE forecast_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_forecast_models" ON forecast_models FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_forecast_models" ON forecast_models FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_forecast_models" ON forecast_models FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_models.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_forecast_models" ON forecast_models FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_models.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FORECAST VERSIONS
-- ============================================================
CREATE TABLE forecast_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES revenue_forecasts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  expected_revenue numeric(14,2),
  weighted_revenue numeric(14,2),
  confidence numeric,
  change_reason text,
  changed_by text DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forecast_versions_workspace ON forecast_versions(workspace_id);
CREATE INDEX idx_forecast_versions_forecast ON forecast_versions(forecast_id);
ALTER TABLE forecast_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_forecast_versions" ON forecast_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_forecast_versions" ON forecast_versions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_forecast_versions" ON forecast_versions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_versions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_forecast_versions" ON forecast_versions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_versions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FORECAST ACCURACY
-- ============================================================
CREATE TABLE forecast_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES revenue_forecasts(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  forecasted_revenue numeric(14,2),
  actual_revenue numeric(14,2),
  variance numeric(14,2),
  variance_percentage numeric(5,2),
  accuracy_score numeric DEFAULT 0,
  bias text CHECK (bias IN ('over_forecast','under_forecast','accurate')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forecast_accuracy_workspace ON forecast_accuracy(workspace_id);
CREATE INDEX idx_forecast_accuracy_period ON forecast_accuracy(period_start, period_end);
ALTER TABLE forecast_accuracy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_forecast_accuracy" ON forecast_accuracy FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_forecast_accuracy" ON forecast_accuracy FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_forecast_accuracy" ON forecast_accuracy FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_accuracy.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_accuracy.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_forecast_accuracy" ON forecast_accuracy FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_accuracy.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FORECAST HISTORY
-- ============================================================
CREATE TABLE forecast_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  forecast_type text NOT NULL,
  expected_revenue numeric(14,2),
  weighted_revenue numeric(14,2),
  actual_revenue numeric(14,2),
  confidence numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forecast_history_workspace ON forecast_history(workspace_id);
CREATE INDEX idx_forecast_history_date ON forecast_history(snapshot_date DESC);
ALTER TABLE forecast_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_forecast_history" ON forecast_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_forecast_history" ON forecast_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_forecast_history" ON forecast_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_forecast_history" ON forecast_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FORECAST ADJUSTMENTS
-- ============================================================
CREATE TABLE forecast_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES revenue_forecasts(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('manual_override','ai_correction','market_event','seasonal','one_time','recurring')),
  original_value numeric(14,2),
  adjusted_value numeric(14,2),
  adjustment_reason text,
  adjusted_by text DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forecast_adjustments_workspace ON forecast_adjustments(workspace_id);
ALTER TABLE forecast_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_forecast_adjustments" ON forecast_adjustments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_forecast_adjustments" ON forecast_adjustments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_forecast_adjustments" ON forecast_adjustments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_adjustments.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_adjustments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_forecast_adjustments" ON forecast_adjustments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_adjustments.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FORECAST CONFIDENCE
-- ============================================================
CREATE TABLE forecast_confidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES revenue_forecasts(id) ON DELETE CASCADE,
  confidence_score numeric NOT NULL,
  confidence_factors jsonb DEFAULT '{}'::jsonb,
  data_quality_score numeric DEFAULT 0,
  historical_accuracy numeric DEFAULT 0,
  pipeline_visibility numeric DEFAULT 0,
  market_volatility text DEFAULT 'medium' CHECK (market_volatility IN ('low','medium','high')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forecast_confidence_workspace ON forecast_confidence(workspace_id);
ALTER TABLE forecast_confidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_forecast_confidence" ON forecast_confidence FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_confidence.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_forecast_confidence" ON forecast_confidence FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_confidence.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_forecast_confidence" ON forecast_confidence FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_confidence.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_confidence.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_forecast_confidence" ON forecast_confidence FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_confidence.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- FORECAST ASSUMPTIONS
-- ============================================================
CREATE TABLE forecast_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  forecast_id uuid REFERENCES revenue_forecasts(id) ON DELETE CASCADE,
  assumption_text text NOT NULL,
  assumption_type text DEFAULT 'general' CHECK (assumption_type IN ('general','market','seasonal','pipeline','historical','macro','competitive')),
  impact text,
  confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_forecast_assumptions_workspace ON forecast_assumptions(workspace_id);
ALTER TABLE forecast_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_forecast_assumptions" ON forecast_assumptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_assumptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_forecast_assumptions" ON forecast_assumptions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_assumptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_forecast_assumptions" ON forecast_assumptions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_assumptions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_assumptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_forecast_assumptions" ON forecast_assumptions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = forecast_assumptions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- REVENUE TRACKING
-- ============================================================
CREATE TABLE booked_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  revenue_date date NOT NULL DEFAULT CURRENT_DATE,
  revenue_type text DEFAULT 'new_business' CHECK (revenue_type IN ('new_business','renewal','upsell','cross_sell','expansion')),
  source_channel text,
  campaign_id text,
  industry text,
  geography text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_booked_revenue_workspace ON booked_revenue(workspace_id);
CREATE INDEX idx_booked_revenue_date ON booked_revenue(revenue_date);
ALTER TABLE booked_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_booked_revenue" ON booked_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = booked_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_booked_revenue" ON booked_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = booked_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_booked_revenue" ON booked_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = booked_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = booked_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_booked_revenue" ON booked_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = booked_revenue.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE projected_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  projection_date date NOT NULL,
  revenue_type text DEFAULT 'new_business',
  confidence numeric DEFAULT 0.5,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projected_revenue_workspace ON projected_revenue(workspace_id);
CREATE INDEX idx_projected_revenue_date ON projected_revenue(projection_date);
ALTER TABLE projected_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_projected_revenue" ON projected_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = projected_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_projected_revenue" ON projected_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = projected_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_projected_revenue" ON projected_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = projected_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = projected_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_projected_revenue" ON projected_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = projected_revenue.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE lost_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  loss_date date NOT NULL DEFAULT CURRENT_DATE,
  loss_reason text,
  competitor text,
  stage_when_lost text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lost_revenue_workspace ON lost_revenue(workspace_id);
CREATE INDEX idx_lost_revenue_date ON lost_revenue(loss_date);
ALTER TABLE lost_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_lost_revenue" ON lost_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = lost_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_lost_revenue" ON lost_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = lost_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_lost_revenue" ON lost_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = lost_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = lost_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_lost_revenue" ON lost_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = lost_revenue.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE renewal_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  renewal_date date NOT NULL,
  renewal_status text DEFAULT 'pending' CHECK (renewal_status IN ('pending','renewed','churned','at_risk')),
  churn_risk_score integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_renewal_revenue_workspace ON renewal_revenue(workspace_id);
CREATE INDEX idx_renewal_revenue_date ON renewal_revenue(renewal_date);
ALTER TABLE renewal_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_renewal_revenue" ON renewal_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_renewal_revenue" ON renewal_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_renewal_revenue" ON renewal_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_renewal_revenue" ON renewal_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_revenue.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE upsell_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  upsell_date date NOT NULL DEFAULT CURRENT_DATE,
  base_product text,
  upsell_product text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_upsell_revenue_workspace ON upsell_revenue(workspace_id);
ALTER TABLE upsell_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_upsell_revenue" ON upsell_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_upsell_revenue" ON upsell_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_upsell_revenue" ON upsell_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_upsell_revenue" ON upsell_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_revenue.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE cross_sell_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  cross_sell_date date NOT NULL DEFAULT CURRENT_DATE,
  original_product text,
  cross_sell_product text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cross_sell_revenue_workspace ON cross_sell_revenue(workspace_id);
ALTER TABLE cross_sell_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_cross_sell_revenue" ON cross_sell_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_cross_sell_revenue" ON cross_sell_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_cross_sell_revenue" ON cross_sell_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_cross_sell_revenue" ON cross_sell_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_revenue.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE monthly_recurring_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  mrr_date date NOT NULL DEFAULT CURRENT_DATE,
  new_mrr numeric(14,2) DEFAULT 0,
  expansion_mrr numeric(14,2) DEFAULT 0,
  contraction_mrr numeric(14,2) DEFAULT 0,
  churn_mrr numeric(14,2) DEFAULT 0,
  net_new_mrr numeric(14,2) DEFAULT 0,
  total_mrr numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_mrr_ws_date ON monthly_recurring_revenue(workspace_id, mrr_date);
CREATE INDEX idx_mrr_workspace ON monthly_recurring_revenue(workspace_id);
ALTER TABLE monthly_recurring_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_mrr" ON monthly_recurring_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = monthly_recurring_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_mrr" ON monthly_recurring_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = monthly_recurring_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_mrr" ON monthly_recurring_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = monthly_recurring_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = monthly_recurring_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_mrr" ON monthly_recurring_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = monthly_recurring_revenue.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE annual_recurring_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  arr_date date NOT NULL DEFAULT CURRENT_DATE,
  new_arr numeric(14,2) DEFAULT 0,
  expansion_arr numeric(14,2) DEFAULT 0,
  contraction_arr numeric(14,2) DEFAULT 0,
  churn_arr numeric(14,2) DEFAULT 0,
  net_new_arr numeric(14,2) DEFAULT 0,
  total_arr numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_arr_ws_date ON annual_recurring_revenue(workspace_id, arr_date);
CREATE INDEX idx_arr_workspace ON annual_recurring_revenue(workspace_id);
ALTER TABLE annual_recurring_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_arr" ON annual_recurring_revenue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_recurring_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_arr" ON annual_recurring_revenue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_recurring_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_arr" ON annual_recurring_revenue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_recurring_revenue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_recurring_revenue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_arr" ON annual_recurring_revenue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = annual_recurring_revenue.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE cashflow_projection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  projection_date date NOT NULL,
  expected_inflow numeric(14,2) DEFAULT 0,
  expected_outflow numeric(14,2) DEFAULT 0,
  net_cashflow numeric(14,2) DEFAULT 0,
  cumulative_cashflow numeric(14,2) DEFAULT 0,
  confidence numeric DEFAULT 0.5,
  assumptions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cashflow_workspace ON cashflow_projection(workspace_id);
CREATE INDEX idx_cashflow_date ON cashflow_projection(projection_date);
ALTER TABLE cashflow_projection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_cashflow" ON cashflow_projection FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cashflow_projection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_cashflow" ON cashflow_projection FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cashflow_projection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_cashflow" ON cashflow_projection FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cashflow_projection.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cashflow_projection.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_cashflow" ON cashflow_projection FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cashflow_projection.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PERFORMANCE ANALYTICS
-- ============================================================
CREATE TABLE sales_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  rep_name text,
  deals_won integer DEFAULT 0,
  deals_lost integer DEFAULT 0,
  total_pipeline_value numeric(14,2) DEFAULT 0,
  won_value numeric(14,2) DEFAULT 0,
  win_rate numeric(5,2) DEFAULT 0,
  avg_deal_size numeric(14,2) DEFAULT 0,
  avg_sales_cycle_days integer DEFAULT 0,
  quota_attainment numeric(5,2) DEFAULT 0,
  activities_count integer DEFAULT 0,
  meetings_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_perf_workspace ON sales_performance(workspace_id);
CREATE INDEX idx_sales_perf_period ON sales_performance(period_start, period_end);
ALTER TABLE sales_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sales_perf" ON sales_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = sales_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_sales_perf" ON sales_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = sales_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_sales_perf" ON sales_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = sales_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = sales_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_sales_perf" ON sales_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = sales_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE campaign_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  campaign_name text NOT NULL,
  campaign_id text,
  deals_generated integer DEFAULT 0,
  pipeline_value numeric(14,2) DEFAULT 0,
  won_value numeric(14,2) DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  cost_per_acquisition numeric(14,2) DEFAULT 0,
  roi numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaign_perf_workspace ON campaign_performance(workspace_id);
ALTER TABLE campaign_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_campaign_perf" ON campaign_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_campaign_perf" ON campaign_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_campaign_perf" ON campaign_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_campaign_perf" ON campaign_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE proposal_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_proposals integer DEFAULT 0,
  accepted_proposals integer DEFAULT 0,
  rejected_proposals integer DEFAULT 0,
  pending_proposals integer DEFAULT 0,
  acceptance_rate numeric(5,2) DEFAULT 0,
  avg_proposal_value numeric(14,2) DEFAULT 0,
  avg_time_to_accept_days integer DEFAULT 0,
  total_proposal_value numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_proposal_perf_workspace ON proposal_performance(workspace_id);
ALTER TABLE proposal_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_perf" ON proposal_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_perf" ON proposal_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_perf" ON proposal_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_perf" ON proposal_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE meeting_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_meetings integer DEFAULT 0,
  completed_meetings integer DEFAULT 0,
  cancelled_meetings integer DEFAULT 0,
  moved_to_opportunity integer DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  avg_meeting_score numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meeting_perf_workspace ON meeting_performance(workspace_id);
ALTER TABLE meeting_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_perf" ON meeting_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_perf" ON meeting_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_perf" ON meeting_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_perf" ON meeting_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE conversation_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_conversations integer DEFAULT 0,
  avg_sentiment numeric(5,2) DEFAULT 0,
  avg_health_score numeric(5,2) DEFAULT 0,
  positive_conversations integer DEFAULT 0,
  negative_conversations integer DEFAULT 0,
  response_rate numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversation_perf_workspace ON conversation_performance(workspace_id);
ALTER TABLE conversation_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_conversation_perf" ON conversation_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conversation_perf" ON conversation_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conversation_perf" ON conversation_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conversation_perf" ON conversation_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE linkedin_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_connections integer DEFAULT 0,
  messages_sent integer DEFAULT 0,
  response_rate numeric(5,2) DEFAULT 0,
  meetings_booked integer DEFAULT 0,
  deals_generated integer DEFAULT 0,
  pipeline_value numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_linkedin_perf_workspace ON linkedin_performance(workspace_id);
ALTER TABLE linkedin_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_linkedin_perf" ON linkedin_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_perf" ON linkedin_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_perf" ON linkedin_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_perf" ON linkedin_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE outreach_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_outreach integer DEFAULT 0,
  response_rate numeric(5,2) DEFAULT 0,
  meeting_rate numeric(5,2) DEFAULT 0,
  deals_generated integer DEFAULT 0,
  pipeline_value numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outreach_perf_workspace ON outreach_performance(workspace_id);
ALTER TABLE outreach_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_outreach_perf" ON outreach_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_outreach_perf" ON outreach_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_outreach_perf" ON outreach_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_outreach_perf" ON outreach_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE geography_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  geography text NOT NULL,
  deals_count integer DEFAULT 0,
  pipeline_value numeric(14,2) DEFAULT 0,
  won_value numeric(14,2) DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  avg_deal_size numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_geography_perf_workspace ON geography_performance(workspace_id);
ALTER TABLE geography_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_geography_perf" ON geography_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = geography_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_geography_perf" ON geography_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = geography_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_geography_perf" ON geography_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = geography_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = geography_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_geography_perf" ON geography_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = geography_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE industry_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  industry text NOT NULL,
  deals_count integer DEFAULT 0,
  pipeline_value numeric(14,2) DEFAULT 0,
  won_value numeric(14,2) DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  avg_deal_size numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_industry_perf_workspace ON industry_performance(workspace_id);
ALTER TABLE industry_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_industry_perf" ON industry_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = industry_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_industry_perf" ON industry_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = industry_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_industry_perf" ON industry_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = industry_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = industry_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_industry_perf" ON industry_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = industry_performance.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE channel_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  channel text NOT NULL,
  deals_count integer DEFAULT 0,
  pipeline_value numeric(14,2) DEFAULT 0,
  won_value numeric(14,2) DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  avg_deal_size numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_channel_perf_workspace ON channel_performance(workspace_id);
ALTER TABLE channel_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_channel_perf" ON channel_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_channel_perf" ON channel_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_channel_perf" ON channel_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_channel_perf" ON channel_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_performance.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE INTELLIGENCE
-- ============================================================
CREATE TABLE executive_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  summary_type text NOT NULL CHECK (summary_type IN ('daily','weekly','monthly','quarterly','annual','board')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  summary_text text NOT NULL,
  key_metrics jsonb DEFAULT '{}'::jsonb,
  highlights jsonb DEFAULT '[]'::jsonb,
  risks jsonb DEFAULT '[]'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  ai_confidence numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exec_summaries_workspace ON executive_summaries(workspace_id);
CREATE INDEX idx_exec_summaries_type ON executive_summaries(summary_type);
ALTER TABLE executive_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_exec_summaries" ON executive_summaries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_summaries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_exec_summaries" ON executive_summaries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_summaries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_exec_summaries" ON executive_summaries FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_summaries.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_summaries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_exec_summaries" ON executive_summaries FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_summaries.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE executive_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brief_date date NOT NULL DEFAULT CURRENT_DATE,
  brief_type text DEFAULT 'daily' CHECK (brief_type IN ('daily','weekly','monthly','quarterly')),
  headline text NOT NULL,
  summary text,
  key_points jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exec_briefs_workspace ON executive_briefs(workspace_id);
CREATE INDEX idx_exec_briefs_date ON executive_briefs(brief_date DESC);
ALTER TABLE executive_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_exec_briefs" ON executive_briefs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_exec_briefs" ON executive_briefs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_exec_briefs" ON executive_briefs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_briefs.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_exec_briefs" ON executive_briefs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_briefs.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE revenue_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  insight_type text NOT NULL CHECK (insight_type IN ('trend','opportunity','risk','anomaly','recommendation','benchmark','prediction')),
  insight_title text NOT NULL,
  insight_text text NOT NULL,
  insight_data jsonb DEFAULT '{}'::jsonb,
  severity text DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  confidence numeric DEFAULT 0.5,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_insights_workspace ON revenue_insights(workspace_id);
CREATE INDEX idx_revenue_insights_unread ON revenue_insights(is_read) WHERE is_read = false;
ALTER TABLE revenue_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_insights" ON revenue_insights FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_insights.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_insights" ON revenue_insights FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_insights.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_insights" ON revenue_insights FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_insights.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_insights.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_insights" ON revenue_insights FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_insights.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE revenue_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN (
    'forecast_increased','forecast_decreased','large_deal_at_risk','large_deal_won',
    'pipeline_shrinking','pipeline_growing','proposal_accepted','proposal_ignored',
    'meeting_cancelled','meeting_scheduled','mrr_increased','arr_increased',
    'low_forecast_confidence','pipeline_bottleneck','revenue_milestone'
  )),
  alert_title text NOT NULL,
  alert_message text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  alert_data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  is_resolved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_alerts_workspace ON revenue_alerts(workspace_id);
CREATE INDEX idx_revenue_alerts_unread ON revenue_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_revenue_alerts_severity ON revenue_alerts(severity);
ALTER TABLE revenue_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_alerts" ON revenue_alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_alerts" ON revenue_alerts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_alerts" ON revenue_alerts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_alerts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_alerts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_alerts" ON revenue_alerts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_alerts.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE revenue_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  opportunity_type text NOT NULL CHECK (opportunity_type IN ('upsell','cross_sell','expansion','renewal','new_business','win_back')),
  opportunity_title text NOT NULL,
  opportunity_description text,
  estimated_value numeric(14,2),
  probability integer DEFAULT 50,
  timeframe text,
  ai_confidence numeric DEFAULT 0.5,
  ai_reasoning text,
  is_actioned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_opp_workspace ON revenue_opportunities(workspace_id);
ALTER TABLE revenue_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_opp" ON revenue_opportunities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_opp" ON revenue_opportunities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_opp" ON revenue_opportunities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_opportunities.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_opp" ON revenue_opportunities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_opportunities.workspace_id AND wm.user_id = auth.uid()));

CREATE TABLE revenue_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  anomaly_type text NOT NULL CHECK (anomaly_type IN ('spike','drop','unusual_pattern','outlier','threshold_breach')),
  anomaly_description text NOT NULL,
  metric_name text NOT NULL,
  expected_value numeric(14,2),
  actual_value numeric(14,2),
  deviation_percentage numeric(5,2),
  detected_at timestamptz NOT NULL DEFAULT now(),
  is_investigated boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_anomalies_workspace ON revenue_anomalies(workspace_id);
ALTER TABLE revenue_anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_revenue_anomalies" ON revenue_anomalies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_anomalies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_anomalies" ON revenue_anomalies FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_anomalies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_anomalies" ON revenue_anomalies FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_anomalies.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_anomalies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_anomalies" ON revenue_anomalies FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_anomalies.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_rf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipeline_stages','pipeline_deals','forecast_models'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%I_rf_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trigger_%I_rf_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_rf_updated_at();', t, t);
  END LOOP;
END $$;

-- ============================================================
-- SEED DEFAULT PIPELINE STAGES
-- ============================================================
INSERT INTO pipeline_stages (workspace_id, stage_name, stage_order, default_probability)
SELECT w.id, 'qualification', 1, 20 FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.workspace_id = w.id AND ps.stage_name = 'qualification')
UNION ALL
SELECT w.id, 'discovery', 2, 35 FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.workspace_id = w.id AND ps.stage_name = 'discovery')
UNION ALL
SELECT w.id, 'proposal', 3, 55 FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.workspace_id = w.id AND ps.stage_name = 'proposal')
UNION ALL
SELECT w.id, 'negotiation', 4, 75 FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.workspace_id = w.id AND ps.stage_name = 'negotiation')
UNION ALL
SELECT w.id, 'closed_won', 5, 100 FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages ps WHERE ps.workspace_id = w.id AND ps.stage_name = 'closed_won');

UPDATE pipeline_stages SET is_won_stage = true WHERE stage_name = 'closed_won';

-- ============================================================
-- SEED DEFAULT FORECAST MODEL
-- ============================================================
INSERT INTO forecast_models (workspace_id, model_name, model_type, parameters, accuracy_score, is_active)
SELECT w.id, 'AI Predictive Model', 'ai_predictive', '{"weighting": "ai_confidence", "lookback_days": 90}'::jsonb, 0, true
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM forecast_models fm WHERE fm.workspace_id = w.id);
