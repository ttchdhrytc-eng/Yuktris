/* Canonical customer-campaign identity mapping. No execution jobs are created here. */
CREATE OR REPLACE FUNCTION public.normalize_linkedin_profile_url(p_url text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE
    WHEN lower(split_part(regexp_replace(trim(p_url), '^https?://', '', 'i'), '/', 1)) IN ('linkedin.com','www.linkedin.com')
      AND split_part(regexp_replace(trim(p_url), '^https?://', '', 'i'), '/', 2) = 'in'
      AND nullif(split_part(regexp_replace(trim(p_url), '^https?://', '', 'i'), '/', 3), '') IS NOT NULL
    THEN 'https://www.linkedin.com/in/' || lower(split_part(regexp_replace(trim(p_url), '^https?://', '', 'i'), '/', 3))
    ELSE NULL
  END
$$;

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS source_prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS normalized_linkedin_url text GENERATED ALWAYS AS (public.normalize_linkedin_profile_url(linkedin_url)) STORED;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS normalized_linkedin_url text GENERATED ALWAYS AS (public.normalize_linkedin_profile_url(linkedin_url)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_workspace_linkedin_identity_uq
  ON public.contacts(workspace_id, normalized_linkedin_url) WHERE normalized_linkedin_url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS prospects_workspace_linkedin_identity_uq
  ON public.prospects(workspace_id, normalized_linkedin_url) WHERE normalized_linkedin_url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_source_prospect_uq
  ON public.contacts(source_prospect_id) WHERE source_prospect_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_campaign_id uuid NOT NULL REFERENCES public.customer_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('campaign_discovery','existing_workspace_prospect')),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contact_id IS NOT NULL OR prospect_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_campaign_contacts_contact_uq
  ON public.customer_campaign_contacts(customer_campaign_id, contact_id) WHERE contact_id IS NOT NULL;
ALTER TABLE public.customer_campaign_contacts
  ADD CONSTRAINT customer_campaign_contacts_campaign_prospect_uq UNIQUE (customer_campaign_id, prospect_id);
CREATE INDEX IF NOT EXISTS customer_campaign_contacts_workspace_campaign_idx
  ON public.customer_campaign_contacts(workspace_id, customer_campaign_id);

ALTER TABLE public.customer_campaign_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_campaign_contacts_workspace_select ON public.customer_campaign_contacts FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
REVOKE INSERT, UPDATE, DELETE ON public.customer_campaign_contacts FROM anon, authenticated;
GRANT SELECT ON public.customer_campaign_contacts TO authenticated;
GRANT ALL ON public.customer_campaign_contacts TO service_role;

INSERT INTO public.customer_campaign_contacts(workspace_id, customer_campaign_id, contact_id, source, discovered_at)
SELECT DISTINCT ON (j.workspace_id, (j.action_payload->>'source_campaign_id')::uuid, j.contact_id)
  j.workspace_id, (j.action_payload->>'source_campaign_id')::uuid, j.contact_id, 'campaign_discovery', j.created_at
FROM public.linkedin_execution_jobs j
JOIN public.customer_campaigns cc ON cc.id=(j.action_payload->>'source_campaign_id')::uuid AND cc.workspace_id=j.workspace_id
WHERE j.contact_id IS NOT NULL AND j.action_payload->>'source_campaign_id' IS NOT NULL
ON CONFLICT DO NOTHING;
