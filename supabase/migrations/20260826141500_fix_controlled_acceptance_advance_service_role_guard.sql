BEGIN;

/*
 * Supabase's current server secret is authenticated by PostgREST as the
 * service_role JWT role exposed through auth.role(). request.jwt.claim.role
 * is not populated for this credential form. Keep the RPC service-only while
 * matching the guard already used by the successful generation-start RPC.
 */
DO $$
DECLARE
  function_name regprocedure := 'public.advance_controlled_acceptance_generation(uuid,uuid)'::regprocedure;
  definition text;
  corrected text;
BEGIN
  definition := pg_get_functiondef(function_name);
  corrected := replace(
    definition,
    'current_setting(''request.jwt.claim.role'', true)',
    'auth.role()'
  );
  corrected := replace(
    corrected,
    'current_setting(''request.jwt.claim.role'',true)',
    'auth.role()'
  );
  IF corrected = definition THEN
    RAISE EXCEPTION 'controlled_acceptance_advance_service_role_guard_not_found';
  END IF;
  EXECUTE corrected;
END $$;

REVOKE ALL ON FUNCTION public.advance_controlled_acceptance_generation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_controlled_acceptance_generation(uuid,uuid) TO service_role;

COMMIT;
