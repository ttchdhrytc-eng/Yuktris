BEGIN;

DO $$
DECLARE
  function_name regprocedure;
  definition text;
  corrected text;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'public.start_controlled_acceptance_generation(uuid,uuid,uuid,uuid,text,uuid)'::regprocedure,
    'public.advance_controlled_acceptance_generation(uuid,uuid)'::regprocedure,
    'public.finalize_controlled_acceptance_generation(uuid,uuid,text,jsonb)'::regprocedure
  ] LOOP
    definition := pg_get_functiondef(function_name);
    corrected := replace(definition, 'current_setting(''request.jwt.claim.role'',true)', 'auth.role()');
    IF corrected = definition THEN
      RAISE EXCEPTION 'controlled_acceptance_service_role_guard_not_found: %', function_name;
    END IF;
    EXECUTE corrected;
  END LOOP;
END $$;

COMMIT;
