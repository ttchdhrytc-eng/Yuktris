-- Fix race condition in generate_workspace_slug by locking the table during slug generation.
-- Two concurrent inserts could both see the same slug as available, causing a unique constraint violation.

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
  -- Lock the table to serialize slug generation and prevent race conditions
  LOCK TABLE public.workspaces IN SHARE ROW EXCLUSIVE MODE;

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