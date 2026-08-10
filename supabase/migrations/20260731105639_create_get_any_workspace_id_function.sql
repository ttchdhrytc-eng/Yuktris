/*
# Helper: get any workspace ID for worker registration
#
# The worker needs a workspace_id to register in browser_workers.
# Since the worker may use the anon key, RLS blocks the workspaces table.
# This SECURITY DEFINER function returns the first workspace ID.
*/

CREATE OR REPLACE FUNCTION public.get_any_workspace_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM workspaces LIMIT 1;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_any_workspace_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_any_workspace_id() TO anon, authenticated;