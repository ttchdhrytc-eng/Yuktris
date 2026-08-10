/*
# Fix Security Advisor Issues for Launch Candidate (LC1)

## Summary
This migration resolves three categories of security vulnerabilities:

1. **Function Search Path Mutable** — `public.set_updated_at` has a mutable `search_path`. Fixed by setting an immutable `search_path`.

2. **RLS Policy Always True** — Three integration tables have write policies with `USING (true)` / `WITH CHECK (true)`:
   - `integration_marketplace` — global catalog, no workspace_id. INSERT/UPDATE/DELETE policies dropped entirely so only service_role can manage the catalog.
   - `integration_providers` — global catalog, no workspace_id. Same treatment.
   - `integration_templates` — has workspace_id. Policies replaced with proper workspace-ownership checks via `is_workspace_member()`.

3. **Public/Authenticated Can Execute SECURITY DEFINER Functions** — 16 SECURITY DEFINER functions are executable by anon/authenticated via REST. EXECUTE revoked from PUBLIC, anon, and authenticated. Trigger firing is unaffected.

## Tables Modified
- `integration_marketplace` — INSERT/UPDATE/DELETE policies dropped (catalog is read-only for authenticated)
- `integration_providers` — INSERT/UPDATE/DELETE policies dropped (catalog is read-only for authenticated)
- `integration_templates` — write policies replaced with workspace-ownership checks

## Functions Modified
- `public.set_updated_at` — search_path set to `pg_catalog, public`
- 16 SECURITY DEFINER functions — EXECUTE revoked from PUBLIC/anon/authenticated

## Important Notes
1. `integration_marketplace` and `integration_providers` are global reference catalogs (like an app store). Authenticated users can SELECT but cannot INSERT/UPDATE/DELETE. Only service_role (used by edge functions) can manage catalog entries.
2. `integration_templates` is workspace-scoped and uses `is_workspace_member(workspace_id)` for ownership checks.
3. Revoking EXECUTE on trigger functions does NOT affect trigger firing — triggers run with the function's own privileges.
*/

-- ============================================================
-- 1. Fix mutable search_path on set_updated_at
-- ============================================================
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;

-- ============================================================
-- 2a. Fix RLS on integration_marketplace (global catalog)
-- Drop write policies — only service_role can manage catalog
-- ============================================================
DROP POLICY IF EXISTS "delete_integration_marketplace" ON public.integration_marketplace;
DROP POLICY IF EXISTS "insert_integration_marketplace" ON public.integration_marketplace;
DROP POLICY IF EXISTS "update_integration_marketplace" ON public.integration_marketplace;

-- ============================================================
-- 2b. Fix RLS on integration_providers (global catalog)
-- Drop write policies — only service_role can manage catalog
-- ============================================================
DROP POLICY IF EXISTS "delete_integration_providers" ON public.integration_providers;
DROP POLICY IF EXISTS "insert_integration_providers" ON public.integration_providers;
DROP POLICY IF EXISTS "update_integration_providers" ON public.integration_providers;

-- ============================================================
-- 2c. Fix RLS on integration_templates (workspace-scoped)
-- Replace always-true policies with workspace ownership checks
-- ============================================================
DROP POLICY IF EXISTS "delete_integration_templates" ON public.integration_templates;
DROP POLICY IF EXISTS "insert_integration_templates" ON public.integration_templates;
DROP POLICY IF EXISTS "update_integration_templates" ON public.integration_templates;

CREATE POLICY "insert_integration_templates" ON public.integration_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "update_integration_templates" ON public.integration_templates
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "delete_integration_templates" ON public.integration_templates
  FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- 3. Revoke EXECUTE on all SECURITY DEFINER functions from
--    PUBLIC, anon, and authenticated roles
-- These are internal trigger/utility functions that should
-- never be called directly via the REST API.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.set_workspace_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_agent_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_ceo_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_ci_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_cs_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_fin_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_integration_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_li_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_market_opportunity_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_mi_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_oi_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_pd_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_pi_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_revenue_dna_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_revenue_strategy_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_rf_updated_at() FROM PUBLIC, anon, authenticated;