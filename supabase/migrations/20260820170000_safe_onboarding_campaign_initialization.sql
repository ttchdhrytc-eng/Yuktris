ALTER TABLE public.customer_campaigns
  ALTER COLUMN linkedin_account_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_status_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_status_check
  CHECK (status IN ('draft','blocked_prerequisite','ready','running','paused','action_required','completed','failed'));

ALTER TABLE public.customer_campaigns
  ADD CONSTRAINT customer_campaigns_workspace_source_key UNIQUE (workspace_id,source_campaign_id);
