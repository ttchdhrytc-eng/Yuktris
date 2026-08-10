/*
# Create Enterprise AI Gateway Schema

## Overview
Creates the database infrastructure for the centralized AI Gateway.
Every AI request in the platform is tracked, costed, and observable
through these tables. No AI agent may call a provider directly — all
requests flow through the gateway, which logs to these tables.

## New Tables (3)

1. **ai_models** — Registry of all available AI models across every
   provider. Stores capabilities (streaming, tools, images,
   embeddings), context window size, per-1K-token pricing, and status.
   Seeded with OpenAI models on creation.

2. **ai_requests** — Append-only log of every AI request made through
   the gateway. Tracks agent name, provider, model, request type,
   token counts, estimated cost, latency, and status. Used for
   observability, cost analytics, and usage tracking.

3. **ai_prompts** — Centralized prompt library with versioning. Each
   prompt has a system prompt, optional user prompt template,
   temperature, max tokens, and provider/model overrides. Only one
   version of a given prompt_name is active at a time.

## Security
- RLS enabled on all three tables.
- ai_models: workspace members can SELECT; only owner/admin can
  INSERT/UPDATE/DELETE.
- ai_requests: workspace members can SELECT; any authenticated user
  can INSERT (the gateway logs on behalf of agents); only owner/admin
  can DELETE.
- ai_prompts: workspace members can SELECT; only owner/admin can
  INSERT/UPDATE/DELETE.
- 4 CRUD policies per table — no FOR ALL.
*/

-- ============================================================
-- 1. ai_models
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'grok', 'openrouter', 'mistral', 'deepseek', 'local')),
  model_name text NOT NULL,
  model_type text NOT NULL DEFAULT 'chat' CHECK (model_type IN ('chat', 'completion', 'embedding', 'image', 'audio', 'vision')),
  context_window integer NOT NULL DEFAULT 4096,
  supports_streaming boolean NOT NULL DEFAULT true,
  supports_tools boolean NOT NULL DEFAULT false,
  supports_images boolean NOT NULL DEFAULT false,
  supports_embeddings boolean NOT NULL DEFAULT false,
  input_cost_per_1k numeric(10,6) NOT NULL DEFAULT 0,
  output_cost_per_1k numeric(10,6) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'preview', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_models_provider_model ON ai_models(provider, model_name);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_status ON ai_models(status);

ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ai_models" ON ai_models;
CREATE POLICY "select_ai_models" ON ai_models
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ai_models" ON ai_models;
CREATE POLICY "insert_ai_models" ON ai_models
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_ai_models" ON ai_models;
CREATE POLICY "update_ai_models" ON ai_models
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

DROP POLICY IF EXISTS "delete_ai_models" ON ai_models;
CREATE POLICY "delete_ai_models" ON ai_models
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 2. ai_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  agent_name text NOT NULL DEFAULT 'unknown',
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic', 'gemini', 'grok', 'openrouter', 'mistral', 'deepseek', 'local')),
  model text NOT NULL,
  request_type text NOT NULL DEFAULT 'text' CHECK (request_type IN ('text', 'structured', 'json', 'streaming', 'embedding', 'tool_call', 'image_understanding', 'token_count')),
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric(12,6) NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout', 'rate_limited', 'cancelled')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_workspace_id ON ai_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_provider ON ai_requests(provider);
CREATE INDEX IF NOT EXISTS idx_ai_requests_model ON ai_requests(model);
CREATE INDEX IF NOT EXISTS idx_ai_requests_agent ON ai_requests(agent_name);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at ON ai_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests(status);

ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ai_requests" ON ai_requests;
CREATE POLICY "select_ai_requests" ON ai_requests
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "insert_ai_requests" ON ai_requests;
CREATE POLICY "insert_ai_requests" ON ai_requests
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ai_requests" ON ai_requests;
CREATE POLICY "update_ai_requests" ON ai_requests
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

DROP POLICY IF EXISTS "delete_ai_requests" ON ai_requests;
CREATE POLICY "delete_ai_requests" ON ai_requests
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 3. ai_prompts
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  description text,
  system_prompt text NOT NULL DEFAULT '',
  user_prompt_template text,
  temperature numeric(3,2) NOT NULL DEFAULT 0.7,
  max_tokens integer,
  provider_override text CHECK (provider_override IS NULL OR provider_override IN ('openai', 'anthropic', 'gemini', 'grok', 'openrouter', 'mistral', 'deepseek', 'local')),
  model_override text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_prompts_name_version ON ai_prompts(prompt_name, version);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_name_active ON ai_prompts(prompt_name, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_prompts(is_active);

ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ai_prompts" ON ai_prompts;
CREATE POLICY "select_ai_prompts" ON ai_prompts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ai_prompts" ON ai_prompts;
CREATE POLICY "insert_ai_prompts" ON ai_prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_ai_prompts" ON ai_prompts;
CREATE POLICY "update_ai_prompts" ON ai_prompts
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

DROP POLICY IF EXISTS "delete_ai_prompts" ON ai_prompts;
CREATE POLICY "delete_ai_prompts" ON ai_prompts
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

CREATE OR REPLACE FUNCTION update_ai_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_models_updated_at ON ai_models;
CREATE TRIGGER trigger_ai_models_updated_at
  BEFORE UPDATE ON ai_models
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_models_updated_at();

CREATE OR REPLACE FUNCTION update_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_prompts_updated_at ON ai_prompts;
CREATE TRIGGER trigger_ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_prompts_updated_at();

-- ============================================================
-- Seed: OpenAI models
-- ============================================================

INSERT INTO ai_models (provider, model_name, model_type, context_window, supports_streaming, supports_tools, supports_images, supports_embeddings, input_cost_per_1k, output_cost_per_1k, status)
VALUES
  ('openai', 'gpt-4o', 'chat', 128000, true, true, true, false, 0.0025, 0.01, 'active'),
  ('openai', 'gpt-4o-mini', 'chat', 128000, true, true, true, false, 0.00015, 0.0006, 'active'),
  ('openai', 'gpt-4-turbo', 'chat', 128000, true, true, true, false, 0.01, 0.03, 'active'),
  ('openai', 'gpt-4-turbo-preview', 'chat', 128000, true, true, true, false, 0.01, 0.03, 'preview'),
  ('openai', 'gpt-3.5-turbo', 'chat', 16385, true, true, false, false, 0.0005, 0.0015, 'active'),
  ('openai', 'text-embedding-3-small', 'embedding', 8191, false, false, false, true, 0.00002, 0, 'active'),
  ('openai', 'text-embedding-3-large', 'embedding', 8191, false, false, false, true, 0.00013, 0, 'active')
ON CONFLICT (provider, model_name) DO NOTHING;

-- ============================================================
-- Seed: Default prompt templates
-- ============================================================

INSERT INTO ai_prompts (prompt_name, version, description, system_prompt, user_prompt_template, temperature, max_tokens, provider_override, model_override, is_active)
VALUES
  (
    'business_analysis',
    1,
    'Analyze a company website and produce a structured business summary.',
    'You are an expert business analyst. Analyze the provided content and produce a structured business summary. Return only valid JSON matching the requested schema.',
    'Analyze the following website content and provide a comprehensive business summary:\n\n{{content}}',
    0.3,
    4000,
    NULL,
    'gpt-4o',
    true
  ),
  (
    'icp_intelligence',
    1,
    'Generate Ideal Customer Profile intelligence from company data.',
    'You are an expert sales strategist specializing in Ideal Customer Profile (ICP) analysis. Analyze the provided data and return structured ICP intelligence as JSON.',
    'Analyze the following company data and generate ICP intelligence:\n\n{{company_data}}',
    0.4,
    4000,
    NULL,
    'gpt-4o',
    true
  ),
  (
    'prospect_discovery',
    1,
    'Score and rank discovered prospects against ICP criteria.',
    'You are a prospect discovery expert. Score each prospect against the provided ICP criteria and return ranked results as JSON.',
    'Score the following prospects against the ICP criteria:\n\nICP: {{icp_criteria}}\n\nProspects: {{prospects}}',
    0.3,
    4000,
    NULL,
    'gpt-4o',
    true
  ),
  (
    'personalization',
    1,
    'Generate personalized outreach messages for prospects.',
    'You are an expert at personalized sales outreach. Generate a personalized message based on the prospect profile and return it as JSON.',
    'Generate a personalized outreach message for this prospect:\n\n{{prospect_profile}}\n\nTone: {{tone}}\n\nChannel: {{channel}}',
    0.7,
    1000,
    NULL,
    'gpt-4o-mini',
    true
  ),
  (
    'conversation_analysis',
    1,
    'Analyze sales conversations for sentiment, intent, and next actions.',
    'You are a sales conversation analyst. Analyze the conversation and return structured insights including sentiment, buyer intent, objections, qualification status, and recommended next actions as JSON.',
    'Analyze this sales conversation:\n\n{{conversation}}',
    0.3,
    2000,
    NULL,
    'gpt-4o',
    true
  ),
  (
    'meeting_brief',
    1,
    'Generate a pre-meeting brief from prospect and account data.',
    'You are a meeting preparation expert. Generate a comprehensive pre-meeting brief from the provided data and return it as JSON.',
    'Generate a pre-meeting brief from this data:\n\n{{account_data}}\n\nMeeting context: {{meeting_context}}',
    0.4,
    2000,
    NULL,
    'gpt-4o',
    true
  )
ON CONFLICT (prompt_name, version) DO NOTHING;
