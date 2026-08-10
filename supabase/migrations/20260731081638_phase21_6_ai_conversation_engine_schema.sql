/*
# Phase 21.6 — AI Conversation Engine Schema

Creates 10 tables for LinkedIn conversation tracking, AI intent detection,
memory, summaries, follow-ups, objections, reasoning, and confidence.
All tables prefixed with linkedin_ to avoid conflicts with pre-existing
conversation_intents and conversation_objections tables from earlier phases.
*/

CREATE TABLE IF NOT EXISTS linkedin_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  prospect_name text NOT NULL,
  prospect_profile_url text,
  prospect_headline text,
  prospect_company text,
  prospect_title text,
  conversation_urn text,
  stage text NOT NULL DEFAULT 'initial',
  health text NOT NULL DEFAULT 'active',
  last_message_at timestamptz,
  last_message_preview text,
  last_message_direction text,
  unread_count int NOT NULL DEFAULT 0,
  total_messages int NOT NULL DEFAULT 0,
  ai_enabled boolean NOT NULL DEFAULT true,
  auto_reply_enabled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_linkedin_conversations" ON linkedin_conversations;
CREATE POLICY "select_own_linkedin_conversations" ON linkedin_conversations FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_linkedin_conversations" ON linkedin_conversations;
CREATE POLICY "insert_own_linkedin_conversations" ON linkedin_conversations FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_linkedin_conversations" ON linkedin_conversations;
CREATE POLICY "update_own_linkedin_conversations" ON linkedin_conversations FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_linkedin_conversations" ON linkedin_conversations;
CREATE POLICY "delete_own_linkedin_conversations" ON linkedin_conversations FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  direction text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  body text NOT NULL,
  sender_name text,
  sender_profile_url text,
  linkedin_message_urn text,
  ai_generated boolean NOT NULL DEFAULT false,
  ai_confidence numeric,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  read_at timestamptz,
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_linkedin_messages" ON linkedin_messages;
CREATE POLICY "select_own_linkedin_messages" ON linkedin_messages FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_linkedin_messages" ON linkedin_messages;
CREATE POLICY "insert_own_linkedin_messages" ON linkedin_messages FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_linkedin_messages" ON linkedin_messages;
CREATE POLICY "update_own_linkedin_messages" ON linkedin_messages FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_linkedin_messages" ON linkedin_messages;
CREATE POLICY "delete_own_linkedin_messages" ON linkedin_messages FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_conversation_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES linkedin_messages(id) ON DELETE SET NULL,
  detected_intent text NOT NULL,
  intent_category text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.5,
  buying_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversation_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_conversation_intents" ON linkedin_conversation_intents;
CREATE POLICY "select_own_li_conversation_intents" ON linkedin_conversation_intents FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_conversation_intents" ON linkedin_conversation_intents;
CREATE POLICY "insert_own_li_conversation_intents" ON linkedin_conversation_intents FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_conversation_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  memory_key text NOT NULL,
  memory_value text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.5,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversation_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_conversation_memory" ON linkedin_conversation_memory;
CREATE POLICY "select_own_li_conversation_memory" ON linkedin_conversation_memory FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_conversation_memory" ON linkedin_conversation_memory;
CREATE POLICY "insert_own_li_conversation_memory" ON linkedin_conversation_memory FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_conversation_memory" ON linkedin_conversation_memory;
CREATE POLICY "update_own_li_conversation_memory" ON linkedin_conversation_memory FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_li_conversation_memory" ON linkedin_conversation_memory;
CREATE POLICY "delete_own_li_conversation_memory" ON linkedin_conversation_memory FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  summary text NOT NULL,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  sentiment text,
  stage_assessment text,
  message_count int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversation_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_conversation_summaries" ON linkedin_conversation_summaries;
CREATE POLICY "select_own_li_conversation_summaries" ON linkedin_conversation_summaries FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_conversation_summaries" ON linkedin_conversation_summaries;
CREATE POLICY "insert_own_li_conversation_summaries" ON linkedin_conversation_summaries FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_conversation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES linkedin_messages(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  executed_at timestamptz,
  result jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversation_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_conversation_actions" ON linkedin_conversation_actions;
CREATE POLICY "select_own_li_conversation_actions" ON linkedin_conversation_actions FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_conversation_actions" ON linkedin_conversation_actions;
CREATE POLICY "insert_own_li_conversation_actions" ON linkedin_conversation_actions FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_conversation_actions" ON linkedin_conversation_actions;
CREATE POLICY "update_own_li_conversation_actions" ON linkedin_conversation_actions FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_conversation_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  followup_type text NOT NULL,
  message_draft text,
  status text NOT NULL DEFAULT 'scheduled',
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversation_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_conversation_followups" ON linkedin_conversation_followups;
CREATE POLICY "select_own_li_conversation_followups" ON linkedin_conversation_followups FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_conversation_followups" ON linkedin_conversation_followups;
CREATE POLICY "insert_own_li_conversation_followups" ON linkedin_conversation_followups FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_conversation_followups" ON linkedin_conversation_followups;
CREATE POLICY "update_own_li_conversation_followups" ON linkedin_conversation_followups FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_li_conversation_followups" ON linkedin_conversation_followups;
CREATE POLICY "delete_own_li_conversation_followups" ON linkedin_conversation_followups FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_conversation_objections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES linkedin_messages(id) ON DELETE SET NULL,
  objection_type text NOT NULL,
  objection_text text NOT NULL,
  handling_status text NOT NULL DEFAULT 'unaddressed',
  handling_strategy text,
  handling_response text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversation_objections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_conversation_objections" ON linkedin_conversation_objections;
CREATE POLICY "select_own_li_conversation_objections" ON linkedin_conversation_objections FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_conversation_objections" ON linkedin_conversation_objections;
CREATE POLICY "insert_own_li_conversation_objections" ON linkedin_conversation_objections FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_conversation_objections" ON linkedin_conversation_objections;
CREATE POLICY "update_own_li_conversation_objections" ON linkedin_conversation_objections FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_conversation_ai_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES linkedin_messages(id) ON DELETE SET NULL,
  reasoning_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  intent_analysis text,
  sentiment_analysis text,
  stage_assessment text,
  memory_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_reply text,
  reply_strategy text,
  model_used text,
  tokens_used int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversation_ai_reasoning ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_conversation_ai_reasoning" ON linkedin_conversation_ai_reasoning;
CREATE POLICY "select_own_li_conversation_ai_reasoning" ON linkedin_conversation_ai_reasoning FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_conversation_ai_reasoning" ON linkedin_conversation_ai_reasoning;
CREATE POLICY "insert_own_li_conversation_ai_reasoning" ON linkedin_conversation_ai_reasoning FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_conversation_confidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES linkedin_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES linkedin_messages(id) ON DELETE SET NULL,
  intent_confidence numeric,
  sentiment_confidence numeric,
  reply_confidence numeric,
  action_confidence numeric,
  overall_confidence numeric NOT NULL DEFAULT 0.5,
  factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_conversation_confidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_conversation_confidence" ON linkedin_conversation_confidence;
CREATE POLICY "select_own_li_conversation_confidence" ON linkedin_conversation_confidence FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_conversation_confidence" ON linkedin_conversation_confidence;
CREATE POLICY "insert_own_li_conversation_confidence" ON linkedin_conversation_confidence FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));

CREATE INDEX IF NOT EXISTS idx_linkedin_conversations_workspace ON linkedin_conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_conversations_account ON linkedin_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_messages_conversation ON linkedin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_li_conversation_intents_conversation ON linkedin_conversation_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_li_conversation_memory_conversation ON linkedin_conversation_memory(conversation_id);
CREATE INDEX IF NOT EXISTS idx_li_conversation_followups_scheduled ON linkedin_conversation_followups(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_li_conversation_objections_conversation ON linkedin_conversation_objections(conversation_id);
CREATE INDEX IF NOT EXISTS idx_li_conversation_ai_reasoning_conversation ON linkedin_conversation_ai_reasoning(conversation_id);

DROP TRIGGER IF EXISTS trg_linkedin_conversations_updated_at ON linkedin_conversations;
CREATE TRIGGER trg_linkedin_conversations_updated_at BEFORE UPDATE ON linkedin_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_li_conversation_memory_updated_at ON linkedin_conversation_memory;
CREATE TRIGGER trg_li_conversation_memory_updated_at BEFORE UPDATE ON linkedin_conversation_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_li_conversation_objections_updated_at ON linkedin_conversation_objections;
CREATE TRIGGER trg_li_conversation_objections_updated_at BEFORE UPDATE ON linkedin_conversation_objections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
