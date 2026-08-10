/*
# Fix mutable search_path security warnings on database functions

## Summary
Recreates 18 existing database functions with `SET search_path = public` to resolve
Postgres security warnings about mutable `search_path` in SECURITY DEFINER or trigger functions.
No logic changes — only adds the `SET search_path = public` clause.

## Functions updated (all in public schema):
1. `ensure_single_primary_google_account()` — trigger function, ensures only one primary Google account per workspace
2. `generate_workspace_slug(ws_name text)` — generates a unique workspace slug from a name
3. `update_buying_intent_updated_at()` — trigger, sets updated_at on buying_intent rows
4. `update_company_research_updated_at()` — trigger, sets updated_at on company_research rows
5. `update_conversation_updated_at()` — trigger, sets updated_at on conversation rows
6. `update_dm_research_updated_at()` — trigger, sets updated_at on decision_maker_research rows
7. `update_google_account_updated_at()` — trigger, sets updated_at on google_accounts rows
8. `update_icp_updated_at()` — trigger, sets updated_at on icp_intelligence rows
9. `update_integration_status_updated_at()` — trigger, sets updated_at on integration_status rows
10. `update_linkedin_campaign_updated_at()` — trigger, sets updated_at on linkedin_campaign rows
11. `update_meeting_agent_crm_updated_at()` — trigger, sets updated_at on meeting_agent_crm rows
12. `update_meeting_agent_meeting_updated_at()` — trigger, sets updated_at on meeting_agent_meeting rows
13. `update_oauth_token_updated_at()` — trigger, sets updated_at on oauth_tokens rows
14. `update_outreach_campaign_updated_at()` — trigger, sets updated_at on outreach_campaign rows
15. `update_personalization_updated_at()` — trigger, sets updated_at on personalization rows
16. `update_profile_updated_at()` — trigger, sets updated_at on profiles rows
17. `update_prospect_discovery_updated_at()` — trigger, sets updated_at on prospect_discovery rows
18. `update_sn_search_updated_at()` — trigger, sets updated_at on sales_navigator_search rows
19. `update_updated_at_column()` — trigger, generic updated_at setter

## Security
- Each function gets `SET search_path = public` to prevent search_path injection attacks.
- No RLS changes. No data changes. Purely a security hardening migration.
*/

-- Trigger function: ensure_single_primary_google_account
CREATE OR REPLACE FUNCTION public.ensure_single_primary_google_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
IF NEW.is_primary THEN
UPDATE google_accounts SET is_primary = false
WHERE workspace_id = NEW.workspace_id AND id != NEW.id;
END IF;
RETURN NEW;
END;
$function$;

-- Function: generate_workspace_slug
CREATE OR REPLACE FUNCTION public.generate_workspace_slug(ws_name text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
base_slug text;
candidate_slug text;
counter integer := 0;
BEGIN
base_slug := lower(regexp_replace(ws_name, '[^a-zA-Z0-9]+', '-', 'g'));
base_slug := trim(both '-' from base_slug);
base_slug := CASE WHEN base_slug = '' THEN 'workspace' ELSE base_slug END;
LOOP
candidate_slug := CASE WHEN counter = 0 THEN base_slug ELSE base_slug || '-' || counter END;
EXIT WHEN NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.slug = candidate_slug);
counter := counter + 1;
END LOOP;
RETURN candidate_slug;
END;
$function$;

-- Trigger function: update_buying_intent_updated_at
CREATE OR REPLACE FUNCTION public.update_buying_intent_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_company_research_updated_at
CREATE OR REPLACE FUNCTION public.update_company_research_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_conversation_updated_at
CREATE OR REPLACE FUNCTION public.update_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_dm_research_updated_at
CREATE OR REPLACE FUNCTION public.update_dm_research_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_google_account_updated_at
CREATE OR REPLACE FUNCTION public.update_google_account_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_icp_updated_at
CREATE OR REPLACE FUNCTION public.update_icp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_integration_status_updated_at
CREATE OR REPLACE FUNCTION public.update_integration_status_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_linkedin_campaign_updated_at
CREATE OR REPLACE FUNCTION public.update_linkedin_campaign_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_meeting_agent_crm_updated_at
CREATE OR REPLACE FUNCTION public.update_meeting_agent_crm_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_meeting_agent_meeting_updated_at
CREATE OR REPLACE FUNCTION public.update_meeting_agent_meeting_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_oauth_token_updated_at
CREATE OR REPLACE FUNCTION public.update_oauth_token_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_outreach_campaign_updated_at
CREATE OR REPLACE FUNCTION public.update_outreach_campaign_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_personalization_updated_at
CREATE OR REPLACE FUNCTION public.update_personalization_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_profile_updated_at
CREATE OR REPLACE FUNCTION public.update_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_prospect_discovery_updated_at
CREATE OR REPLACE FUNCTION public.update_prospect_discovery_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_sn_search_updated_at
CREATE OR REPLACE FUNCTION public.update_sn_search_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Trigger function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;
