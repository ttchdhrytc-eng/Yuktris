/* Customer campaign mappings must be able to resolve their workspace-owned canonical contacts. */
DROP POLICY IF EXISTS select_workspace_contacts ON public.contacts;
CREATE POLICY select_workspace_contacts ON public.contacts
FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id));
