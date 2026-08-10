-- Fix race condition: use a transaction-level advisory lock so slug generation
-- is serialized across concurrent INSERTs within the same transaction boundary.
-- SHARE ROW EXCLUSIVE was insufficient because the lock released when the
-- function returned (before the INSERT committed), allowing two transactions
-- to generate the same slug.

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