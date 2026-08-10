/*
# Phase 9 — Conversation Intelligence Engine Schema

## Strategy
- Extend existing `conversations` and `conversation_messages` tables
- Create 9 new tables for conversation intelligence
*/

-- ============================================================
-- EXTEND conversations TABLE
-- ============================================================
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS buying_stage text DEFAULT 'cold' CHECK (buying_stage IN (
  'cold', 'aware', 'interested', 'evaluating', 'decision', 'negotiation',
  'meeting_scheduled', 'proposal_sent', 'closed_won', 'closed_lost'
));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS meeting_readiness_level text DEFAULT 'not_ready' CHECK (meeting_readiness_level IN (
  'not_ready', 'warming_up', 'almost_ready', 'ready', 'handed_off'
));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS overall_confidence numeric DEFAULT 0.5;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_analyzed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_conversations_company ON conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buying_stage ON conversations(buying_stage);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- ============================================================
-- EXTEND conversation_messages TABLE
-- ============================================================
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS read_status boolean DEFAULT false;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivered_status boolean DEFAULT false;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS reaction jsonb;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_conv_messages_workspace ON conversation_messages(workspace_id);

-- ============================================================
-- CONVERSATION THREADS (grouping messages by thread)
-- ============================================================
CREATE TABLE conversation_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  thread_subject text,
  thread_status text DEFAULT 'active' CHECK (thread_status IN ('active', 'paused', 'closed', 'escalated')),
  message_count integer DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_threads_workspace ON conversation_threads(workspace_id);
CREATE INDEX idx_conv_threads_conversation ON conversation_threads(conversation_id);
CREATE INDEX idx_conv_threads_contact ON conversation_threads(contact_id);

ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_threads" ON conversation_threads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_threads.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_threads" ON conversation_threads FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_threads.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_threads" ON conversation_threads FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_threads.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_threads.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_threads" ON conversation_threads FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_threads.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONVERSATION INTENTS
-- ============================================================
CREATE TABLE conversation_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES conversation_messages(id) ON DELETE SET NULL,
  primary_intent text NOT NULL CHECK (primary_intent IN (
    'positive_interest', 'negative_interest', 'question', 'objection',
    'pricing_request', 'demo_request', 'meeting_request', 'referral',
    'need_more_info', 'competitor_mention', 'budget_concern', 'authority_concern',
    'timing_concern', 'security_concern', 'compliance_concern',
    'no_interest', 'not_decision_maker', 'follow_up_later', 'spam', 'unknown'
  )),
  secondary_intent text CHECK (secondary_intent IN (
    'positive_interest', 'negative_interest', 'question', 'objection',
    'pricing_request', 'demo_request', 'meeting_request', 'referral',
    'need_more_info', 'competitor_mention', 'budget_concern', 'authority_concern',
    'timing_concern', 'security_concern', 'compliance_concern',
    'no_interest', 'not_decision_maker', 'follow_up_later', 'spam', 'unknown'
  )),
  conversation_goal text,
  urgency text DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  likelihood_to_buy numeric DEFAULT 0.3,
  meeting_likelihood numeric DEFAULT 0.2,
  revenue_opportunity text,
  confidence numeric DEFAULT 0.5,
  reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_intents_workspace ON conversation_intents(workspace_id);
CREATE INDEX idx_conv_intents_conversation ON conversation_intents(conversation_id);

ALTER TABLE conversation_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_intents" ON conversation_intents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_intents.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_intents" ON conversation_intents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_intents.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_intents" ON conversation_intents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_intents.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_intents.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_intents" ON conversation_intents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_intents.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONVERSATION BUYING STAGE
-- ============================================================
CREATE TABLE conversation_buying_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  buying_stage text NOT NULL CHECK (buying_stage IN (
    'cold', 'aware', 'interested', 'evaluating', 'decision', 'negotiation',
    'meeting_scheduled', 'proposal_sent', 'closed_won', 'closed_lost'
  )),
  previous_stage text,
  stage_reason text NOT NULL,
  stage_signals jsonb DEFAULT '[]'::jsonb,
  confidence numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_buying_stage_workspace ON conversation_buying_stage(workspace_id);
CREATE INDEX idx_conv_buying_stage_conversation ON conversation_buying_stage(conversation_id);

ALTER TABLE conversation_buying_stage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_buying_stage" ON conversation_buying_stage FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_buying_stage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_buying_stage" ON conversation_buying_stage FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_buying_stage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_buying_stage" ON conversation_buying_stage FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_buying_stage.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_buying_stage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_buying_stage" ON conversation_buying_stage FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_buying_stage.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONVERSATION RECOMMENDATIONS
-- ============================================================
CREATE TABLE conversation_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  recommended_action text NOT NULL CHECK (recommended_action IN (
    'reply_now', 'wait', 'book_meeting', 'send_proposal', 'send_case_study',
    'send_roi_calculator', 'escalate_to_sales', 'escalate_to_founder',
    'escalate_to_support', 'disqualify', 'nurture', 'no_action'
  )),
  action_reason text NOT NULL,
  action_priority text DEFAULT 'medium' CHECK (action_priority IN ('low', 'medium', 'high', 'critical')),
  confidence numeric DEFAULT 0.5,
  reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_recs_workspace ON conversation_recommendations(workspace_id);
CREATE INDEX idx_conv_recs_conversation ON conversation_recommendations(conversation_id);

ALTER TABLE conversation_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_recs" ON conversation_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_recs" ON conversation_recommendations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_recs" ON conversation_recommendations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_recommendations.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_recs" ON conversation_recommendations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_recommendations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONVERSATION REPLY LIBRARY
-- ============================================================
CREATE TABLE conversation_reply_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  reply_type text NOT NULL CHECK (reply_type IN (
    'suggested_reply', 'alternative_reply', 'short_reply', 'long_reply',
    'friendly_tone', 'professional_tone', 'founder_tone', 'enterprise_tone',
    'cta', 'follow_up_strategy'
  )),
  reply_text text NOT NULL,
  cta text,
  confidence numeric DEFAULT 0.5,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'rejected', 'edited')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_reply_lib_workspace ON conversation_reply_library(workspace_id);
CREATE INDEX idx_conv_reply_lib_conversation ON conversation_reply_library(conversation_id);

ALTER TABLE conversation_reply_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_reply_lib" ON conversation_reply_library FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_reply_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_reply_lib" ON conversation_reply_library FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_reply_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_reply_lib" ON conversation_reply_library FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_reply_library.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_reply_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_reply_lib" ON conversation_reply_library FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_reply_library.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONVERSATION EVENTS (ingestion pipeline events)
-- ============================================================
CREATE TABLE conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES conversation_messages(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'message_received', 'message_sent', 'message_read', 'message_delivered',
    'message_edited', 'message_deleted', 'reaction_added', 'reaction_removed',
    'attachment_received', 'voice_note_received', 'image_received', 'link_detected'
  )),
  event_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_events_workspace ON conversation_events(workspace_id);
CREATE INDEX idx_conv_events_conversation ON conversation_events(conversation_id);
CREATE INDEX idx_conv_events_created ON conversation_events(created_at DESC);

ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_events" ON conversation_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_events" ON conversation_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_events" ON conversation_events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_events.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_events" ON conversation_events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_events.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONVERSATION LABELS
-- ============================================================
CREATE TABLE conversation_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label IN (
    'hot_lead', 'warm_lead', 'cold_lead', 'objection', 'meeting_ready',
    'pricing_discussion', 'competitor_mentioned', 'decision_maker',
    'champion', 'detractor', 'escalated', 'nurture', 'disqualified',
    'high_priority', 'urgent_reply_needed', 'human_escalation'
  )),
  label_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, label)
);

CREATE INDEX idx_conv_labels_workspace ON conversation_labels(workspace_id);
CREATE INDEX idx_conv_labels_conversation ON conversation_labels(conversation_id);

ALTER TABLE conversation_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_labels" ON conversation_labels FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_labels.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_labels" ON conversation_labels FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_labels.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_labels" ON conversation_labels FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_labels.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_labels.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_labels" ON conversation_labels FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_labels.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONVERSATION SCORE
-- ============================================================
CREATE TABLE conversation_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  intent_score integer DEFAULT 0,
  sentiment_score integer DEFAULT 0,
  engagement_score integer DEFAULT 0,
  buying_stage_score integer DEFAULT 0,
  meeting_readiness_score integer DEFAULT 0,
  risk_score integer DEFAULT 0,
  overall_score integer DEFAULT 0,
  score_explanation jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_score_workspace ON conversation_score(workspace_id);
CREATE INDEX idx_conv_score_conversation ON conversation_score(conversation_id);
CREATE INDEX idx_conv_score_overall ON conversation_score(overall_score DESC);

ALTER TABLE conversation_score ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_score" ON conversation_score FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_score" ON conversation_score FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_score" ON conversation_score FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_score.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_score" ON conversation_score FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_score.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONVERSATION CONTEXT (retrieved knowledge per conversation)
-- ============================================================
CREATE TABLE conversation_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  context_type text NOT NULL CHECK (context_type IN (
    'revenue_dna', 'market_intelligence', 'knowledge_graph', 'memory',
    'campaign_strategy', 'value_proposition', 'case_study', 'trust_signal',
    'competitor_intelligence', 'personalization', 'icp_intelligence'
  )),
  context_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  relevance_score numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_context_workspace ON conversation_context(workspace_id);
CREATE INDEX idx_conv_context_conversation ON conversation_context(conversation_id);
CREATE INDEX idx_conv_context_type ON conversation_context(context_type);

ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_conv_context" ON conversation_context FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_context.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_conv_context" ON conversation_context FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_context.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_conv_context" ON conversation_context FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_context.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_context.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_conv_context" ON conversation_context FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversation_context.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_ci_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_conv_threads_ci_updated_at ON conversation_threads;
CREATE TRIGGER trigger_conv_threads_ci_updated_at BEFORE UPDATE ON conversation_threads FOR EACH ROW EXECUTE FUNCTION update_ci_updated_at();
