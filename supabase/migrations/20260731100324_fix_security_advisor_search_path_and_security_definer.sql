/*
# Fix Security Advisor Issues: Mutable Search Path + SECURITY DEFINER

## Summary
Fixes four security advisor findings:
1. `public.trigger_set_updated_at()` — role-mutable search_path
2. `public.update_updated_at()` — role-mutable search_path
3. `public.update_browser_timestamp()` — SECURITY DEFINER executable by anon and authenticated
4. `public.update_browser_timestamp()` — role-mutable search_path

## Changes
- Re-create trigger_set_updated_at() with SET search_path TO 'public'
- Re-create update_updated_at() with SET search_path TO 'public'
- Re-create update_browser_timestamp() as SECURITY INVOKER with SET search_path TO 'public'

## Security Impact
- Immutable search_path prevents search_path hijacking attacks.
- SECURITY INVOKER on update_browser_timestamp() removes the ability for anon/authenticated roles
  to execute a privileged function via REST RPC. This is a trigger function that only sets
  NEW.updated_at = now() — it does not need elevated privileges.

## Notes
- These are trigger functions called by PostgreSQL automatically, not via REST RPC.
- CREATE OR REPLACE preserves function OIDs and all trigger bindings.
*/

-- 1. Fix trigger_set_updated_at: add immutable search_path
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Fix update_updated_at: add immutable search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. Fix update_browser_timestamp: switch to SECURITY INVOKER + add immutable search_path
CREATE OR REPLACE FUNCTION public.update_browser_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;