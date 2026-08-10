/*
# Phase 20 — Autonomous Revenue Execution Engine (Part 3/3)

## Playbooks, Autopilot Settings, ROI Tracking & Triggers

### New Tables (6)
1. execution_playbooks — Reusable AI playbooks with steps, agents, ROI, approvals
2. playbook_executions — Execution instances of playbooks
3. autopilot_settings — Global autopilot mode and configuration
4. autopilot_module_configs — Per-module autopilot configuration (what AI may do, what requires approval)
5. roi_tracking — ROI measurements for plans, actions, and optimizations
6. roi_snapshots — Periodic ROI snapshots for the entire platform

### Security
- RLS enabled on every table, 4 CRUD policies each via workspace_members join

### Triggers
- updated_at triggers on all 34 new Phase 20 tables
*/

-- 1. execution_playbooks
CREATE TABLE IF NOT EXISTS execution_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  playbook_name text NOT NULL,
  playbook_description text,
  playbook_category text NOT NULL CHECK (playbook_category IN ('churn_recovery','lost_proposal_recovery','reply_rate_increase','meeting_generation','revenue_growth','outbound_campaign','failed_payment_recovery','customer_upsell','customer_renewal','account_expansion','hiring','market_expansion','pricing_optimization','pipeline_acceleration','retention','expansion','custom')),
  playbook_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_agents text[] DEFAULT '{}'::text[],
  required_approvals text[] DEFAULT '{}'::text[],
  estimated_roi numeric,
  estimated_duration_hours integer,
  estimated_cost numeric DEFAULT 0,
  estimated_revenue_impact numeric DEFAULT 0,
  success_metrics jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  is_template boolean DEFAULT false,
  trigger_conditions jsonb DEFAULT '{}'::jsonb,
  playbook_metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE execution_playbooks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_playbooks_workspace ON execution_playbooks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_playbooks_category ON execution_playbooks(playbook_category);
CREATE INDEX IF NOT EXISTS idx_exec_playbooks_active ON execution_playbooks(is_active);
CREATE INDEX IF NOT EXISTS idx_exec_playbooks_created ON execution_playbooks(created_at DESC);

DROP POLICY IF EXISTS "select_own_exec_playbooks" ON execution_playbooks;
CREATE POLICY "select_own_exec_playbooks" ON execution_playbooks FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_playbooks.workspace_id));
DROP POLICY IF EXISTS "insert_own_exec_playbooks" ON execution_playbooks;
CREATE POLICY "insert_own_exec_playbooks" ON execution_playbooks FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_playbooks.workspace_id));
DROP POLICY IF EXISTS "update_own_exec_playbooks" ON execution_playbooks;
CREATE POLICY "update_own_exec_playbooks" ON execution_playbooks FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_playbooks.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_playbooks.workspace_id));
DROP POLICY IF EXISTS "delete_own_exec_playbooks" ON execution_playbooks;
CREATE POLICY "delete_own_exec_playbooks" ON execution_playbooks FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = execution_playbooks.workspace_id));

-- 2. playbook_executions
CREATE TABLE IF NOT EXISTS playbook_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  playbook_id uuid REFERENCES execution_playbooks(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES execution_plans(id) ON DELETE SET NULL,
  execution_name text NOT NULL,
  execution_status text NOT NULL DEFAULT 'pending' CHECK (execution_status IN ('pending','approved','executing','completed','failed','cancelled','paused')),
  target_entity_type text,
  target_entity_id text,
  current_step integer NOT NULL DEFAULT 0,
  total_steps integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  estimated_roi numeric,
  actual_roi numeric,
  success_metrics_snapshot jsonb DEFAULT '{}'::jsonb,
  execution_metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_playbook_execs_workspace ON playbook_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_playbook_execs_playbook ON playbook_executions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_execs_status ON playbook_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_playbook_execs_created ON playbook_executions(created_at DESC);

DROP POLICY IF EXISTS "select_own_playbook_execs" ON playbook_executions;
CREATE POLICY "select_own_playbook_execs" ON playbook_executions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = playbook_executions.workspace_id));
DROP POLICY IF EXISTS "insert_own_playbook_execs" ON playbook_executions;
CREATE POLICY "insert_own_playbook_execs" ON playbook_executions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = playbook_executions.workspace_id));
DROP POLICY IF EXISTS "update_own_playbook_execs" ON playbook_executions;
CREATE POLICY "update_own_playbook_execs" ON playbook_executions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = playbook_executions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = playbook_executions.workspace_id));
DROP POLICY IF EXISTS "delete_own_playbook_execs" ON playbook_executions;
CREATE POLICY "delete_own_playbook_execs" ON playbook_executions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = playbook_executions.workspace_id));

-- 3. autopilot_settings
CREATE TABLE IF NOT EXISTS autopilot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  autopilot_mode text NOT NULL DEFAULT 'off' CHECK (autopilot_mode IN ('off','advisory','semi_autonomous','fully_autonomous')),
  is_active boolean NOT NULL DEFAULT false,
  max_daily_actions integer NOT NULL DEFAULT 100,
  max_daily_cost numeric NOT NULL DEFAULT 50,
  max_concurrent_executions integer NOT NULL DEFAULT 5,
  requires_approval_threshold numeric DEFAULT 100,
  auto_approval_confidence_threshold numeric DEFAULT 0.85,
  auto_approval_risk_threshold numeric DEFAULT 0.3,
  escalation_enabled boolean DEFAULT true,
  learning_enabled boolean DEFAULT true,
  optimization_enabled boolean DEFAULT true,
  business_event_processing_enabled boolean DEFAULT true,
  decision_engine_enabled boolean DEFAULT true,
  notification_preferences jsonb DEFAULT '{}'::jsonb,
  last_cycle_at timestamptz,
  total_cycles integer NOT NULL DEFAULT 0,
  total_actions_executed integer NOT NULL DEFAULT 0,
  total_actions_succeeded integer NOT NULL DEFAULT 0,
  total_actions_failed integer NOT NULL DEFAULT 0,
  total_roi numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE autopilot_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_autopilot_settings_workspace ON autopilot_settings(workspace_id);

DROP POLICY IF EXISTS "select_own_autopilot_settings" ON autopilot_settings;
CREATE POLICY "select_own_autopilot_settings" ON autopilot_settings FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_settings.workspace_id));
DROP POLICY IF EXISTS "insert_own_autopilot_settings" ON autopilot_settings;
CREATE POLICY "insert_own_autopilot_settings" ON autopilot_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_settings.workspace_id));
DROP POLICY IF EXISTS "update_own_autopilot_settings" ON autopilot_settings;
CREATE POLICY "update_own_autopilot_settings" ON autopilot_settings FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_settings.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_settings.workspace_id));
DROP POLICY IF EXISTS "delete_own_autopilot_settings" ON autopilot_settings;
CREATE POLICY "delete_own_autopilot_settings" ON autopilot_settings FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_settings.workspace_id));

-- 4. autopilot_module_configs
CREATE TABLE IF NOT EXISTS autopilot_module_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  module_name text NOT NULL,
  module_display_name text NOT NULL,
  allowed_actions text[] NOT NULL DEFAULT '{}'::text[],
  approval_required_actions text[] NOT NULL DEFAULT '{}'::text[],
  human_only_actions text[] NOT NULL DEFAULT '{}'::text[],
  max_daily_actions integer DEFAULT 20,
  max_daily_cost numeric DEFAULT 10,
  confidence_threshold numeric DEFAULT 0.8,
  risk_threshold numeric DEFAULT 0.3,
  is_enabled boolean DEFAULT true,
  module_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE autopilot_module_configs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_autopilot_module_configs_workspace ON autopilot_module_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_module_configs_module ON autopilot_module_configs(module_name);

DROP POLICY IF EXISTS "select_own_autopilot_module_configs" ON autopilot_module_configs;
CREATE POLICY "select_own_autopilot_module_configs" ON autopilot_module_configs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_module_configs.workspace_id));
DROP POLICY IF EXISTS "insert_own_autopilot_module_configs" ON autopilot_module_configs;
CREATE POLICY "insert_own_autopilot_module_configs" ON autopilot_module_configs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_module_configs.workspace_id));
DROP POLICY IF EXISTS "update_own_autopilot_module_configs" ON autopilot_module_configs;
CREATE POLICY "update_own_autopilot_module_configs" ON autopilot_module_configs FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_module_configs.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_module_configs.workspace_id));
DROP POLICY IF EXISTS "delete_own_autopilot_module_configs" ON autopilot_module_configs;
CREATE POLICY "delete_own_autopilot_module_configs" ON autopilot_module_configs FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = autopilot_module_configs.workspace_id));

-- 5. roi_tracking
CREATE TABLE IF NOT EXISTS roi_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('plan','action','playbook','optimization','recommendation','cycle','campaign','module')),
  entity_id uuid NOT NULL,
  roi_type text NOT NULL CHECK (roi_type IN ('revenue','cost_savings','efficiency','pipeline_value','retention_value','expansion_value','avoided_loss','opportunity_cost')),
  investment_amount numeric NOT NULL DEFAULT 0,
  return_amount numeric NOT NULL DEFAULT 0,
  roi_percentage numeric,
  roi_status text NOT NULL DEFAULT 'pending' CHECK (roi_status IN ('pending','measuring','realized','projected','failed','partial')),
  measurement_start timestamptz,
  measurement_end timestamptz,
  measurement_window_days integer DEFAULT 30,
  confidence_score numeric DEFAULT 0.5,
  notes text,
  roi_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE roi_tracking ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_roi_tracking_workspace ON roi_tracking(workspace_id);
CREATE INDEX IF NOT EXISTS idx_roi_tracking_entity ON roi_tracking(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_roi_tracking_status ON roi_tracking(roi_status);
CREATE INDEX IF NOT EXISTS idx_roi_tracking_created ON roi_tracking(created_at DESC);

DROP POLICY IF EXISTS "select_own_roi_tracking" ON roi_tracking;
CREATE POLICY "select_own_roi_tracking" ON roi_tracking FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_tracking.workspace_id));
DROP POLICY IF EXISTS "insert_own_roi_tracking" ON roi_tracking;
CREATE POLICY "insert_own_roi_tracking" ON roi_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_tracking.workspace_id));
DROP POLICY IF EXISTS "update_own_roi_tracking" ON roi_tracking;
CREATE POLICY "update_own_roi_tracking" ON roi_tracking FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_tracking.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_tracking.workspace_id));
DROP POLICY IF EXISTS "delete_own_roi_tracking" ON roi_tracking;
CREATE POLICY "delete_own_roi_tracking" ON roi_tracking FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_tracking.workspace_id));

-- 6. roi_snapshots
CREATE TABLE IF NOT EXISTS roi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  snapshot_period text NOT NULL,
  total_investment numeric NOT NULL DEFAULT 0,
  total_return numeric NOT NULL DEFAULT 0,
  total_roi numeric NOT NULL DEFAULT 0,
  total_roi_percentage numeric,
  plans_measured integer NOT NULL DEFAULT 0,
  actions_measured integer NOT NULL DEFAULT 0,
  optimizations_measured integer NOT NULL DEFAULT 0,
  top_performing_area text,
  worst_performing_area text,
  roi_by_area jsonb DEFAULT '{}'::jsonb,
  snapshot_data jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE roi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_roi_snapshots_workspace ON roi_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_roi_snapshots_period ON roi_snapshots(snapshot_period);
CREATE INDEX IF NOT EXISTS idx_roi_snapshots_recorded ON roi_snapshots(recorded_at DESC);

DROP POLICY IF EXISTS "select_own_roi_snapshots" ON roi_snapshots;
CREATE POLICY "select_own_roi_snapshots" ON roi_snapshots FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_snapshots.workspace_id));
DROP POLICY IF EXISTS "insert_own_roi_snapshots" ON roi_snapshots;
CREATE POLICY "insert_own_roi_snapshots" ON roi_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_snapshots.workspace_id));
DROP POLICY IF EXISTS "update_own_roi_snapshots" ON roi_snapshots;
CREATE POLICY "update_own_roi_snapshots" ON roi_snapshots FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_snapshots.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_snapshots.workspace_id));
DROP POLICY IF EXISTS "delete_own_roi_snapshots" ON roi_snapshots;
CREATE POLICY "delete_own_roi_snapshots" ON roi_snapshots FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = roi_snapshots.workspace_id));

-- Updated_at triggers for all 34 Phase 20 tables
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'autonomous_execution_cycles','execution_plans','execution_sessions','execution_actions','execution_results','execution_metrics','execution_failures','execution_learning','execution_recommendations','execution_confidence','execution_approvals','autopilot_execution_history',
      'business_events','business_event_rules','business_event_actions','business_event_history','business_event_queue',
      'decision_engine','decision_models','decision_evidence','decision_outcomes','decision_accuracy','decision_versions',
      'optimization_opportunities','optimization_history',
      'learning_snapshots','learning_history','recommendation_improvements',
      'execution_playbooks','playbook_executions',
      'autopilot_settings','autopilot_module_configs',
      'roi_tracking','roi_snapshots'
    )
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = pg_tables.tablename AND table_schema = 'public' AND column_name = 'updated_at')
    AND NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class cls ON cls.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = cls.relnamespace WHERE n.nspname = 'public' AND cls.relname = pg_tables.tablename AND tg.tgname = 'set_updated_at')
  LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t.tablename);
      RAISE NOTICE 'Created updated_at trigger on %', t.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %: %', t.tablename, SQLERRM;
    END;
  END LOOP;
END;
$$;