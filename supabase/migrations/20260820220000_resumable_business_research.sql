ALTER TABLE public.research_requests
  ADD COLUMN IF NOT EXISTS business_analysis_id uuid REFERENCES public.business_analysis(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_research_requests_business_analysis
  ON public.research_requests(business_analysis_id)
  WHERE business_analysis_id IS NOT NULL;

ALTER TABLE public.business_analysis
  ADD COLUMN IF NOT EXISTS research_request_id uuid REFERENCES public.research_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_analysis_research_request
  ON public.business_analysis(research_request_id)
  WHERE research_request_id IS NOT NULL;

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS onboarding_stage text NOT NULL DEFAULT 'linkedin';
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_onboarding_stage_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_onboarding_stage_check CHECK (onboarding_stage IN (
  'linkedin','business_input','business_research','business_ready','icp_generating','icp_ready','ai_review','setup_ready','completed'
));

ALTER TABLE public.customer_campaigns DROP CONSTRAINT IF EXISTS customer_campaigns_status_check;
ALTER TABLE public.customer_campaigns ADD CONSTRAINT customer_campaigns_status_check CHECK (status IN (
  'draft','initializing','blocked_prerequisite','ready','running','paused','action_required','completed','failed'
));
