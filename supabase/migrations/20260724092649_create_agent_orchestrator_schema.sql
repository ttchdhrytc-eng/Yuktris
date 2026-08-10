/*
# Create Enterprise Agent Orchestrator Schema

## Overview
Creates the database infrastructure for the centralized Agent
Orchestrator. Every AI Agent registers here, every execution is
tracked, and dependencies between agents are declared.

## New Tables (3)

1. **agent_registry** — Registry of all AI Agents. Each agent
   declares its name, description, version, status, category,
   input/output schemas (JSON), and capabilities (text[]). Seeded
   with 14 production-ready placeholder agents.

2. **agent_executions** — Append-only log of every agent execution.
   Tracks the agent, optional workflow grouping, status, input
   payload, output payload, execution time, tokens, cost, and
   errors. Used for observability and metrics.

3. **agent_dependencies** — Declares which agents depend on which
   others, with a dependency type (requires / optional / enhances).
   Used by the DependencyResolver for execution ordering.

## Security
- RLS enabled on all three tables.
- agent_registry: any authenticated user can SELECT; only
  owner/admin can INSERT/UPDATE/DELETE.
- agent_executions: workspace members can SELECT their workspace's
  executions; any authenticated user can INSERT (the orchestrator
  logs on behalf of agents); only owner/admin can DELETE.
- agent_dependencies: any authenticated user can SELECT; only
  owner/admin can INSERT/UPDATE/DELETE.
- 4 CRUD policies per table — no FOR ALL.
*/

-- ============================================================
-- 1. agent_registry
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL UNIQUE,
  description text,
  version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated', 'error')),
  category text NOT NULL DEFAULT 'research' CHECK (category IN ('research', 'intelligence', 'scoring', 'generation', 'communication', 'crm', 'scheduling', 'analysis', 'workflow')),
  input_schema jsonb,
  output_schema jsonb,
  capabilities text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_agent_registry_category ON agent_registry(category);

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_agent_registry" ON agent_registry;
CREATE POLICY "select_agent_registry" ON agent_registry
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_agent_registry" ON agent_registry;
CREATE POLICY "insert_agent_registry" ON agent_registry
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_agent_registry" ON agent_registry;
CREATE POLICY "update_agent_registry" ON agent_registry
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_agent_registry" ON agent_registry;
CREATE POLICY "delete_agent_registry" ON agent_registry
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 2. agent_executions
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES agent_registry(id) ON DELETE SET NULL,
  workflow_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'planning', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
  input_payload jsonb,
  output_payload jsonb,
  execution_time_ms integer NOT NULL DEFAULT 0,
  tokens_used integer NOT NULL DEFAULT 0,
  estimated_cost numeric(12,6) NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_executions_workspace_id ON agent_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_workflow_id ON agent_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at DESC);

ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_agent_executions" ON agent_executions;
CREATE POLICY "select_agent_executions" ON agent_executions
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "insert_agent_executions" ON agent_executions;
CREATE POLICY "insert_agent_executions" ON agent_executions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_agent_executions" ON agent_executions;
CREATE POLICY "update_agent_executions" ON agent_executions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_agent_executions" ON agent_executions;
CREATE POLICY "delete_agent_executions" ON agent_executions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 3. agent_dependencies
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  depends_on_agent_id uuid NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'requires' CHECK (dependency_type IN ('requires', 'optional', 'enhances')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_dependencies_unique ON agent_dependencies(agent_id, depends_on_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_dependencies_agent_id ON agent_dependencies(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_dependencies_depends_on ON agent_dependencies(depends_on_agent_id);

ALTER TABLE agent_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_agent_dependencies" ON agent_dependencies;
CREATE POLICY "select_agent_dependencies" ON agent_dependencies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_agent_dependencies" ON agent_dependencies;
CREATE POLICY "insert_agent_dependencies" ON agent_dependencies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_agent_dependencies" ON agent_dependencies;
CREATE POLICY "update_agent_dependencies" ON agent_dependencies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_agent_dependencies" ON agent_dependencies;
CREATE POLICY "delete_agent_dependencies" ON agent_dependencies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_agent_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_agent_registry_updated_at ON agent_registry;
CREATE TRIGGER trigger_agent_registry_updated_at
  BEFORE UPDATE ON agent_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_registry_updated_at();

-- ============================================================
-- Seed: Agent Registry (14 production-ready placeholder agents)
-- ============================================================

INSERT INTO agent_registry (agent_name, description, version, status, category, capabilities, input_schema, output_schema)
VALUES
  (
    'website_research_agent',
    'Crawls and analyzes company websites to extract business information, products, services, and value propositions.',
    '1.0.0', 'active', 'research',
    ARRAY['web_crawling', 'content_extraction', 'business_analysis'],
    '{"type":"object","properties":{"url":{"type":"string"},"depth":{"type":"integer"}},"required":["url"]}',
    '{"type":"object","properties":{"summary":{"type":"string"},"products":{"type":"array"},"services":{"type":"array"}}}'
  ),
  (
    'company_intelligence_agent',
    'Aggregates company data from multiple sources to build a comprehensive company profile.',
    '1.0.0', 'active', 'intelligence',
    ARRAY['data_aggregation', 'company_profiling', 'market_research'],
    '{"type":"object","properties":{"company_name":{"type":"string"},"domain":{"type":"string"}},"required":["company_name"]}',
    '{"type":"object","properties":{"profile":{"type":"object"},"market_position":{"type":"string"}}}'
  ),
  (
    'linkedin_intelligence_agent',
    'Gathers LinkedIn data for companies and decision-makers including employee count, growth, and key personnel.',
    '1.0.0', 'active', 'intelligence',
    ARRAY['linkedin_research', 'people_discovery', 'company_insights'],
    '{"type":"object","properties":{"company_name":{"type":"string"},"person_name":{"type":"string"}}}',
    '{"type":"object","properties":{"employees":{"type":"array"},"key_personnel":{"type":"array"}}}'
  ),
  (
    'technology_detection_agent',
    'Detects the technology stack used by a company including frameworks, CMS, analytics, and infrastructure.',
    '1.0.0', 'active', 'research',
    ARRAY['tech_detection', 'stack_analysis', 'infrastructure_mapping'],
    '{"type":"object","properties":{"domain":{"type":"string"}},"required":["domain"]}',
    '{"type":"object","properties":{"technologies":{"type":"array"},"categories":{"type":"object"}}}'
  ),
  (
    'seo_analysis_agent',
    'Analyzes SEO metrics, keywords, and search visibility for a company domain.',
    '1.0.0', 'active', 'analysis',
    ARRAY['seo_analysis', 'keyword_research', 'visibility_scoring'],
    '{"type":"object","properties":{"domain":{"type":"string"}},"required":["domain"]}',
    '{"type":"object","properties":{"visibility_score":{"type":"number"},"keywords":{"type":"array"}}}'
  ),
  (
    'icp_scoring_agent',
    'Scores prospects against the Ideal Customer Profile criteria and ranks them by fit.',
    '1.0.0', 'active', 'scoring',
    ARRAY['icp_matching', 'prospect_scoring', 'fit_analysis'],
    '{"type":"object","properties":{"company":{"type":"object"},"icp_criteria":{"type":"object"}},"required":["company"]}',
    '{"type":"object","properties":{"score":{"type":"number"},"reasons":{"type":"array"}}}'
  ),
  (
    'buying_signal_agent',
    'Detects buying intent signals from company activities, tech changes, and market events.',
    '1.0.0', 'active', 'scoring',
    ARRAY['intent_detection', 'signal_analysis', 'urgency_scoring'],
    '{"type":"object","properties":{"company":{"type":"object"},"signals":{"type":"array"}}}',
    '{"type":"object","properties":{"intent_score":{"type":"number"},"signals":{"type":"array"}}}'
  ),
  (
    'proposal_generator_agent',
    'Generates customized proposals based on prospect needs and company capabilities.',
    '1.0.0', 'active', 'generation',
    ARRAY['proposal_generation', 'content_creation', 'personalization'],
    '{"type":"object","properties":{"prospect":{"type":"object"},"offering":{"type":"object"}}}',
    '{"type":"object","properties":{"proposal":{"type":"string"},"sections":{"type":"array"}}}'
  ),
  (
    'email_writer_agent',
    'Writes personalized outreach emails based on prospect profile and campaign context.',
    '1.0.0', 'active', 'communication',
    ARRAY['email_generation', 'personalization', 'copywriting'],
    '{"type":"object","properties":{"prospect":{"type":"object"},"tone":{"type":"string"}}}',
    '{"type":"object","properties":{"subject":{"type":"string"},"body":{"type":"string"}}}'
  ),
  (
    'follow_up_agent',
    'Generates follow-up messages based on previous outreach and response history.',
    '1.0.0', 'active', 'communication',
    ARRAY['follow_up_generation', 'sequence_management', 'response_analysis'],
    '{"type":"object","properties":{"previous_messages":{"type":"array"},"prospect":{"type":"object"}}}',
    '{"type":"object","properties":{"message":{"type":"string"},"timing":{"type":"string"}}}'
  ),
  (
    'meeting_preparation_agent',
    'Prepares meeting briefs from prospect data, account history, and research results.',
    '1.0.0', 'active', 'scheduling',
    ARRAY['meeting_prep', 'brief_generation', 'agenda_creation'],
    '{"type":"object","properties":{"prospect":{"type":"object"},"meeting_type":{"type":"string"}}}',
    '{"type":"object","properties":{"brief":{"type":"string"},"agenda":{"type":"array"}}}'
  ),
  (
    'crm_update_agent',
    'Updates CRM records with the latest prospect information and interaction history.',
    '1.0.0', 'active', 'crm',
    ARRAY['crm_sync', 'data_enrichment', 'record_updates'],
    '{"type":"object","properties":{"record_id":{"type":"string"},"updates":{"type":"object"}}}',
    '{"type":"object","properties":{"updated":{"type":"boolean"},"fields":{"type":"array"}}}'
  ),
  (
    'executive_summary_agent',
    'Synthesizes research and analysis into an executive summary for decision-makers.',
    '1.0.0', 'active', 'analysis',
    ARRAY['summarization', 'synthesis', 'executive_reporting'],
    '{"type":"object","properties":{"research_data":{"type":"object"},"audience":{"type":"string"}}}',
    '{"type":"object","properties":{"summary":{"type":"string"},"key_points":{"type":"array"}}}'
  ),
  (
    'workflow_decision_agent',
    'Makes routing decisions within workflows based on agent outputs and business rules.',
    '1.0.0', 'active', 'workflow',
    ARRAY['decision_routing', 'workflow_logic', 'conditional_execution'],
    '{"type":"object","properties":{"current_results":{"type":"object"},"rules":{"type":"object"}}}',
    '{"type":"object","properties":{"next_step":{"type":"string"},"reason":{"type":"string"}}}'
  )
ON CONFLICT (agent_name) DO NOTHING;

-- ============================================================
-- Seed: Agent Dependencies
-- ============================================================

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'company_intelligence_agent' AND b.agent_name = 'website_research_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'linkedin_intelligence_agent' AND b.agent_name = 'company_intelligence_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'icp_scoring_agent' AND b.agent_name = 'company_intelligence_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'enhances'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'icp_scoring_agent' AND b.agent_name = 'buying_signal_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'email_writer_agent' AND b.agent_name = 'icp_scoring_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'proposal_generator_agent' AND b.agent_name = 'icp_scoring_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'meeting_preparation_agent' AND b.agent_name = 'company_intelligence_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'enhances'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'meeting_preparation_agent' AND b.agent_name = 'linkedin_intelligence_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'executive_summary_agent' AND b.agent_name = 'company_intelligence_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'enhances'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'executive_summary_agent' AND b.agent_name = 'icp_scoring_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'follow_up_agent' AND b.agent_name = 'email_writer_agent'
ON CONFLICT DO NOTHING;

INSERT INTO agent_dependencies (agent_id, depends_on_agent_id, dependency_type)
SELECT a.id, b.id, 'requires'
FROM agent_registry a, agent_registry b
WHERE a.agent_name = 'workflow_decision_agent' AND b.agent_name = 'icp_scoring_agent'
ON CONFLICT DO NOTHING;
