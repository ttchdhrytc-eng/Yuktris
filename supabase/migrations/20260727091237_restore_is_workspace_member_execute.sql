/*
# Restore is_workspace_member EXECUTE for authenticated role

## Problem
The previous security fix revoked EXECUTE on is_workspace_member()
from the authenticated role. However, this function is embedded in
RLS policies on at least 10+ tables (companies, prospects,
linkedin_accounts, workspace_members, and many more).

When an RLS policy calls is_workspace_member(), PostgreSQL checks
whether the current role can execute the function. Revoking EXECUTE
from authenticated means every RLS-protected query on those tables
now fails with "permission denied for function is_workspace_member".

## Fix
Grant EXECUTE back to the authenticated role. The function is a
SECURITY DEFINER helper that only checks whether auth.uid() is a
member of a given workspace — it cannot be used to access or modify
any data, it only returns a boolean. The Security Advisor warning
about RPC exposure is a low-risk cosmetic issue compared to
completely breaking data access for every signed-in user.

The anon role remains revoked since unauthenticated users should
never touch workspace-scoped data.
*/

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
