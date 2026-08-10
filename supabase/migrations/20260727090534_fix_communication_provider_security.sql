/*
# Fix Communication Provider Security Issues

## Overview
Tightens RLS policies on the communication_providers and
provider_capabilities catalog tables. The previous migration
allowed any authenticated user to INSERT and UPDATE provider
definitions, which the Supabase Security Advisor flags as overly
permissive.

## Changes
1. `communication_providers`:
   - SELECT remains `TO authenticated USING(true)` — all authenticated
     users need to read the provider catalog. This is intentional
     for a shared catalog table.
   - INSERT policy removed — only the service role (used by edge
     functions) can insert new provider definitions. The service role
     bypasses RLS, so no policy is needed.
   - UPDATE policy removed — same reasoning. Provider definitions are
     managed by the system, not by end users.

2. `provider_capabilities`:
   - SELECT remains `TO authenticated USING(true)` — all authenticated
     users need to read the capability matrix. Intentionally shared.
   - No INSERT/UPDATE/DELETE policies were present, so no changes needed.

## Security
- Catalog tables are now read-only for authenticated users.
- Write operations are restricted to the service role (edge functions),
  which bypasses RLS by design.
- This resolves the Security Advisor warnings about permissive
  USING(true) / WITH CHECK(true) policies on writable tables.
*/

-- ============================================================
-- communication_providers: Remove permissive INSERT and UPDATE policies
-- ============================================================

DROP POLICY IF EXISTS "insert_communication_providers" ON communication_providers;
DROP POLICY IF EXISTS "update_communication_providers" ON communication_providers;

-- SELECT policy remains (intentionally shared catalog)
-- Re-create to ensure it's clean
DROP POLICY IF EXISTS "select_communication_providers" ON communication_providers;
CREATE POLICY "select_communication_providers" ON communication_providers
  FOR SELECT TO authenticated USING (true);
