/* Resolve pgcrypto.digest from the hardened SECURITY DEFINER search path. */

ALTER FUNCTION public.preflight_linkedin_write(
  uuid, uuid, uuid, uuid, text, text, text, text, uuid, uuid
) SET search_path = pg_catalog, public, extensions;
