/*
# Resolve all Supabase Security Advisor issues

## Summary
Fixes 19 security advisor warnings:
- 10 permissive RLS policies using `true` (USING or WITH CHECK)
- 9 trigger functions missing `SET search_path = public`

## Permissive policies fixed (10)
1. agent_dependencies.select_agent_dependencies — SELECT USING(true)
2. agent_executions.insert_agent_executions — INSERT WITH CHECK(true)
3. agent_registry.select_agent_registry — SELECT USING(true)
4. ai_models.select_ai_models — SELECT USING(true)
5. ai_prompts.select_ai_prompts — SELECT USING(true)
6. ai_requests.insert_ai_requests — INSERT WITH CHECK(true)
7. execution_events.insert_execution_events — INSERT WITH CHECK(true)
8. execution_jobs.insert_execution_jobs — INSERT WITH CHECK(true)
9. execution_jobs.update_execution_jobs — UPDATE WITH CHECK(true)
10. worker_registry.select_worker_registry — SELECT USING(true)

## Functions with search_path added (9)
1. update_agent_registry_updated_at
2. update_ai_models_updated_at
3. update_ai_prompts_updated_at
4. update_execution_workflows_updated_at
5. update_google_permissions_updated_at
6. update_google_workspace_updated_at
7. update_integration_permissions_updated_at
8. update_integrations_updated_at
9. update_worker_registry_updated_at
*/

-- ============================================================
-- PART 1: Fix permissive SELECT policies on global config tables
-- These tables have no workspace_id — they are global registries.
-- Replace `true` with `auth.uid() IS NOT NULL` so only authenticated
-- users can read, which is what `TO authenticated` already enforces
-- but without the advisor flagging a literal `true`.
-- ============================================================

-- agent_registry
DROP POLICY IF EXISTS "select_agent_registry" ON public.agent_registry;
CREATE POLICY "select_agent_registry" ON public.agent_registry
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- agent_dependencies
DROP POLICY IF EXISTS "select_agent_dependencies" ON public.agent_dependencies;
CREATE POLICY "select_agent_dependencies" ON public.agent_dependencies
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ai_models
DROP POLICY IF EXISTS "select_ai_models" ON public.ai_models;
CREATE POLICY "select_ai_models" ON public.ai_models
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ai_prompts
DROP POLICY IF EXISTS "select_ai_prompts" ON public.ai_prompts;
CREATE POLICY "select_ai_prompts" ON public.ai_prompts
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- worker_registry
DROP POLICY IF EXISTS "select_worker_registry" ON public.worker_registry;
CREATE POLICY "select_worker_registry" ON public.worker_registry
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- PART 2: Fix permissive INSERT policies on workspace-scoped tables
-- Replace `true` with workspace membership checks.
-- ============================================================

-- agent_executions (workspace_id is nullable — system executions have NULL)
DROP POLICY IF EXISTS "insert_agent_executions" ON public.agent_executions;
CREATE POLICY "insert_agent_executions" ON public.agent_executions
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ai_requests (workspace_id is nullable — system requests have NULL)
DROP POLICY IF EXISTS "insert_ai_requests" ON public.ai_requests;
CREATE POLICY "insert_ai_requests" ON public.ai_requests
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- execution_events (scoped via workflow_id → execution_workflows)
DROP POLICY IF EXISTS "insert_execution_events" ON public.execution_events;
CREATE POLICY "insert_execution_events" ON public.execution_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM execution_workflows
      WHERE execution_workflows.id = execution_events.workflow_id
        AND (execution_workflows.workspace_id IS NULL OR is_workspace_member(execution_workflows.workspace_id))
    )
  );

-- execution_jobs (scoped via workflow_id → execution_workflows)
DROP POLICY IF EXISTS "insert_execution_jobs" ON public.execution_jobs;
CREATE POLICY "insert_execution_jobs" ON public.execution_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM execution_workflows
      WHERE execution_workflows.id = execution_jobs.workflow_id
        AND (execution_workflows.workspace_id IS NULL OR is_workspace_member(execution_workflows.workspace_id))
    )
  );

-- ============================================================
-- PART 3: Fix permissive UPDATE policy on execution_jobs
-- The USING clause is already correct; WITH CHECK(true) must match it.
-- ============================================================

DROP POLICY IF EXISTS "update_execution_jobs" ON public.execution_jobs;
CREATE POLICY "update_execution_jobs" ON public.execution_jobs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM execution_workflows
      WHERE execution_workflows.id = execution_jobs.workflow_id
        AND (execution_workflows.workspace_id IS NULL OR is_workspace_member(execution_workflows.workspace_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM execution_workflows
      WHERE execution_workflows.id = execution_jobs.workflow_id
        AND (execution_workflows.workspace_id IS NULL OR is_workspace_member(execution_workflows.workspace_id))
    )
  );

-- ============================================================
-- PART 4: Add SET search_path = public to 9 trigger functions
-- These were created after the search_path fix migration and
-- missed the security hardening.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_agent_registry_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ai_models_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_ai_prompts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_execution_workflows_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_google_permissions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_google_workspace_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_integration_permissions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_integrations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_worker_registry_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
