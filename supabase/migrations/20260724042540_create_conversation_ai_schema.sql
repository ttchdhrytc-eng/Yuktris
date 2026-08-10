/*
# Create Conversation AI Schema

## Overview
Creates the complete database schema for Conversation AI — the
real-time communication intelligence layer of Revenue AI.

Conversation AI understands conversations, maintains context,
qualifies prospects, detects buying intent changes, recommends or
generates responses, and determines the next best action. It never
executes LinkedIn actions or books meetings — it only manages
conversations and decides when a conversation is ready for the
Meeting Agent.

It runs after the LinkedIn Execution Agent produces replies.

## New Tables (7 total)

1. **conversations** — Main conversation record. Links to workspace,
   contact, and campaign. Tracks status, stage, and meeting readiness.

2. **messages** — Individual messages in a conversation: sender,
   channel, content, timestamp, message_type.

3. **conversation_analysis** — AI analysis per conversation:
   sentiment, buyer_intent, qualification_score, trust_score,
   engagement_score, conversation_score.

4. **objections** — Objections detected per analysis: objection_type,
   severity, recommended_response, confidence.

5. **ai_responses** — AI-generated response recommendations per
   conversation: response_type, response_text, confidence, status.

6. **conversation_summary** — Summary per conversation: summary,
   next_action, meeting_readiness.

## Naming
All tables use the `conversation_` prefix or are scoped to
conversations to avoid conflicts with existing `messages` table.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member().
- Child tables scope through conversations using EXISTS subquery.
- 4 CRUD policies per table — no FOR ALL.
- All policies use TO authenticated.
*/

-- ============================================================
-- 1. conversations (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid,
  campaign_id uuid,
  prospect_name text,
  prospect_title text,
  company_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'escalated', 'handed_off', 'failed')),
  conversation_stage text NOT NULL DEFAULT 'initial_contact' CHECK (conversation_stage IN ('initial_contact', 'connection_accepted', 'first_reply', 'engaged', 'qualified', 'objection_handling', 'meeting_ready', 'handed_off', 'inactive')),
  meeting_ready boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_campaign_id ON conversations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversations" ON conversations;
CREATE POLICY "select_own_conversations" ON conversations FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_conversations" ON conversations;
CREATE POLICY "insert_own_conversations" ON conversations FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_conversations" ON conversations;
CREATE POLICY "update_own_conversations" ON conversations FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_conversations" ON conversations;
CREATE POLICY "delete_own_conversations" ON conversations FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. conversation_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('prospect', 'user', 'ai')),
  channel text NOT NULL DEFAULT 'linkedin' CHECK (channel IN ('linkedin', 'email', 'whatsapp', 'slack', 'manual')),
  content text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'connection_request', 'connection_accepted', 'voice_note', 'video', 'attachment', 'system')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_timestamp ON conversation_messages(timestamp);

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversation_messages" ON conversation_messages;
CREATE POLICY "select_own_conversation_messages" ON conversation_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_messages.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_conversation_messages" ON conversation_messages;
CREATE POLICY "insert_own_conversation_messages" ON conversation_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_messages.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_conversation_messages" ON conversation_messages;
CREATE POLICY "update_own_conversation_messages" ON conversation_messages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_messages.conversation_id AND is_workspace_member(conversations.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_messages.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_conversation_messages" ON conversation_messages;
CREATE POLICY "delete_own_conversation_messages" ON conversation_messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_messages.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

-- ============================================================
-- 3. conversation_analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sentiment text NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
  buyer_intent text NOT NULL DEFAULT 'low' CHECK (buyer_intent IN ('none', 'low', 'medium', 'high', 'very_high')),
  qualification_score integer DEFAULT 0,
  trust_score integer DEFAULT 0,
  engagement_score integer DEFAULT 0,
  conversation_score integer DEFAULT 0,
  urgency text DEFAULT 'low' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  interest_level text DEFAULT 'low' CHECK (interest_level IN ('none', 'low', 'medium', 'high', 'very_high')),
  decision_stage text DEFAULT 'unaware' CHECK (decision_stage IN ('unaware', 'aware', 'interested', 'evaluating', 'deciding', 'committed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_analysis_conversation_id ON conversation_analysis(conversation_id);

ALTER TABLE conversation_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversation_analysis" ON conversation_analysis;
CREATE POLICY "select_own_conversation_analysis" ON conversation_analysis FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_analysis.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_conversation_analysis" ON conversation_analysis;
CREATE POLICY "insert_own_conversation_analysis" ON conversation_analysis FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_analysis.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_conversation_analysis" ON conversation_analysis;
CREATE POLICY "update_own_conversation_analysis" ON conversation_analysis FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_analysis.conversation_id AND is_workspace_member(conversations.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_analysis.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_conversation_analysis" ON conversation_analysis;
CREATE POLICY "delete_own_conversation_analysis" ON conversation_analysis FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_analysis.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

-- ============================================================
-- 4. conversation_objections
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_objections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_analysis_id uuid NOT NULL REFERENCES conversation_analysis(id) ON DELETE CASCADE,
  objection_type text NOT NULL CHECK (objection_type IN ('price', 'timing', 'competition', 'authority', 'need', 'internal_process', 'trust', 'complexity')),
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  recommended_response text,
  confidence integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_objections_analysis_id ON conversation_objections(conversation_analysis_id);

ALTER TABLE conversation_objections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversation_objections" ON conversation_objections;
CREATE POLICY "select_own_conversation_objections" ON conversation_objections FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_analysis ca JOIN conversations c ON c.id = ca.conversation_id WHERE ca.id = conversation_objections.conversation_analysis_id AND is_workspace_member(c.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_conversation_objections" ON conversation_objections;
CREATE POLICY "insert_own_conversation_objections" ON conversation_objections FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM conversation_analysis ca JOIN conversations c ON c.id = ca.conversation_id WHERE ca.id = conversation_objections.conversation_analysis_id AND is_workspace_member(c.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_conversation_objections" ON conversation_objections;
CREATE POLICY "update_own_conversation_objections" ON conversation_objections FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_analysis ca JOIN conversations c ON c.id = ca.conversation_id WHERE ca.id = conversation_objections.conversation_analysis_id AND is_workspace_member(c.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM conversation_analysis ca JOIN conversations c ON c.id = ca.conversation_id WHERE ca.id = conversation_objections.conversation_analysis_id AND is_workspace_member(c.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_conversation_objections" ON conversation_objections;
CREATE POLICY "delete_own_conversation_objections" ON conversation_objections FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversation_analysis ca JOIN conversations c ON c.id = ca.conversation_id WHERE ca.id = conversation_objections.conversation_analysis_id AND is_workspace_member(c.workspace_id))
  );

-- ============================================================
-- 5. conversation_ai_responses
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_ai_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  response_type text NOT NULL CHECK (response_type IN ('recommended', 'alternative', 'followup', 'escalation')),
  response_text text NOT NULL,
  confidence integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'rejected', 'edited')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_ai_responses_conversation_id ON conversation_ai_responses(conversation_id);

ALTER TABLE conversation_ai_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversation_ai_responses" ON conversation_ai_responses;
CREATE POLICY "select_own_conversation_ai_responses" ON conversation_ai_responses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_ai_responses.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_conversation_ai_responses" ON conversation_ai_responses;
CREATE POLICY "insert_own_conversation_ai_responses" ON conversation_ai_responses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_ai_responses.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_conversation_ai_responses" ON conversation_ai_responses;
CREATE POLICY "update_own_conversation_ai_responses" ON conversation_ai_responses FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_ai_responses.conversation_id AND is_workspace_member(conversations.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_ai_responses.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_conversation_ai_responses" ON conversation_ai_responses;
CREATE POLICY "delete_own_conversation_ai_responses" ON conversation_ai_responses FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_ai_responses.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

-- ============================================================
-- 6. conversation_summary
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  summary text,
  next_action text,
  meeting_readiness text NOT NULL DEFAULT 'not_ready' CHECK (meeting_readiness IN ('not_ready', 'warming_up', 'almost_ready', 'ready', 'handed_off')),
  executive_summary text,
  recommended_followup text,
  escalation_suggestion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_summary_conversation_id ON conversation_summary(conversation_id);

ALTER TABLE conversation_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversation_summary" ON conversation_summary;
CREATE POLICY "select_own_conversation_summary" ON conversation_summary FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_summary.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_conversation_summary" ON conversation_summary;
CREATE POLICY "insert_own_conversation_summary" ON conversation_summary FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_summary.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_conversation_summary" ON conversation_summary;
CREATE POLICY "update_own_conversation_summary" ON conversation_summary FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_summary.conversation_id AND is_workspace_member(conversations.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_summary.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_conversation_summary" ON conversation_summary;
CREATE POLICY "delete_own_conversation_summary" ON conversation_summary FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_summary.conversation_id AND is_workspace_member(conversations.workspace_id))
  );

-- ============================================================
-- Trigger: auto-update updated_at on conversations
-- ============================================================

CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conversation_updated_at ON conversations;
CREATE TRIGGER trigger_conversation_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();