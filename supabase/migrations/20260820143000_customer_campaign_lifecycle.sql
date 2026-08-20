CREATE TABLE IF NOT EXISTS public.customer_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  icp jsonb NOT NULL DEFAULT '{}'::jsonb,
  linkedin_account_id uuid NOT NULL REFERENCES public.linkedin_accounts(id),
  strategy text,
  daily_limit integer NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 1 AND 20),
  operating_days text,
  operating_hours text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','running','paused','action_required','completed','failed')),
  status_reason text,
  launched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_campaigns_workspace_status ON public.customer_campaigns(workspace_id,status);
ALTER TABLE public.customer_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_campaigns_select ON public.customer_campaigns FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
REVOKE INSERT,UPDATE,DELETE ON public.customer_campaigns FROM anon,authenticated;
GRANT SELECT ON public.customer_campaigns TO authenticated;
GRANT ALL ON public.customer_campaigns TO service_role;
