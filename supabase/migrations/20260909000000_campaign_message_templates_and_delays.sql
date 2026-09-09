-- Add message templates and follow-up delays to customer_campaigns
-- Allows customers to review/edit outreach messages and configure timing before activation

ALTER TABLE public.customer_campaigns
  ADD COLUMN IF NOT EXISTS connection_note_template text,
  ADD COLUMN IF NOT EXISTS first_message_template text,
  ADD COLUMN IF NOT EXISTS follow_up_1_template text,
  ADD COLUMN IF NOT EXISTS follow_up_2_template text,
  ADD COLUMN IF NOT EXISTS delay_after_connection_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_after_first_message_hours integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS delay_after_follow_up_1_hours integer NOT NULL DEFAULT 96;

-- Add constraints for reasonable delay bounds
ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_delay_after_connection_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_delay_after_connection_check CHECK (delay_after_connection_hours BETWEEN 0 AND 168);

ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_delay_after_first_message_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_delay_after_first_message_check CHECK (delay_after_first_message_hours BETWEEN 1 AND 720);

ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_delay_after_follow_up_1_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_delay_after_follow_up_1_check CHECK (delay_after_follow_up_1_hours BETWEEN 1 AND 720);

-- Message length constraints matching LinkedIn limits
ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_connection_note_length_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_connection_note_length_check CHECK (connection_note_template IS NULL OR length(connection_note_template) <= 190);

ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_first_message_length_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_first_message_length_check CHECK (first_message_template IS NULL OR length(first_message_template) <= 500);

ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_follow_up_1_length_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_follow_up_1_length_check CHECK (follow_up_1_template IS NULL OR length(follow_up_1_template) <= 400);

ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_follow_up_2_length_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_follow_up_2_length_check CHECK (follow_up_2_template IS NULL OR length(follow_up_2_template) <= 350);