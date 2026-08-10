-- Auto-generate workspace slug on INSERT when not provided.
-- The generate_workspace_slug() function already exists; this adds the missing trigger.

CREATE OR REPLACE FUNCTION public.set_workspace_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_workspace_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_workspaces_set_slug ON public.workspaces;
CREATE TRIGGER trg_workspaces_set_slug
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_slug();
