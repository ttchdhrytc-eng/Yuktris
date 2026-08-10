/*
# Fix Security Advisor Issues: Mutable Search Path + SECURITY DEFINER

## Summary
Fixes four security advisor findings:
1. `public.trigger_set_updated_at()` — role-mutable search_path (no `SET search_path` on function)
2. `public.update_updated_at()` — role-mutable search_path (no `SET search_path` on function)
3. `public.update_browser_timestamp()` — `SECURITY DEFINER` executable by `anon` and `authenticated` roles via REST RPC
4. `public.update_browser_timestamp()` — role-mutable search_path

## Changes
- Re-create `trigger_set_updated_at()` with `SET search_path TO 'public'` (immutable search path)
- Re-create `update_updated_at()` with `SET search_path TO 'public'` (immutable search path)
- Re-create `update_browser_timestamp()` as `SECURITY INVOKER` (was `SECURITY DEFINER`) with `SET search_path TO 'public'`

## Security Impact
- Functions with `SET search_path TO 'public'` are immune to search_path hijacking where a malicious user could create a hostile object in a schema earlier in the search path.
- `update_browser_timestamp()` is a simple trigger function that sets `NEW.updated_at = now()`. It does not need elevated privileges. Switching to `SECURITY INVOKER` means it runs with the caller's privileges, which is the correct behavior for a trigger function. This removes the ability for `anon` and `authenticated` roles to execute a `SECURITY DEFINER` function via `/rest/v1/rpc/update_browser_timestamp`.

## Notes
- These are trigger functions called automatically by PostgreSQL when rows are inserted/updated. They are NOT called directly by application code via REST RPC.
- The `SET search_path TO 'public'` clause locks the function's search_path at creation time, preventing runtime manipulation.
- All existing triggers that reference these functions continue to work unchanged — `CREATE OR REPLACE` preserves the function OID and all trigger bindings.
*/