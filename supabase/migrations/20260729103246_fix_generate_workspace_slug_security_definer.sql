/*
# Fix generate_workspace_slug SECURITY INVOKER causing duplicate slugs

## Root Cause
`generate_workspace_slug()` is SECURITY INVOKER. When it checks
`SELECT 1 FROM workspaces WHERE slug = candidate_slug`, RLS filters
out other users' workspaces. So it can't see existing slugs and may
generate a duplicate, causing a unique constraint violation on INSERT.
This silently fails the workspace creation during onboarding, leaving
the "Create Workspace" button spinning forever.

## Fix
1. Make `generate_workspace_slug()` SECURITY DEFINER so it can see all
   workspace slugs and properly generate unique ones. The function only
   reads the `slug` column — no sensitive data is exposed.
2. Lock search_path to prevent injection.
3. Revoke EXECUTE from anon/PUBLIC so unauthenticated users can't call it.
4. Grant EXECUTE to authenticated (needed for the trigger).
*/

CREATE OR REPLACE FUNCTION public.generate_workspace_slug(ws_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  base_slug text;
  candidate_slug text;
  counter integer := 0;
BEGIN
  -- Transaction-level advisory lock: held until COMMIT/ROLLBACK, so concurrent
  -- inserts in separate transactions serialize properly.
  PERFORM pg_advisory_xact_lock(987654321);

  base_slug := lower(regexp_replace(ws_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := CASE WHEN base_slug = '' THEN 'workspace' ELSE base_slug END;
  LOOP
    candidate_slug := CASE WHEN counter = 0 THEN base_slug ELSE base_slug || '-' || counter END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.slug = candidate_slug);
    counter := counter + 1;
  END LOOP;
  RETURN candidate_slug;
END;
$function$;

-- Revoke public access, grant to authenticated only
REVOKE EXECUTE ON FUNCTION public.generate_workspace_slug(ws_name text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_workspace_slug(ws_name text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_workspace_slug(ws_name text) TO authenticated;
