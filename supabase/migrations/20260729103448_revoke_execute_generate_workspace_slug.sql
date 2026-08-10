/*
# Fix: Revoke direct EXECUTE on generate_workspace_slug

The SECURITY DEFINER function generate_workspace_slug is only meant
to be called by the set_workspace_slug BEFORE INSERT trigger on
workspaces. Triggers execute with the function's own privileges, so
no role needs direct EXECUTE grants. Revoke from all roles to prevent
authenticated users from calling it via /rest/v1/rpc/generate_workspace_slug.
*/

REVOKE EXECUTE ON FUNCTION public.generate_workspace_slug(ws_name text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_workspace_slug(ws_name text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_workspace_slug(ws_name text) FROM PUBLIC;
